import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import ServiceCenter, { PAYMENT_METHODS, acceptedMethods } from '../models/ServiceCenter.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { cloudinaryReady, uploadImage, deleteImage } from '../config/cloudinary.js';
import { upiLink, upiQr } from '../services/payments.js';
import { emitBookingToCenter, emitBookingToCustomer } from '../realtime.js';

async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

// ---------------- Center: payment settings ----------------

// GET /api/center/payment-settings
const settingsOut = (center) => {
  const ps = center.paymentSettings?.toObject?.() || {};
  return { acceptsUpi: false, ...ps, payBeforePickup: !!ps.payBeforePickup, methods: acceptedMethods(center), upiQr: ps.upiQr?.url ? { url: ps.upiQr.url } : null };
};

export const getPaymentSettings = asyncHandler(async (req, res) => {
  res.json(settingsOut(await myCenter(req)));
});

// PUT /api/center/payment-settings   body: { acceptsUpi, upiId, payeeName, methods }
export const updatePaymentSettings = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const { acceptsUpi, upiId, payeeName } = req.body;
  if (acceptsUpi && !upiId) throw new AppError('Enter your UPI ID to accept UPI payments.', 422);
  let methods = req.body.methods ? PAYMENT_METHODS.filter((m) => req.body.methods.includes(m)) : acceptedMethods(center);
  if (acceptsUpi && !methods.includes('upi')) methods = PAYMENT_METHODS.filter((m) => m === 'upi' || methods.includes(m));
  if (!methods.length) throw new AppError('Choose at least one way customers can pay.', 422);
  // Keep the uploaded QR (a plain copy: the stored object is replaced just below).
  const { url, publicId } = center.paymentSettings?.upiQr || {};
  const upiQr = url ? { url, publicId } : undefined;
  const payBeforePickup = req.body.payBeforePickup ?? !!center.paymentSettings?.payBeforePickup;
  center.paymentSettings = { acceptsUpi: !!acceptsUpi, upiId: upiId || undefined, payeeName: payeeName || undefined, methods, upiQr, payBeforePickup: !!payBeforePickup };
  await center.save();
  res.json(settingsOut(center));
});

// POST /api/center/payment-settings/qr   multipart: image   The center's own GPay / PhonePe / Paytm QR.
export const uploadUpiQr = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  if (!req.file) throw new AppError('Choose the QR image to upload.', 400);
  if (!cloudinaryReady()) throw new AppError('Photo upload is not set up yet. Add the Cloudinary keys to backend/.env.', 503);
  const old = center.paymentSettings?.upiQr?.publicId;
  const result = await uploadImage(req.file.buffer, `svms/centers/${center._id}/upi-qr`);
  center.set('paymentSettings.upiQr', { url: result.secure_url, publicId: result.public_id });
  await center.save();
  await deleteImage(old);
  res.status(201).json(settingsOut(center));
});

// DELETE /api/center/payment-settings/qr
export const removeUpiQr = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const old = center.paymentSettings?.upiQr?.publicId;
  center.set('paymentSettings.upiQr', undefined);
  await center.save();
  await deleteImage(old);
  res.json(settingsOut(center));
});

// ---------------- Center: confirm or reject online payments ----------------

// GET /api/center/payments?status=submitted
export const listPayments = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const filter = { center: center._id };
  if (req.query.status) filter.status = req.query.status;
  res.json(await Payment.find(filter).sort({ createdAt: -1 }).limit(100)
    .populate('booking', 'bookingNo vehicleSnapshot service')
    .populate('customer', 'name phone'));
});

