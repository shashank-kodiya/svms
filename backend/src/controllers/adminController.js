import User from '../models/User.js';
import ServiceCenter from '../models/ServiceCenter.js';
import Vehicle from '../models/Vehicle.js';
import Booking from '../models/Booking.js';
import AppError, { asyncHandler } from '../utils/AppError.js';

// GET /api/admin/stats
export const stats = asyncHandler(async (req, res) => {
  const [customers, centers, pending, cars, bikes, bookingGroups] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    ServiceCenter.countDocuments({ verificationStatus: 'verified' }),
    ServiceCenter.countDocuments({ verificationStatus: 'pending' }),
    Vehicle.countDocuments({ isActive: true, type: 'Car' }),
    Vehicle.countDocuments({ isActive: true, type: 'Bike' }),
    Booking.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);
  const bookingsByStatus = Object.fromEntries(bookingGroups.map((g) => [g._id, g.n]));
  const bookings = Object.values(bookingsByStatus).reduce((a, n) => a + n, 0);
  res.json({ customers, verifiedCenters: centers, pendingCenters: pending, vehicles: cars + bikes, cars, bikes, bookings, bookingsByStatus });
});

// GET /api/admin/customers
export const listCustomers = asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(200);
  res.json(users.map((u) => u.toSafeJSON()));
});

// GET /api/admin/centers?status=pending
export const listCenters = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.verificationStatus = req.query.status;
  const centers = await ServiceCenter.find(filter)
    .populate('owner', 'name email phone')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(centers);
});

// PATCH /api/admin/centers/:id/status   body: { status, note }
export const setCenterStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const center = await ServiceCenter.findById(req.params.id);
  if (!center) throw new AppError('Service center not found.', 404);
  center.verificationStatus = status;
  center.verificationNote = note || undefined;
  center.verifiedAt = status === 'verified' ? new Date() : undefined;
  await center.save();
  res.json(center);
});

// GET /api/admin/bookings?status=&center=&from=&to=
export const listBookings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.center) filter.center = req.query.center;
  if (req.query.from || req.query.to) filter.date = { ...(req.query.from ? { $gte: req.query.from } : {}), ...(req.query.to ? { $lte: req.query.to } : {}) };
  const list = await Booking.find(filter)
    .populate('customer', 'name email')
    .populate('center', 'name city')
    .sort({ createdAt: -1 })
    .limit(300);
  res.json(list);
});
