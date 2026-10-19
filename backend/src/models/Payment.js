import mongoose from 'mongoose';

// An online (demo UPI) payment. The customer pays through their UPI app and enters the reference
// number (UTR); the service center checks its account and confirms or rejects it.
// Counter payments (cash, card, UPI at the counter) are not stored here; they are recorded on the bill.
const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    invoiceNo: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },          // always the bill total, taken from the server
    reference: { type: String, required: true, trim: true },   // 12-digit UPI reference (UTR)
    status: { type: String, enum: ['submitted', 'confirmed', 'rejected'], default: 'submitted', index: true },
    isOpen: { type: Boolean, default: true },                  // true while submitted or confirmed
    rejectReason: { type: String, trim: true, maxlength: 300 },
    decidedAt: Date
  },
  { timestamps: true }
);

// One live payment per booking, and one use per reference at each center. The database enforces both,
// so two quick clicks (or a reused reference) can never create a second payment.
paymentSchema.index({ booking: 1 }, { name: 'one_open_payment_per_booking', unique: true, partialFilterExpression: { isOpen: true } });
paymentSchema.index({ booking: 1, createdAt: -1 });
paymentSchema.index({ center: 1, reference: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });

export default mongoose.model('Payment', paymentSchema);
