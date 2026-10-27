import Booking, { WORKSHOP_FLOW, BILLING_STATUSES } from '../models/Booking.js';
import ServiceCenter from '../models/ServiceCenter.js';
import Mechanic from '../models/Mechanic.js';
import Vehicle from '../models/Vehicle.js';
import VehicleHealth, { HEALTH_PARTS } from '../models/VehicleHealth.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { nowIST } from '../utils/time.js';
import { cloudinaryReady, uploadImage, deleteImage } from '../config/cloudinary.js';
import { emitBookingToCustomer } from '../realtime.js';
import { computeBill } from '../services/billing.js';
import { issuePickupCode } from './billingController.js';

// Statuses in which the vehicle is with the center.
export const IN_WORKSHOP = ['vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup'];
const MAX_PHOTOS = 12;

async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

async function centerBooking(req) {
  const center = await myCenter(req);
  const b = await Booking.findOne({ _id: req.params.id, center: center._id });
  if (!b) throw new AppError('Booking not found.', 404);
  return b;
}

const populate = (q) =>
  q.populate('customer', 'name phone email')
    .populate('vehicle', 'brand model regNumber type fuel year km image')
    .populate('mechanic', 'name phone skills');

// Full job card: booking, this visit's health check, the vehicle's earlier health checks
// and (Phase 6) a live preview of the bill until it is made final.
export async function jobCard(bookingId) {
  const b = await populate(Booking.findById(bookingId));
  const health = await VehicleHealth.findOne({ booking: b._id }).lean();
  const previous = await VehicleHealth.find({ vehicle: b.vehicle._id, booking: { $ne: b._id } })
    .sort({ date: -1 }).limit(5).populate('center', 'name').lean();
  const billPreview = !b.bill && ['in_progress', ...BILLING_STATUSES].includes(b.status) ? computeBill(b) : null;
  const center = await ServiceCenter.findById(b.center).select('paymentSettings.payBeforePickup').lean();
  return { booking: b, health, previous, billPreview, payBeforePickup: !!center?.paymentSettings?.payBeforePickup };
}

// GET /api/center/jobs   vehicles that are due today or already in the workshop
export const listJobs = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const today = nowIST().date;
  const list = await populate(
    Booking.find({
      center: center._id,
      $or: [{ status: { $in: IN_WORKSHOP } }, { status: 'accepted', date: { $lte: today } }]
    }).sort({ date: 1, slot: 1 })
  );
  res.json(list);
});

// GET /api/center/bookings/:id
export const getJob = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  res.json(await jobCard(b._id));
});

// PATCH /api/center/bookings/:id/mechanic   body: { mechanicId } (null to unassign)
export const setMechanic = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!['accepted', 'vehicle_received', 'inspection', 'in_progress', 'quality_check'].includes(b.status)) {
    throw new AppError('A mechanic can only be assigned while the job is open.', 409);
  }
  if (req.body.mechanicId) {
    const m = await Mechanic.findOne({ _id: req.body.mechanicId, center: b.center, isActive: true });
    if (!m) throw new AppError('Choose one of your active mechanics.', 422);
    b.mechanic = m._id;
  } else {
    b.mechanic = null;
  }
  await b.save();
  emitBookingToCustomer(b.customer, b, 'mechanic');
  res.json(await jobCard(b._id));
});

// Why the job can't move to the next status yet (null = it can).
async function blockerFor(b, next) {
  if (next === 'vehicle_received' && b.date > nowIST().date) return `This booking is for ${b.date}. Mark the vehicle received on that day.`;
  if (next === 'in_progress') {
    if (!b.mechanic) return 'Assign a mechanic before starting the work.';
    if (!(await VehicleHealth.exists({ booking: b._id }))) return 'Save the inspection (vehicle health check) before starting the work.';
  }
  if (next === 'quality_check') {
    const waiting = b.recommendations.filter((r) => r.status === 'awaiting').length;
    if (waiting) return `${waiting} recommended repair${waiting > 1 ? 's are' : ' is'} still waiting for the customer's decision.`;
    const undone = b.recommendations.filter((r) => r.status === 'approved' && !r.done).length;
    if (undone) return `Mark the ${undone} approved repair${undone > 1 ? 's' : ''} as done first.`;
  }
  if (next === 'ready_for_pickup' && !b.bill) return 'Generate the final bill before marking the vehicle ready for pickup.';
  return null;
}

// PATCH /api/center/bookings/:id/status   body: { status, note }
export const advanceStatus = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  const at = WORKSHOP_FLOW.indexOf(b.status);
  const next = WORKSHOP_FLOW[at + 1];
  if (at === -1 || !next) throw new AppError(`A ${b.status.replace(/_/g, ' ')} booking can't be moved forward here.`, 409);
  if (req.body.status !== next) throw new AppError(`The next step for this job is "${next.replace(/_/g, ' ')}".`, 409);
  const blocker = await blockerFor(b, next);
  if (blocker) throw new AppError(blocker, 409);

  b.status = next;
  b.history.push({ status: next, by: 'service_center', note: req.body.note });
  await b.save();
  if (next === 'ready_for_pickup') await issuePickupCode(b._id); // customer shows this code to collect the vehicle
  emitBookingToCustomer(b.customer, b, 'status');
  res.json(await jobCard(b._id));
});

