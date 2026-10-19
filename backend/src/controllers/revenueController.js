import Booking from '../models/Booking.js';
import ServiceCenter from '../models/ServiceCenter.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { nowIST } from '../utils/time.js';

// Revenue is the total of bills that are PAID. It is read straight from each booking's bill, so it
// includes online payments and counter payments (cash, card, UPI at the counter) alike.
// Dates are India time, so a payment at 11:30 PM counts for that day.
const PAID = { 'bill.payment.status': 'paid' };

function range(q) {
  const today = nowIST().date;
  const to = q.to || today;
  const from = q.from || new Date(new Date(`${to}T00:00:00+05:30`).getTime() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (from > to) throw new AppError('The start date must not be after the end date.', 422);
  return { from, to, start: new Date(`${from}T00:00:00+05:30`), end: new Date(`${to}T23:59:59.999+05:30`) };
}

const day = { $dateToString: { format: '%Y-%m-%d', date: '$bill.payment.paidAt', timezone: 'Asia/Kolkata' } };
const sum = { total: { $sum: '$bill.total' }, count: { $sum: 1 } };

async function summarise(match, extra = {}) {
  const [r] = await Booking.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [{ $group: { _id: null, ...sum } }],
        byMethod: [{ $group: { _id: '$bill.payment.method', ...sum } }, { $sort: { total: -1 } }],
        byDay: [{ $group: { _id: day, ...sum } }, { $sort: { _id: 1 } }],
        byService: [{ $group: { _id: '$service.name', ...sum } }, { $sort: { total: -1 } }],
        ...extra
      }
    }
  ]);
  const t = r.totals[0] || { total: 0, count: 0 };
  return {
    total: t.total,
    count: t.count,
    average: t.count ? Math.round(t.total / t.count) : 0,
    byMethod: r.byMethod.map((x) => ({ method: x._id, total: x.total, count: x.count })),
    byDay: r.byDay.map((x) => ({ date: x._id, total: x.total, count: x.count })),
    byService: r.byService.map((x) => ({ service: x._id, total: x.total, count: x.count })),
    r
  };
}

// Money billed but not yet paid (bills that are final and waiting for payment).
async function outstanding(match) {
  const [o] = await Booking.aggregate([
    { $match: { ...match, bill: { $ne: null }, 'bill.payment.status': 'unpaid', status: { $nin: ['cancelled', 'rejected'] } } },
    { $group: { _id: null, ...sum } }
  ]);
  return { total: o?.total || 0, count: o?.count || 0 };
}

// GET /api/center/revenue?from=YYYY-MM-DD&to=YYYY-MM-DD   (default: last 30 days)
export const centerRevenue = asyncHandler(async (req, res) => {
  const center = await ServiceCenter.findOne({ owner: req.user._id }).select('_id');
  if (!center) throw new AppError('Service center profile not found.', 404);
  const { from, to, start, end } = range(req.query);
  const own = { center: center._id };
  const { r, ...data } = await summarise({ ...own, ...PAID, 'bill.payment.paidAt': { $gte: start, $lte: end } });
  res.json({ from, to, ...data, outstanding: await outstanding(own) });
});

// GET /api/admin/revenue?from=&to=   Whole platform, with a row for each service center.
export const adminRevenue = asyncHandler(async (req, res) => {
  const { from, to, start, end } = range(req.query);
  const { r, ...data } = await summarise(
    { ...PAID, 'bill.payment.paidAt': { $gte: start, $lte: end } },
    { byCenter: [{ $group: { _id: '$center', ...sum } }, { $sort: { total: -1 } }, { $limit: 50 }] }
  );
  const names = Object.fromEntries((await ServiceCenter.find({ _id: { $in: r.byCenter.map((x) => x._id) } }).select('name city').lean()).map((c) => [String(c._id), c]));
  res.json({
    from, to, ...data,
    byCenter: r.byCenter.map((x) => ({ centerId: x._id, name: names[String(x._id)]?.name || 'Unknown', city: names[String(x._id)]?.city, total: x.total, count: x.count })),
    outstanding: await outstanding({})
  });
});
