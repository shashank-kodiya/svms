import Notification from '../models/Notification.js';
import User from '../models/User.js';
import ServiceCenter from '../models/ServiceCenter.js';
import { emitToUser, onBookingEvent } from '../realtime.js';
import { sendEmail } from './email.js';

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Creates a notification, pushes it live, and (for important ones) emails it.
// With a dedupeKey the same notification is created only once; a repeat returns null.
export async function notify(userId, { type = 'system', title, body, link, dedupeKey, email = false }) {
  let n;
  try {
    n = await Notification.create({ user: userId, type, title, body, link, dedupeKey });
  } catch (err) {
    if (err.code === 11000) return null; // already sent
    throw err;
  }
  emitToUser(userId, 'notification:new', { id: String(n._id), type, title, body, link });
  if (email) {
    const u = await User.findById(userId).select('name email emailNotifications isActive').lean();
    if (u?.isActive && u.emailNotifications !== false) sendEmail({ to: u.email, name: u.name, subject: title, text: body || title, link });
  }
  return n;
}

// What each booking event says. `email: true` means it is important enough to send by email too.
const STATUS_TEXT = {
  vehicle_received: 'The center has received your vehicle.',
  inspection: 'Your vehicle is being inspected.',
  in_progress: 'The service work has started.',
  quality_check: 'The work is done and is being checked.',
  ready_for_pickup: 'Your vehicle is ready. Open the booking to see your pickup code and the amount to pay.'
};

function forCustomer({ kind, booking }) {
  const where = `${booking.vehicleSnapshot?.brand || ''} ${booking.vehicleSnapshot?.model || ''}`.trim() || 'your vehicle';
  const link = `/customer/bookings/${booking._id}`;
  const base = { type: 'booking', link };
  switch (kind) {
    case 'accepted': return { ...base, title: 'Booking confirmed', body: `${booking.bookingNo} for ${where} was confirmed by the service center.`, email: true };
    case 'rejected': return { ...base, title: 'Booking rejected', body: `${booking.bookingNo} was rejected${booking.rejectReason ? `: ${booking.rejectReason}` : '.'}`, email: true };
    case 'status': {
      if (!STATUS_TEXT[booking.status]) return null;
      const ready = booking.status === 'ready_for_pickup';
      return { ...base, title: ready ? 'Your vehicle is ready' : 'Service update', body: STATUS_TEXT[booking.status], email: ready };
    }
    case 'inspection': return { ...base, title: 'Inspection results ready', body: `The health check for ${where} was updated.` };
    case 'recommendation':
      return { ...base, title: 'Extra repairs to review', body: 'The center updated the recommended repairs. Nothing is done without your approval.', dedupeKey: `rec:${booking._id}:${Math.floor(Date.now() / 600000)}` };
    case 'bill': return { type: 'bill', link, title: 'Your bill is ready', body: `Invoice ${booking.bill?.invoiceNo || ''}${booking.bill?.total != null ? `, total ${inr(booking.bill.total)}` : ''}.`, email: true };
    case 'payment':
      return booking.bill?.payment?.status === 'paid'
        ? { type: 'payment', link, title: 'Payment confirmed', body: `Your payment for ${booking.bookingNo} was confirmed.`, email: true }
        : { type: 'payment', link, title: 'Payment not accepted', body: 'The service center could not confirm your payment. Open the booking to see why and send it again.', email: true };
    case 'completed': return { ...base, title: 'Vehicle handed over', body: `Thank you! ${booking.bookingNo} is complete.`, email: true };
    default: return null; // photos, mechanic changes and the like are shown live on the page only
  }
}

function forCenter({ kind, booking }) {
  const reg = booking.vehicleSnapshot?.regNumber || '';
  const job = `/center/jobs/${booking._id}`;
  switch (kind) {
    case 'created': return { type: 'booking', link: '/center/bookings', title: 'New booking request', body: `${booking.bookingNo}: ${booking.service?.name || 'service'} for ${reg} on ${booking.date} at ${booking.slot}.`, email: true };
    case 'rescheduled': return { type: 'booking', link: '/center/bookings', title: 'Booking rescheduled', body: `${booking.bookingNo} moved to ${booking.date} at ${booking.slot}.` };
    case 'cancelled': return { type: 'booking', link: '/center/bookings', title: 'Booking cancelled', body: `${booking.bookingNo} was cancelled by the customer.` };
    case 'recommendation_approved': return { type: 'booking', link: job, title: 'Repair approved', body: `The customer approved a repair on ${booking.bookingNo}.` };
    case 'recommendation_rejected': return { type: 'booking', link: job, title: 'Repair rejected', body: `The customer rejected a repair on ${booking.bookingNo}.` };
    case 'payment': return { type: 'payment', link: job, title: 'Online payment to confirm', body: `A customer sent a UPI payment for ${booking.bookingNo}. Check your account and confirm it.`, email: true };
    default: return null;
  }
}

async function handleBookingEvent(event) {
  const msg = event.to === 'customer' ? forCustomer(event) : forCenter(event);
  if (!msg) return;
  let userId = event.customerId;
  if (event.to === 'center') {
    userId = (await ServiceCenter.findById(event.centerId).select('owner').lean())?.owner;
  }
  if (userId) await notify(userId, msg);
}

// Called once when the server starts.
export const registerBookingNotifications = () => onBookingEvent(handleBookingEvent);
