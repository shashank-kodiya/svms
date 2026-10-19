import Booking, { ACTIVE_STATUSES } from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import ServiceCenter from '../models/ServiceCenter.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { serviceByKey } from '../constants/services.js';
import { isValidDateStr, toMinutes } from '../utils/slots.js';
import { nowIST } from '../utils/time.js';
import { availability, reserveSlot, releaseSlot, attachSeat } from '../services/slotService.js';
import { emitBookingToCenter } from '../realtime.js';
import VehicleHealth from '../models/VehicleHealth.js';
import { haversineKm, hasLocation } from '../services/geo.js';
import { scoreAll } from '../services/recommend.js';

const CENTER_PUBLIC = 'name address city pincode phone description brands services slotSettings workingHours holidays verificationStatus location ratingAvg ratingCount';

// How many jobs each center has finished on the platform (one query for all the centers in a search).
async function completedJobs(centerIds) {
  const rows = await Booking.aggregate([{ $match: { center: { $in: centerIds }, status: 'completed' } }, { $group: { _id: '$center', n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function ownVehicle(req, id) {
  const v = await Vehicle.findOne({ _id: id, owner: req.user._id, isActive: true });
  if (!v) throw new AppError('Vehicle not found.', 404);
  return v;
}

// A center can take this booking only if it is verified, has finished setup,
// services the vehicle's brand and offers the service for that vehicle type.
function offeredService(center, vehicle, serviceKey) {
  if (center.verificationStatus !== 'verified') return null;
  if (!center.brands?.[vehicle.type]?.includes(vehicle.brand)) return null;
  return center.services.find((s) => s.key === serviceKey && s.vehicleType === vehicle.type && s.isActive) || null;
}

const makeBookingNo = (date) =>
  `SB-${date.slice(2).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const populateForCustomer = (q) => q.populate('center', 'name address city pincode phone').populate('vehicle', 'brand model regNumber type').populate('mechanic', 'name');

// GET /api/bookings/search?vehicleId=&serviceKey=&date=&city=
export const searchCenters = asyncHandler(async (req, res) => {
  const { vehicleId, serviceKey, date, city } = req.query;
  const vehicle = await ownVehicle(req, vehicleId);
  const def = serviceByKey(serviceKey);
  if (!def || !def.types.includes(vehicle.type)) throw new AppError(`Choose a service available for ${vehicle.type.toLowerCase()}s.`, 422);

  const filter = { verificationStatus: 'verified', [`brands.${vehicle.type}`]: vehicle.brand };
  if (city) filter.city = new RegExp(`^${city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  const centers = await ServiceCenter.find(filter).select(CENTER_PUBLIC);

  // Phase 9: with the customer's location, each result gets a distance; every result gets a score.
  const me = req.query.lat != null && req.query.lng != null ? { lat: req.query.lat, lng: req.query.lng } : null;
  const jobs = await completedJobs(centers.map((c) => c._id));

  const results = [];
  for (const c of centers) {
    const svc = offeredService(c, vehicle, serviceKey);
    if (!svc) continue;
    const a = await availability(c, date);
    const located = hasLocation(c);
    results.push({
      center: {
        _id: c._id, name: c.name, address: c.address, city: c.city, pincode: c.pincode, phone: c.phone, description: c.description,
        ...(located ? { lat: c.location.lat, lng: c.location.lng } : {})
      },
      service: { key: svc.key, name: def.name, price: svc.price, durationMins: svc.durationMins, notes: svc.notes },
      availability: a,
      freeSlots: a.slots.filter((s) => s.remaining > 0).length,
      totalSlots: a.slots.length,
      distanceKm: me && located ? Math.round(haversineKm(me, c.location) * 10) / 10 : null,
      completedJobs: jobs.get(String(c._id)) || 0,
      ratingAvg: c.ratingAvg || 0,
      ratingCount: c.ratingCount || 0
    });
  }
  const scored = scoreAll(results.map((r) => ({ price: r.service.price, distanceKm: r.distanceKm, freeSlots: r.freeSlots, totalSlots: r.totalSlots, completedJobs: r.completedJobs, ratingAvg: r.ratingAvg, ratingCount: r.ratingCount })));
  results.forEach((r, i) => Object.assign(r, scored[i]));
  // Best match first. A center with no free slot on this date can still rank, but its score reflects that.
  results.sort((x, y) => y.score - x.score || x.service.price - y.service.price);
  res.json({ vehicle: { _id: vehicle._id, brand: vehicle.brand, model: vehicle.model, type: vehicle.type }, service: def, date, located: !!me, results });
});

// GET /api/bookings/availability/:centerId?date=
export const centerAvailability = asyncHandler(async (req, res) => {
  const center = await ServiceCenter.findOne({ _id: req.params.centerId, verificationStatus: 'verified' });
  if (!center) throw new AppError('Service center not found.', 404);
  res.json(await availability(center, req.query.date));
});

// Checks a requested date and slot and returns the slot's capacity.
async function checkSlot(center, date, slot) {
  if (!isValidDateStr(date)) throw new AppError('Choose a valid date.', 422);
  const a = await availability(center, date);
  if (!a.open) throw new AppError(`${a.reason}. Choose another date.`, 409);
  const s = a.slots.find((x) => x.start === slot);
  if (!s) throw new AppError('That time is not one of this center’s slots.', 422);
  if (s.past) throw new AppError('That time has already passed. Choose a later slot.', 409);
  if (s.remaining <= 0) throw new AppError('That slot is full. Choose another time.', 409);
  return s.capacity;
}

async function assertNoOtherBooking(vehicleId, date, exceptId) {
  const clash = await Booking.findOne({
    vehicle: vehicleId, date, status: { $in: ACTIVE_STATUSES }, ...(exceptId ? { _id: { $ne: exceptId } } : {})
  }).lean();
  if (clash) throw new AppError(`This vehicle already has booking ${clash.bookingNo} on that date.`, 409);
}

// POST /api/bookings
export const createBooking = asyncHandler(async (req, res) => {
  const { vehicleId, centerId, serviceKey, date, slot, problem } = req.body;
  const vehicle = await ownVehicle(req, vehicleId);
  const center = await ServiceCenter.findById(centerId);
  if (!center) throw new AppError('Service center not found.', 404);
  const svc = offeredService(center, vehicle, serviceKey);
  if (!svc) throw new AppError('This center does not offer that service for your vehicle.', 422);

  const capacity = await checkSlot(center, date, slot);
  await assertNoOtherBooking(vehicle._id, date);

  // The real guard against double booking: an atomic "take a place if any are left".
  const seatId = await reserveSlot(center._id, date, slot, capacity);
  if (!seatId) throw new AppError('Sorry, someone just booked the last place in that slot. Please choose another time.', 409);

  try {
    let booking;
    for (let attempt = 0; attempt < 3 && !booking; attempt += 1) {
      try {
        booking = await Booking.create({
          bookingNo: makeBookingNo(date),
          customer: req.user._id,
          vehicle: vehicle._id,
          center: center._id,
          service: { key: svc.key, name: serviceByKey(svc.key).name, vehicleType: svc.vehicleType, price: svc.price, durationMins: svc.durationMins },
          vehicleSnapshot: { brand: vehicle.brand, model: vehicle.model, regNumber: vehicle.regNumber, type: vehicle.type, km: vehicle.km },
          date, slot, problem,
          history: [{ status: 'pending', by: 'customer' }]
        });
      } catch (err) {
        if (err.code !== 11000 || attempt === 2) throw err; // booking number clash: try another
      }
    }
    await attachSeat(seatId, booking._id);
    emitBookingToCenter(center._id, booking, 'created');
    res.status(201).json(await populateForCustomer(Booking.findById(booking._id)));
  } catch (err) {
    await releaseSlot(center._id, date, { seatId }); // never keep a place for a booking that wasn't saved
    throw err;
  }
});

// GET /api/bookings   (my bookings)
export const myBookings = asyncHandler(async (req, res) => {
  const list = await populateForCustomer(Booking.find({ customer: req.user._id }).sort({ date: -1, slot: -1 }).limit(200));
  res.json(list);
});

async function myBooking(req) {
  const b = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
  if (!b) throw new AppError('Booking not found.', 404);
  return b;
}

// GET /api/bookings/:id
export const getBooking = asyncHandler(async (req, res) => {
  await myBooking(req);
  // The pickup code is hidden everywhere else; only the owner of the booking gets to see it.
  const booking = await populateForCustomer(Booking.findById(req.params.id).select('+pickup.otp'));
  if (booking.status !== 'ready_for_pickup' && booking.pickup) booking.pickup.otp = undefined;
  const health = await VehicleHealth.findOne({ booking: booking._id }).lean();
  res.json({ ...booking.toObject(), health });
});

// PATCH /api/bookings/:id/recommendations/:recId   body: { decision: 'approved' | 'rejected' }
// The customer decides on each extra repair. The center can only do approved ones.
export const decideRecommendation = asyncHandler(async (req, res) => {
  const b = await myBooking(req);
  if (!['inspection', 'in_progress'].includes(b.status)) throw new AppError('Decisions can only be made while the vehicle is being inspected or serviced.', 409);
  const r = b.recommendations.id(req.params.recId);
  if (!r) throw new AppError('Recommendation not found.', 404);
  if (r.status !== 'awaiting') throw new AppError(`You already ${r.status} this repair.`, 409);
  r.status = req.body.decision;
  r.decidedAt = new Date();
  await b.save();
  emitBookingToCenter(b.center, b, `recommendation_${req.body.decision}`);
  const booking = await populateForCustomer(Booking.findById(b._id));
  const health = await VehicleHealth.findOne({ booking: b._id }).lean();
  res.json({ ...booking.toObject(), health });
});

const hasStarted = (b) => {
  const now = nowIST();
  return b.date < now.date || (b.date === now.date && toMinutes(b.slot) <= now.minutes);
};

// PATCH /api/bookings/:id/cancel   body: { reason }
export const cancelBooking = asyncHandler(async (req, res) => {
  const b = await myBooking(req);
  if (!['pending', 'accepted'].includes(b.status)) throw new AppError('This booking can no longer be cancelled.', 409);
  if (hasStarted(b)) throw new AppError('The slot time has passed. Please contact the center.', 409);
  b.status = 'cancelled';
  b.cancelReason = req.body.reason;
  b.history.push({ status: 'cancelled', by: 'customer', note: req.body.reason });
  await b.save();
  await releaseSlot(b.center, b.date, { bookingId: b._id });
  emitBookingToCenter(b.center, b, 'cancelled');
  res.json(await populateForCustomer(Booking.findById(b._id)));
});

// PATCH /api/bookings/:id/reschedule   body: { date, slot }
export const rescheduleBooking = asyncHandler(async (req, res) => {
  const b = await myBooking(req);
  const { date, slot } = req.body;
  if (!['pending', 'accepted'].includes(b.status)) throw new AppError('This booking can no longer be changed.', 409);
  if (hasStarted(b)) throw new AppError('The slot time has passed. Please contact the center.', 409);
  if (date === b.date && slot === b.slot) throw new AppError('Choose a different date or time.', 422);

  const center = await ServiceCenter.findById(b.center);
  const capacity = await checkSlot(center, date, slot);
  if (date !== b.date) await assertNoOtherBooking(b.vehicle, date, b._id);

  // Take the new place first; only then give back the old one.
  const seatId = await reserveSlot(center._id, date, slot, capacity);
  if (!seatId) throw new AppError('Sorry, that slot just filled up. Please choose another time.', 409);
  const old = { date: b.date, slot: b.slot };
  b.date = date;
  b.slot = slot;
  b.status = 'pending'; // the center confirms the new time again
  b.history.push({ status: 'pending', by: 'customer', note: `Rescheduled from ${old.date} ${old.slot}` });
  try {
    await b.save();
  } catch (err) {
    await releaseSlot(center._id, date, { seatId });
    throw err;
  }
  await releaseSlot(center._id, old.date, { bookingId: b._id }); // old seat (still linked to this booking)
  await attachSeat(seatId, b._id);                                 // new seat now belongs to it
  emitBookingToCenter(center._id, b, 'rescheduled');
  res.json(await populateForCustomer(Booking.findById(b._id)));
});
