import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import ServiceCenter, { acceptedMethods } from '../models/ServiceCenter.js';
import { notify } from './notifications.js';

// Reminds a customer whose vehicle is ready but whose bill is still unpaid.
// Steps are hours since the vehicle became ready. Only the latest step that is due is sent, so a
// customer never gets a burst of old reminders (for example after the server was off for a day).
const STEPS = [
  { key: 'h2', after: 2, email: false },
  { key: 'd1', after: 24, email: true },
  { key: 'd3', after: 72, email: true, tellCenter: true }
];

const METHOD_LABEL = { cash: 'cash', upi: 'UPI', card: 'card', netbanking: 'net banking', emi: 'EMI' };
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export function dueStep(hoursReady) {
  return [...STEPS].reverse().find((s) => hoursReady >= s.after) || null;
}

// When the vehicle became ready: the latest "ready_for_pickup" entry in the booking's history.
const readyAt = (b) => [...(b.history || [])].reverse().find((h) => h.status === 'ready_for_pickup')?.at || b.updatedAt;

export async function runPaymentReminders(now = new Date()) {
  const made = { checked: 0, customer: 0, center: 0 };
  const waiting = await Booking.find({ status: 'ready_for_pickup', 'bill.payment.status': 'unpaid' })
    .select('bookingNo customer center vehicleSnapshot bill.total bill.invoiceNo history updatedAt').lean();
  if (!waiting.length) return made;

  // A customer who has already paid online (waiting for the center to confirm) is not reminded.
  const sent = new Set((await Payment.find({ booking: { $in: waiting.map((b) => b._id) }, status: 'submitted' }).select('booking').lean()).map((p) => String(p.booking)));
  const centers = new Map((await ServiceCenter.find({ _id: { $in: [...new Set(waiting.map((b) => String(b.center)))] } })
    .select('name owner paymentSettings').lean()).map((c) => [String(c._id), c]));

  for (const b of waiting) {
    made.checked += 1;
    if (sent.has(String(b._id))) continue;
    const hours = (now - new Date(readyAt(b))) / 3600000;
    const step = dueStep(hours);
    if (!step) continue;

    const c = centers.get(String(b.center));
    const vehicle = `${b.vehicleSnapshot?.brand || ''} ${b.vehicleSnapshot?.model || ''}`.trim() || 'vehicle';
    const reg = b.vehicleSnapshot?.regNumber ? ` (${b.vehicleSnapshot.regNumber})` : '';
    const methods = acceptedMethods(c).map((m) => METHOD_LABEL[m]).join(', ');
    const online = c?.paymentSettings?.acceptsUpi && c.paymentSettings.upiId;
    const days = Math.floor(hours / 24);

    const n = await notify(b.customer, {
      type: 'payment',
      title: step.key === 'h2' ? `Bill ready: ${rupees(b.bill.total)} to pay` : `Payment due: ${rupees(b.bill.total)} for your ${vehicle}`,
      body: `Your ${vehicle}${reg} ${days ? `has been ready for ${days} day${days === 1 ? '' : 's'}` : 'is ready'} at ${c?.name || 'the service center'}. `
        + `Bill ${b.bill.invoiceNo}: ${rupees(b.bill.total)}. `
        + (c?.paymentSettings?.payBeforePickup
          ? `Pay ${online ? 'online or ' : ''}at the counter (${methods}) to get your pickup code.`
          : `${online ? 'Pay online now, or ' : 'Pay '}at the counter when you collect it (${methods}).`),
      link: `/customer/bookings/${b._id}`,
      dedupeKey: `pay:${b._id}:${step.key}`,
      email: step.email
    });
    if (n) made.customer += 1;

    // After 3 days, let the center know too, so they can call the customer.
    if (n && step.tellCenter && c?.owner) {
      const m = await notify(c.owner, {
        type: 'payment',
        title: `Unpaid for 3 days: ${b.bookingNo}`,
        body: `${vehicle}${reg} has been ready since ${new Date(readyAt(b)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })} and the bill of ${rupees(b.bill.total)} is unpaid. The customer has been reminded.`,
        link: `/center/jobs/${b._id}`,
        dedupeKey: `pay-center:${b._id}:${step.key}`
      });
      if (m) made.center += 1;
    }
  }
  return made;
}
