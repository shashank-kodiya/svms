import mongoose from 'mongoose';

export const COMPLAINT_CATEGORIES = ['service_quality', 'overcharging', 'delay', 'staff_behaviour', 'damage', 'other'];
export const COMPLAINT_STATUSES = ['open', 'responded', 'resolved'];

const messageSchema = new mongoose.Schema(
  {
    by: { type: String, enum: ['customer', 'service_center', 'admin'], required: true },
    text: { type: String, required: true, trim: true, minlength: 2, maxlength: 1000 },
    at: { type: Date, default: Date.now }
  },
  { _id: false }
);

// A problem the customer reports about a job. It is a short conversation between the customer, the
// service center and (if needed) the admin, until someone marks it resolved.
const complaintSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookingNo: { type: String, required: true },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true },
    status: { type: String, enum: COMPLAINT_STATUSES, default: 'open', index: true },   // open = waiting for the center
    isOpen: { type: Boolean, default: true },                                           // false once resolved
    messages: { type: [messageSchema], default: [] },
    resolution: { by: { type: String, enum: ['customer', 'admin'] }, at: Date }
  },
  { timestamps: true }
);

// One unresolved complaint per booking, enforced by the database (two quick clicks can't make two).
complaintSchema.index({ booking: 1 }, { name: 'one_open_complaint_per_booking', unique: true, partialFilterExpression: { isOpen: true } });

export default mongoose.model('Complaint', complaintSchema);