// PUT /api/center/bookings/:id/inspection   body: { notes, km, items: { engine, brakes, ... } }
export const saveInspection = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!['inspection', 'in_progress'].includes(b.status)) throw new AppError('Move the job to Inspection first.', 409);
  const { notes, km, items = {} } = req.body;

  const vehicle = await Vehicle.findById(b.vehicle);
  if (km != null && vehicle && km < vehicle.km) {
    throw new AppError(`The odometer can't be lower than the last recorded ${vehicle.km.toLocaleString('en-IN')} km.`, 422);
  }
  const clean = Object.fromEntries(HEALTH_PARTS.map((p) => [p, items[p] || 'good']));
  await VehicleHealth.findOneAndUpdate(
    { booking: b._id },
    { $set: { vehicle: b.vehicle, center: b.center, date: nowIST().date, km, items: clean, notes } },
    { upsert: true, new: true, runValidators: true }
  );
  b.inspectionNotes = notes;
  await b.save();

  // Keep the vehicle's odometer up to date with the reading taken at the workshop.
  if (vehicle && km != null && km > vehicle.km) {
    vehicle.km = km;
    vehicle.odometer.push({ km, date: new Date(), source: 'service' });
    await vehicle.save();
  }
  emitBookingToCustomer(b.customer, b, 'inspection');
  res.json(await jobCard(b._id));
});

// POST /api/center/bookings/:id/recommendations   body: { problem, reason, urgency, partsCost, labourCost }
export const addRecommendation = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!['inspection', 'in_progress'].includes(b.status)) throw new AppError('Repairs can be recommended during inspection or while the work is in progress.', 409);
  if (b.recommendations.length >= 15) throw new AppError('A job can have at most 15 recommendations.', 422);
  const { problem, reason, urgency, partsCost, labourCost } = req.body;
  b.recommendations.push({ problem, reason, urgency, partsCost, labourCost });
  await b.save();
  emitBookingToCustomer(b.customer, b, 'recommendation');
  res.status(201).json(await jobCard(b._id));
});

// DELETE /api/center/bookings/:id/recommendations/:recId   (only before the customer decides)
export const deleteRecommendation = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  const r = b.recommendations.id(req.params.recId);
  if (!r) throw new AppError('Recommendation not found.', 404);
  if (r.status !== 'awaiting') throw new AppError('The customer has already decided on this one, so it can no longer be removed.', 409);
  // Save the list without it (works the same on every MongoDB-compatible database).
  b.recommendations = b.recommendations.filter((x) => !x._id.equals(r._id));
  await b.save();
  emitBookingToCustomer(b.customer, b, 'recommendation');
  res.json(await jobCard(b._id));
});

// PATCH /api/center/bookings/:id/recommendations/:recId/done
export const markRecommendationDone = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  const r = b.recommendations.id(req.params.recId);
  if (!r) throw new AppError('Recommendation not found.', 404);
  if (r.status !== 'approved') throw new AppError('Only repairs the customer approved can be carried out.', 409);
  if (b.status !== 'in_progress') throw new AppError('Start the work (Service in progress) before marking repairs done.', 409);
  r.done = true;
  r.doneAt = new Date();
  await b.save();
  emitBookingToCustomer(b.customer, b, 'recommendation');
  res.json(await jobCard(b._id));
});

// POST /api/center/bookings/:id/photos   multipart: image, kind, caption
export const addPhoto = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!IN_WORKSHOP.includes(b.status)) throw new AppError('Photos can be added once the vehicle is in the workshop.', 409);
  if (b.photos.length >= MAX_PHOTOS) throw new AppError(`A job can have at most ${MAX_PHOTOS} photos.`, 422);
  if (!req.file) throw new AppError('Choose a photo to upload.', 400);
  if (!cloudinaryReady()) throw new AppError('Photo upload is not set up yet. Add the Cloudinary keys to backend/.env.', 503);
  const kind = ['before', 'after', 'other'].includes(req.body.kind) ? req.body.kind : 'other';
  const caption = String(req.body.caption || '').trim().slice(0, 120);
  const result = await uploadImage(req.file.buffer, `svms/jobs/${b._id}`);
  b.photos.push({ url: result.secure_url, publicId: result.public_id, kind, caption });
  await b.save();
  emitBookingToCustomer(b.customer, b, 'photo');
  res.status(201).json(await jobCard(b._id));
});

// DELETE /api/center/bookings/:id/photos/:photoId
export const deletePhoto = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  const p = b.photos.id(req.params.photoId);
  if (!p) throw new AppError('Photo not found.', 404);
  const publicId = p.publicId;
  b.photos = b.photos.filter((x) => !x._id.equals(p._id));
  await b.save();
  await deleteImage(publicId);
  res.json(await jobCard(b._id));
});
