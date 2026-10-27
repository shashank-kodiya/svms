import Booking, { BILLING_STATUSES } from '../models/Booking.js';
import SparePart from '../models/SparePart.js';
import Payment from '../models/Payment.js';
import ServiceCenter from '../models/ServiceCenter.js';
import Vehicle from '../models/Vehicle.js';
import VehicleHealth from '../models/VehicleHealth.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { nowIST } from '../utils/time.js';
import { computeBill, nextInvoiceNo, verifyCodeFor, newPickupCode, codesMatch } from '../services/billing.js';
import { sendInvoicePdf } from '../services/invoicePdf.js';
import { emitBookingToCustomer } from '../realtime.js';
import { jobCard } from './workshopController.js';

const MAX_PICKUP_TRIES = 5;

async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

async function centerBooking(req, extraSelect = '') {
  const center = await myCenter(req);
  const b = await Booking.findOne({ _id: req.params.id, center: center._id }).select(extraSelect);
  if (!b) throw new AppError('Booking not found.', 404);
  return b;
}

// ---------------- Spare parts stock ----------------

// GET /api/center/parts
export const listParts = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  res.json(await SparePart.find({ center: center._id, isActive: true }).sort({ name: 1 }));
});

// POST /api/center/parts   body: { name, partNo, hsn, unitPrice, gstRate, stock, lowStockAt }
export const addPart = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  if ((await SparePart.countDocuments({ center: center._id, isActive: true })) >= 300) throw new AppError('You can keep at most 300 parts.', 422);
  const { name, partNo, hsn, unitPrice, gstRate, stock, lowStockAt } = req.body;
  const part = await SparePart.create({ center: center._id, name, partNo, hsn, unitPrice, gstRate, stock, lowStockAt });
  res.status(201).json(part);
});

// PATCH /api/center/parts/:partId   body: any of the fields, or { addStock } to receive new stock
export const updatePart = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const part = await SparePart.findOne({ _id: req.params.partId, center: center._id, isActive: true });
  if (!part) throw new AppError('Part not found.', 404);
  for (const k of ['name', 'partNo', 'hsn', 'unitPrice', 'gstRate', 'lowStockAt']) if (req.body[k] !== undefined) part[k] = req.body[k];
  await part.save();
  if (req.body.addStock) {
    // $inc is atomic, so stock received while a mechanic takes a part is never lost.
    return res.json(await SparePart.findByIdAndUpdate(part._id, { $inc: { stock: req.body.addStock } }, { new: true }));
  }
  res.json(part);
});

// DELETE /api/center/parts/:partId   (hidden, not erased, because old bills refer to it)
export const deletePart = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const part = await SparePart.findOneAndUpdate({ _id: req.params.partId, center: center._id }, { $set: { isActive: false } }, { new: true });
  if (!part) throw new AppError('Part not found.', 404);
  res.json({ message: 'Part removed.' });
});

// ---------------- Parts used on a job ----------------

const PARTS_OPEN = ['in_progress', 'quality_check'];

// POST /api/center/bookings/:id/parts   body: { partId, qty }
export const addPartToJob = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!PARTS_OPEN.includes(b.status)) throw new AppError('Parts can be added while the service is in progress or in quality check.', 409);
  if (b.bill) throw new AppError('The bill is already final, so no more parts can be added.', 409);
  const qty = req.body.qty;

  // Take the parts from stock only if enough are there (one atomic step, so stock never goes below 0).
  const part = await SparePart.findOneAndUpdate(
    { _id: req.body.partId, center: b.center, isActive: true, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { new: true }
  );
  if (!part) {
    const p = await SparePart.findOne({ _id: req.body.partId, center: b.center, isActive: true });
    if (!p) throw new AppError('Choose one of your parts.', 422);
    throw new AppError(`Only ${p.stock} ${p.name} left in stock.`, 409);
  }

  const same = b.partsUsed.find((x) => x.part.equals(part._id) && x.unitPrice === part.unitPrice);
  if (same) same.qty += qty;
  else b.partsUsed.push({ part: part._id, name: part.name, partNo: part.partNo, hsn: part.hsn, qty, unitPrice: part.unitPrice, gstRate: part.gstRate });
  try {
    await b.save();
  } catch (err) {
    await SparePart.updateOne({ _id: part._id }, { $inc: { stock: qty } }); // put the stock back
    throw err;
  }
  res.status(201).json(await jobCard(b._id));
});