// PATCH /api/center/payments/:id/confirm   Marks the bill as paid (UPI, online).
export const confirmPayment = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const now = new Date();
  // Only a "submitted" payment can be confirmed, and only once (so a double click does nothing twice).
  const pay = await Payment.findOneAndUpdate(
    { _id: req.params.id, center: center._id, status: 'submitted' },
    { $set: { status: 'confirmed', decidedAt: now } },
    { new: true }
  );
  if (!pay) throw new AppError('This payment is not waiting for confirmation.', 409);

  const marked = await Booking.findOneAndUpdate(
    { _id: pay.booking, 'bill.payment.status': 'unpaid' },
    { $set: { 'bill.payment': { status: 'paid', method: 'upi_online', reference: pay.reference, paidAt: now } } },
    { new: true }
  );
  if (!marked) {
    // The bill was already paid another way. Undo so the books stay consistent.
    await Payment.updateOne({ _id: pay._id }, { $set: { status: 'rejected', isOpen: false, rejectReason: 'The bill was already paid.', decidedAt: now } });
    throw new AppError('This bill is already paid. The online payment was cancelled.', 409);
  }
  emitBookingToCustomer(pay.customer, marked, 'payment');
  res.json(pay);
});

// PATCH /api/center/payments/:id/reject   body: { reason }
export const rejectPayment = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const pay = await Payment.findOneAndUpdate(
    { _id: req.params.id, center: center._id, status: 'submitted' },
    { $set: { status: 'rejected', isOpen: false, rejectReason: req.body.reason, decidedAt: new Date() } },
    { new: true }
  );
  if (!pay) throw new AppError('This payment is not waiting for confirmation.', 409);
  const b = await Booking.findById(pay.booking).select('bookingNo status customer');
  if (b) emitBookingToCustomer(pay.customer, b, 'payment');
  res.json(pay);
});

// ---------------- Customer: pay a final bill ----------------

async function payableBooking(req) {
  const b = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
  if (!b) throw new AppError('Booking not found.', 404);
  if (!b.bill) throw new AppError('The bill is not ready yet.', 409);
  if (b.bill.payment?.status === 'paid') throw new AppError('This bill is already paid.', 409);
  return b;
}

// GET /api/bookings/:id/pay   What the customer needs to pay: UPI link, QR code and any payment already sent.
export const payInfo = asyncHandler(async (req, res) => {
  const b = await payableBooking(req);
  const center = await ServiceCenter.findById(b.center).select('name paymentSettings');
  const ps = center.paymentSettings;
  const methods = acceptedMethods(center);
  const latest = await Payment.findOne({ booking: b._id }).sort({ createdAt: -1 }).select('status reference rejectReason createdAt');
  if (!ps?.acceptsUpi || !ps.upiId) {
    return res.json({ available: false, amount: b.bill.total, invoiceNo: b.bill.invoiceNo, latest, methods, message: `${center.name} takes payment at the counter.` });
  }
  const link = upiLink(center, b.bill);
  res.json({
    available: true,
    amount: b.bill.total,
    invoiceNo: b.bill.invoiceNo,
    upiId: ps.upiId,
    payeeName: ps.payeeName || center.name,
    link,
    qr: await upiQr(link),
    centerQr: ps.upiQr?.url || null,   // the center's own GPay / PhonePe / Paytm QR, if it uploaded one
    methods,
    latest
  });
});

// POST /api/bookings/:id/payments   body: { reference }   The customer says "I paid" with the UPI reference.
export const submitPayment = asyncHandler(async (req, res) => {
  const b = await payableBooking(req);
  const center = await ServiceCenter.findById(b.center).select('paymentSettings');
  if (!center.paymentSettings?.acceptsUpi) throw new AppError('This center does not take online payments. Please pay at the counter.', 409);

  try {
    const pay = await Payment.create({
      booking: b._id, center: b.center, customer: req.user._id,
      invoiceNo: b.bill.invoiceNo,
      amount: b.bill.total,                    // taken from the bill, never from the browser
      reference: req.body.reference
    });
    emitBookingToCenter(b.center, b, 'payment');
    res.status(201).json({ message: 'Payment sent. The service center will confirm it shortly.', payment: pay });
  } catch (err) {
    if (err.code === 11000) {
      const mine = await Payment.exists({ booking: b._id, isOpen: true });
      throw new AppError(mine ? 'You have already sent a payment for this bill. Wait for the center to confirm it.' : 'This reference number has already been used.', 409);
    }
    throw err;
  }
});
