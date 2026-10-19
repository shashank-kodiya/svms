import SparePart from '../models/SparePart.js';
import Booking from '../models/Booking.js';
import ServiceCenter from '../models/ServiceCenter.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { slotsForDate, isValidDateStr } from '../utils/slots.js';
import { nowIST } from '../utils/time.js';
import { releaseSlot, seatsUsed } from '../services/slotService.js';
import { emitBookingToCustomer } from '../realtime.js';

async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

const populate = (q) => q.populate('customer', 'name phone email').populate('vehicle', 'brand model regNumber type fuel year km');

// GET /api/center/bookings?status=pending,accepted&date=YYYY-MM-DD&from=&to=
export const listBookings = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const filter = { center: center._id };
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.date) filter.date = req.query.date;
  else if (req.query.from || req.query.to) filter.date = { ...(req.query.from ? { $gte: req.query.from } : {}), ...(req.query.to ? { $lte: req.query.to } : {}) };
  const list = await populate(Booking.find(filter).sort({ date: 1, slot: 1 }).limit(300));
  res.json(list);
});

// GET /api/center/schedule?date=   slots for the day with places used, plus that day's bookings
export const schedule = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const date = req.query.date || nowIST().date;
  if (!isValidDateStr(date)) throw new AppError('Choose a valid date.', 422);
  const base = slotsForDate(center, date);
  const used = await seatsUsed(center._id, date);
  const bookings = await populate(Booking.find({ center: center._id, date }).sort({ slot: 1 }));
  res.json({
    date,
    open: base.open,
    reason: base.reason,
    slots: base.slots.map((s) => ({ ...s, booked: used[s.start] || 0, remaining: Math.max(0, s.capacity - (used[s.start] || 0)) })),
    bookings
  });
});

// GET /api/center/booking-stats   numbers for the dashboard
export const bookingStats = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const today = nowIST().date;
  const [pending, todayCount, upcoming, inWorkshop, lowStock] = await Promise.all([
    Booking.countDocuments({ center: center._id, status: 'pending' }),
    Booking.countDocuments({ center: center._id, date: today, status: { $in: ['pending', 'accepted'] } }),
    Booking.countDocuments({ center: center._id, date: { $gte: today }, status: 'accepted' }),
    Booking.countDocuments({ center: center._id, status: { $in: ['vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup'] } }),
    // Parts at or below their low-stock level (Phase 6)
    SparePart.find({ center: center._id, isActive: true }).select('stock lowStockAt').lean()
      .then((parts) => parts.filter((p) => p.stock <= p.lowStockAt).length)
  ]);
  res.json({ today, pending, todayCount, upcoming, inWorkshop, lowStock });
});

async function centerBooking(req) {
  const center = await myCenter(req);
  const b = await Booking.findOne({ _id: req.params.id, center: center._id });
  if (!b) throw new AppError('Booking not found.', 404);
  return b;
}

// PATCH /api/center/bookings/:id/accept
export const acceptBooking = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (b.status !== 'pending') throw new AppError(`Only pending bookings can be accepted. This one is ${b.status}.`, 409);
  b.status = 'accepted';
  b.history.push({ status: 'accepted', by: 'service_center', note: req.body.note });
  await b.save();
  emitBookingToCustomer(b.customer, b, 'accepted');
  res.json(await populate(Booking.findById(b._id)));
});

// PATCH /api/center/bookings/:id/reject   body: { reason }
export const rejectBooking = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!['pending', 'accepted'].includes(b.status)) throw new AppError(`This booking is ${b.status} and can't be rejected.`, 409);
  b.status = 'rejected';
  b.rejectReason = req.body.reason;
  b.history.push({ status: 'rejected', by: 'service_center', note: req.body.reason });
  await b.save();
  await releaseSlot(b.center, b.date, { bookingId: b._id });
  emitBookingToCustomer(b.customer, b, 'rejected');
  res.json(await populate(Booking.findById(b._id)));
});