// DELETE /api/center/bookings/:id/parts/:lineId   (puts the parts back in stock)
export const removePartFromJob = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (b.bill) throw new AppError('The bill is already final, so parts can no longer be removed.', 409);
  const l = b.partsUsed.id(req.params.lineId);
  if (!l) throw new AppError('Part line not found.', 404);
  b.partsUsed = b.partsUsed.filter((x) => !x._id.equals(l._id));
  await b.save();
  await SparePart.updateOne({ _id: l.part }, { $inc: { stock: l.qty } });
  res.json(await jobCard(b._id));
});

// ---------------- Bill ----------------

// POST /api/center/bookings/:id/bill   Makes the bill final and gives it an invoice number.
export const finalizeBill = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!BILLING_STATUSES.includes(b.status)) throw new AppError('Generate the bill during quality check or when the vehicle is ready for pickup, once all work is done.', 409);
  if (b.bill) throw new AppError(`The bill is already final (${b.bill.invoiceNo}).`, 409);
  const sum = computeBill(b);
  const invoiceNo = await nextInvoiceNo(b.center, nowIST().date);
  // Only save if no bill was saved meanwhile (for example a double click).
  const saved = await Booking.updateOne(
    { _id: b._id, bill: null },
    { $set: { bill: { ...sum, invoiceNo, issuedAt: new Date(), verifyCode: verifyCodeFor(b._id, invoiceNo, sum.total), payment: { status: 'unpaid' } } } }
  );
  if (!saved.modifiedCount) throw new AppError('The bill is already final.', 409);
  emitBookingToCustomer(b.customer, b, 'bill');
  res.status(201).json(await jobCard(b._id));
});

// Sets a fresh pickup code. Called when the job becomes ready for pickup, or when the customer asks.
export async function issuePickupCode(bookingId) {
  await Booking.updateOne({ _id: bookingId }, { $set: { 'pickup.otp': newPickupCode(), 'pickup.otpAt': new Date(), 'pickup.attempts': 0 } });
}

// Does this center want the bill paid before the vehicle is released?
export async function paysBeforePickup(centerId) {
  const c = await ServiceCenter.findById(centerId).select('paymentSettings.payBeforePickup').lean();
  return !!c?.paymentSettings?.payBeforePickup;
}

// POST /api/center/bookings/:id/payment   body: { paymentMethod }
// Records a payment taken at the counter before handover (needed when the center wants payment before pickup).
export const recordCounterPayment = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!['quality_check', 'ready_for_pickup'].includes(b.status)) throw new AppError('Record the payment once the work is done and the bill is final.', 409);
  if (!b.bill) throw new AppError('Generate the bill first.', 409);
  if (b.bill.payment?.status === 'paid') throw new AppError('This bill is already paid.', 409);
  if (await Payment.exists({ booking: b._id, status: 'submitted' })) {
    throw new AppError('The customer sent an online payment. Confirm or reject it first.', 409);
  }
  // Only mark it paid if it is still unpaid (a double click, or an online payment confirmed meanwhile, does nothing).
  const saved = await Booking.updateOne(
    { _id: b._id, 'bill.payment.status': 'unpaid' },
    { $set: { 'bill.payment': { status: 'paid', method: req.body.paymentMethod, paidAt: new Date() } } }
  );
  if (!saved.modifiedCount) throw new AppError('This bill is already paid.', 409);
  emitBookingToCustomer(b.customer, await Booking.findById(b._id), 'payment');
  res.json(await jobCard(b._id));
});

