import Booking from '../models/Booking.js';
import ServiceCenter from '../models/ServiceCenter.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Complaint from '../models/Complaint.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { nowIST, addDaysStr } from '../utils/time.js';

// GET /api/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD   (default: last 30 days, by booking date)
export const analytics = asyncHandler(async (req, res) => {
  const to = req.query.to || nowIST().date;
  const from = req.query.from || addDaysStr(to, -29);
  if (from > to) throw new AppError('The start date must not be after the end date.', 422);
  const inRange = { date: { $gte: from, $lte: to } };

  const [facets] = await Booking.aggregate([
    { $match: inRange },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', n: { $sum: 1 } } }],
        byDay: [{ $group: { _id: '$date', n: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        topServices: [{ $group: { _id: '$service.name', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }],
        byCenter: [
          { $group: { _id: '$center', bookings: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $in: ['$status', ['cancelled', 'rejected']] }, 1, 0] } } } },
          { $sort: { completed: -1, bookings: -1 } },
          { $limit: 8 }
        ]
      }
    }
  ]);

  const byStatus = Object.fromEntries(facets.byStatus.map((s) => [s._id, s.n]));
  const total = Object.values(byStatus).reduce((a, n) => a + n, 0);
  const lost = (byStatus.cancelled || 0) + (byStatus.rejected || 0);

  const centers = Object.fromEntries((await ServiceCenter.find({ _id: { $in: facets.byCenter.map((c) => c._id) } }).select('name city ratingAvg ratingCount').lean()).map((c) => [String(c._id), c]));
  const rangeStart = new Date(`${from}T00:00:00+05:30`);
  const rangeEnd = new Date(`${to}T23:59:59.999+05:30`);

  const [ratings, complaintGroups, newCustomers, newReviews] = await Promise.all([
    Review.aggregate([{ $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
    Complaint.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    User.countDocuments({ role: 'customer', createdAt: { $gte: rangeStart, $lte: rangeEnd } }),
    Review.countDocuments({ createdAt: { $gte: rangeStart, $lte: rangeEnd } })
  ]);

  res.json({
    from, to,
    bookings: total,
    completed: byStatus.completed || 0,
    cancellationRate: total ? Math.round((lost / total) * 1000) / 10 : 0,   // % of bookings cancelled or rejected
    byStatus: Object.entries(byStatus).map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n),
    byDay: facets.byDay.map((d) => ({ date: d._id, n: d.n })),
    topServices: facets.topServices.map((s) => ({ service: s._id, n: s.n })),
    topCenters: facets.byCenter.map((c) => ({
      centerId: c._id, name: centers[String(c._id)]?.name || 'Unknown', city: centers[String(c._id)]?.city,
      bookings: c.bookings, completed: c.completed, cancelled: c.cancelled,
      ratingAvg: centers[String(c._id)]?.ratingAvg || 0, ratingCount: centers[String(c._id)]?.ratingCount || 0
    })),
    newCustomers,
    reviews: { avg: ratings[0] ? Math.round(ratings[0].avg * 10) / 10 : 0, count: ratings[0]?.n || 0, inRange: newReviews },
    complaints: Object.fromEntries(['open', 'responded', 'resolved'].map((s) => [s, complaintGroups.find((g) => g._id === s)?.n || 0]))
  });
});
