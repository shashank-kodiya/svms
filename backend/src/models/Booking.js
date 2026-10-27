import mongoose from 'mongoose';

// Statuses used across the project. Phase 4 uses the first four; Phase 5 adds the workshop steps;
// Phase 6 adds 'completed' (bill and pickup code).
export const BOOKING_STATUSES = [
  'pending', 'accepted', 'rejected', 'cancelled',
  'vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup', 'completed'
];
// The order a vehicle moves through the workshop. The center can only move one step forward.
export const WORKSHOP_FLOW = ['accepted', 'vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup'];
// 'completed' is reached only through the pickup-code handover (Phase 6), not the next-step button.
export const ACTIVE_STATUSES = ['pending', 'accepted', 'vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup'];

// Statuses in which the final bill can be generated. 'ready_for_pickup' is included so a job that
// reached it without a bill (older test data) can still be billed and handed over.
export const BILLING_STATUSES = ['quality_check', 'ready_for_pickup'];

const historySchema =new mongoose.Schema(
  {
    status: { type: String, enum: BOOKING_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, enum: ['customer', 'service_center', 'admin', 'system'], required: true },
    note: { type: String, trim: true, maxlength: 300 }
  },
  { _id: false }
);

// Extra work the center finds during inspection. Nothing is done until the customer approves it.
export const URGENCY = ['High', 'Medium', 'Low'];
const recommendationSchema = new mongoose.Schema(
  {
    problem: { type: String, required: true, trim: true, maxlength: 120 },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    urgency: { type: String, enum: URGENCY, default: 'Medium' },
    partsCost: { type: Number, required: true, min: 0 },
    labourCost: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['awaiting', 'approved', 'rejected'], default: 'awaiting' },
    decidedAt: Date,
    done: { type: Boolean, default: false },
    doneAt: Date
  },
  { timestamps: true }
);

// Photo proof of work (stored in Cloudinary; only the link is kept here).
const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
    kind: { type: String, enum: ['before', 'after', 'other'], default: 'other' },
    caption: { type: String, trim: true, maxlength: 120 },
    at: { type: Date, default: Date.now }
  }
);

// ---- Phase 6: parts used, bill and pickup ----
// A part taken from the center's stock for this job (copied, so later price changes don't alter it).
const partUsedSchema = new mongoose.Schema(
  {
    part: { type: mongoose.Schema.Types.ObjectId, ref: 'SparePart', required: true },
    name: { type: String, required: true },
    partNo: String,
    hsn: String,
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, required: true },
    at: { type: Date, default: Date.now }
  }
);

// One line of the final invoice. Amounts are in rupees (2 decimals).
const billLineSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['service', 'repair_parts', 'repair_labour', 'part'], required: true },
    description: { type: String, required: true },
    hsn: String,
    qty: { type: Number, required: true },
    rate: { type: Number, required: true },
    amount: { type: Number, required: true },   // qty x rate (taxable value)
    gstRate: { type: Number, required: true },
    cgst: { type: Number, required: true },
    sgst: { type: Number, required: true }
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    invoiceNo: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    lines: { type: [billLineSchema], default: [] },
    taxable: Number, cgst: Number, sgst: Number, roundOff: Number, total: Number,
    verifyCode: String,                                   // printed in the QR code; proves the invoice is genuine
    payment: {
      status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
      method: { type: String, enum: ['cash', 'card', 'upi_counter', 'upi_online'] },
      reference: String,                                  // Phase 7: UPI reference (UTR) of an online payment
      paidAt: Date
    }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingNo: { type: String, required: true, unique: true }, // e.g. SB-20261016-4821
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true, index: true },

    // Copy of the service and price at booking time, so later price changes don't alter this booking.
    service: {
      key: { type: String, required: true },
      name: { type: String, required: true },
      vehicleType: { type: String, enum: ['Car', 'Bike'], required: true },
      price: { type: Number, required: true },
      durationMins: { type: Number, required: true }
    },
    // Copy of the vehicle as it was when booked.
    // ("type" must be written as { type: String } here, otherwise Mongoose treats it as a keyword.)
    vehicleSnapshot: {
      brand: String, model: String, regNumber: String, type: { type: String }, km: Number,
      imageUrl: String   // the vehicle's photo at booking time, so the center can recognise it
    },

    date: { type: String, required: true },   // 'YYYY-MM-DD'
    slot: { type: String, required: true },   // '10:00' (one-hour slot start)
    problem: { type: String, trim: true, maxlength: 500 },

    status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },

    // ---- Phase 5: work in the workshop ----
    mechanic: { type: mongoose.Schema.Types.ObjectId, ref: 'Mechanic', default: null },
    inspectionNotes: { type: String, trim: true, maxlength: 1000 },
    recommendations: { type: [recommendationSchema], default: [] },
    photos: { type: [photoSchema], default: [] },
    history: { type: [historySchema], default: [] },

    // ---- Phase 6 ----
    partsUsed: { type: [partUsedSchema], default: [] },
    bill: { type: billSchema, default: null },
    pickup: {
      otp: { type: String, select: false },   // 4-digit code shown only to the customer
      otpAt: Date,
      attempts: { type: Number, default: 0 },
      collectedAt: Date
    },
    rejectReason: { type: String, trim: true, maxlength: 300 },
    cancelReason: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: true }
);

bookingSchema.index({ center: 1, date: 1, slot: 1 });
bookingSchema.index({ customer: 1, date: -1 });
bookingSchema.index({ vehicle: 1, date: 1 });

export default mongoose.model('Booking', bookingSchema);