// POST /api/center/bookings/:id/handover   body: { otp, paymentMethod }
// The customer tells the center their 4-digit code; only then is the vehicle handed over.
export const handover = asyncHandler(async (req, res) => {
  const b = await centerBooking(req, '+pickup.otp');
  if (b.status !== 'ready_for_pickup') throw new AppError('The vehicle can be handed over once it is ready for pickup.', 409);
  if (!b.bill) throw new AppError('Generate the bill first.', 409);
  // Phase 7: a bill the customer paid online needs no payment method here. Otherwise the center
  // says how it was paid at the counter, and a payment still waiting for confirmation must be dealt with first.
  const paidOnline = b.bill.payment?.status === 'paid';
  if (!paidOnline && await paysBeforePickup(b.center)) {
    throw new AppError('Your center releases vehicles only after payment. Record the payment first.', 409);
  }
  if (!paidOnline) {
    if (await Payment.exists({ booking: b._id, status: 'submitted' })) {
      throw new AppError('The customer sent an online payment. Confirm or reject it before handing over.', 409);
    }
    if (!req.body.paymentMethod) throw new AppError('Choose how the customer paid.', 422);
  }
  if (b.pickup.attempts >= MAX_PICKUP_TRIES) {
    throw new AppError('Too many wrong codes. Ask the customer to tap "Get a new code" in the app.', 429);
  }
  if (!codesMatch(req.body.otp, b.pickup.otp)) {
    await Booking.updateOne({ _id: b._id }, { $inc: { 'pickup.attempts': 1 } }); // counted atomically
    const left = MAX_PICKUP_TRIES - ((await Booking.findById(b._id).select('pickup.attempts').lean()).pickup?.attempts || 0);
    throw new AppError(left > 0 ? `That code is wrong. ${left} tr${left === 1 ? 'y' : 'ies'} left.` : 'That code is wrong. Ask the customer to get a new code.', 422);
  }

  const now = new Date();
  b.status = 'completed';
  b.history.push({ status: 'completed', by: 'service_center', note: 'Vehicle handed over (pickup code checked)' });
  b.pickup.otp = undefined;
  b.pickup.collectedAt = now;
  if (!paidOnline) b.bill.payment = { status: 'paid', method: req.body.paymentMethod, paidAt: now };
  await b.save();

  // Remember the last service on the vehicle (used for reminders in Phase 8).
  const health = await VehicleHealth.findOne({ booking: b._id }).select('km').lean();
  await Vehicle.updateOne(
    { _id: b.vehicle },
    { $set: { lastService: { date: nowIST().date, km: health?.km ?? b.vehicleSnapshot?.km, serviceName: b.service.name, center: b.center, booking: b._id } } }
  );
  emitBookingToCustomer(b.customer, b, 'completed');
  res.json(await jobCard(b._id));
});

const populateInvoice = (q) =>
  q.populate('center', 'name address city pincode phone gstin paymentSettings.methods paymentSettings.acceptsUpi').populate('customer', 'name phone email');

// GET /api/center/bookings/:id/invoice.pdf
export const centerInvoicePdf = asyncHandler(async (req, res) => {
  const b = await centerBooking(req);
  if (!b.bill) throw new AppError('The bill is not ready yet.', 404);
  await sendInvoicePdf(res, await populateInvoice(Booking.findById(b._id)));
});

// ---------------- Customer side ----------------

async function myBooking(req, extraSelect = '') {
  const b = await Booking.findOne({ _id: req.params.id, customer: req.user._id }).select(extraSelect);
  if (!b) throw new AppError('Booking not found.', 404);
  return b;
}

// GET /api/bookings/:id/invoice.pdf
export const customerInvoicePdf = asyncHandler(async (req, res) => {
  const b = await myBooking(req);
  if (!b.bill) throw new AppError('The bill is not ready yet.', 404);
  await sendInvoicePdf(res, await populateInvoice(Booking.findById(b._id)));
});

// POST /api/bookings/:id/pickup-code   Makes a new code (old one stops working).
export const newCustomerPickupCode = asyncHandler(async (req, res) => {
  const b = await myBooking(req);
  if (b.status !== 'ready_for_pickup') throw new AppError('A pickup code is only needed when your vehicle is ready.', 409);
  if (b.bill?.payment?.status !== 'paid' && await paysBeforePickup(b.center)) {
    throw new AppError('This center releases vehicles after payment. Pay the bill to get your pickup code.', 409);
  }
  await issuePickupCode(b._id);
  const fresh = await Booking.findById(b._id).select('+pickup.otp');
  res.json({ otp: fresh.pickup.otp, message: 'New code ready. The old code no longer works.' });
});

// ---------------- Public ----------------

// GET /api/meta/verify-invoice/:id?code=   Opened from the QR code on a printed invoice.
// Shows only what is printed on the invoice anyway, and only if the code matches.
export const verifyInvoice = asyncHandler(async (req, res) => {
  const b = await Booking.findById(req.params.id).populate('center', 'name city').lean();
  if (!b?.bill || !codesMatch(req.query.code, b.bill.verifyCode)) {
    return res.status(404).json({ valid: false, message: 'We could not find this invoice. It may not be genuine.' });
  }
  const reg = b.vehicleSnapshot?.regNumber || '';
  res.json({
    valid: true,
    invoiceNo: b.bill.invoiceNo,
    issuedAt: b.bill.issuedAt,
    total: b.bill.total,
    paid: b.bill.payment?.status === 'paid',
    center: `${b.center.name}, ${b.center.city}`,
    vehicle: reg.length > 4 ? `${reg.slice(0, 4)}••${reg.slice(-4)}` : reg, // partly hidden
    service: b.service.name
  });
});
