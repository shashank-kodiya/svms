import Booking from '../models/Booking.js';
import ServiceCenter from '../models/ServiceCenter.js';
import Payment from '../models/Payment.js';
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

// GET /api/center/payments/summary?date=YYYY-MM-DD   (default: today, India time)
// End-of-day settlement: money collected on one day by method, each payment, and what is still pending.
export const centerDailyPayments = asyncHandler(async (req, res) => {
  const center = await ServiceCenter.findOne({ owner: req.user._id }).select('_id');
  if (!center) throw new AppError('Service center profile not found.', 404);
  const date = req.query.date || nowIST().date;
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 86400000);
  const prevStart = new Date(start.getTime() - 86400000);
  const own = { center: center._id, ...PAID };

  const [paid, yesterday, waiting] = await Promise.all([
    Booking.find({ ...own, 'bill.payment.paidAt': { $gte: start, $lt: end } })
      .select('bookingNo vehicleSnapshot.regNumber service.name bill.invoiceNo bill.total bill.payment customer')
      .populate('customer', 'name').sort({ 'bill.payment.paidAt': 1 }).lean(),
    Booking.aggregate([{ $match: { ...own, 'bill.payment.paidAt': { $gte: prevStart, $lt: start } } }, { $group: { _id: null, total: { $sum: '$bill.total' } } }]),
    Payment.aggregate([{ $match: { center: center._id, status: 'submitted' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }])
  ]);

  const byMethod = { cash: { total: 0, count: 0 }, upi_counter: { total: 0, count: 0 }, upi_online: { total: 0, count: 0 }, card: { total: 0, count: 0 } };
  for (const b of paid) {
    const m = byMethod[b.bill.payment.method] || (byMethod[b.bill.payment.method] = { total: 0, count: 0 });
    m.total += b.bill.total;
    m.count += 1;
  }
  res.json({
    date,
    total: paid.reduce((s, b) => s + b.bill.total, 0),
    count: paid.length,
    yesterdayTotal: yesterday[0]?.total || 0,
    byMethod,
    payments: paid.map((b) => ({
      at: b.bill.payment.paidAt,
      bookingId: b._id,
      bookingNo: b.bookingNo,
      invoiceNo: b.bill.invoiceNo,
      customer: (b.customer?.name || '').split(' ')[0],
      regNumber: b.vehicleSnapshot?.regNumber,
      service: b.service?.name,
      method: b.bill.payment.method,
      reference: b.bill.payment.reference || '',
      amount: b.bill.total
    })),
    awaitingConfirmation: { total: waiting[0]?.total || 0, count: waiting[0]?.count || 0 },
    unpaid: await outstanding({ center: center._id })
  });
});
