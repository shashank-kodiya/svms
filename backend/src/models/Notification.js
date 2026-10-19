import mongoose from 'mongoose';

// Something a person should know about: a booking update, a bill, a payment, a reminder.
// Stored so it is still there when they come back; also pushed live while they are online.
export const NOTIFICATION_TYPES = ['booking', 'bill', 'payment', 'reminder', 'feedback', 'system'];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system' },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 400 },
    link: { type: String, trim: true, maxlength: 200 },   // page to open, for example /customer/bookings/<id>
    readAt: { type: Date, default: null },
    // Reminders set this so the same reminder is never created twice (for example one PUC reminder
    // per expiry date and bucket). The unique index below is what enforces it.
    dedupeKey: { type: String }
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ user: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

export default mongoose.model('Notification', notificationSchema);
