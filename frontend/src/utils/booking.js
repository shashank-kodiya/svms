// Labels and colours for booking statuses (Phase 5 uses the workshop ones).
export const STATUS = {
  pending: { label: 'Waiting for center', tone: 'warn' },
  accepted: { label: 'Confirmed', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: '' },
  vehicle_received: { label: 'Vehicle received', tone: 'info' },
  inspection: { label: 'Inspection', tone: 'info' },
  in_progress: { label: 'Service in progress', tone: 'info' },
  quality_check: { label: 'Quality check', tone: 'info' },
  ready_for_pickup: { label: 'Ready for pickup', tone: 'good' },
  completed: { label: 'Completed', tone: 'good' }
};

export const statusLabel = (s) => STATUS[s]?.label || s;
export const statusTone = (s) => STATUS[s]?.tone ?? '';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export const hrs = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

// 'YYYY-MM-DD' in the browser's local time (India for our users)
export function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// '2026-10-19' -> 'Mon, 19 Oct 2026'
export const niceDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// '14:00' -> '2:00 PM'
export function niceTime(t) {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---- Phase 5 ----
export const WORKSHOP_STEPS = [
  { key: 'pending', label: 'Booked' },
  { key: 'accepted', label: 'Confirmed' },
  { key: 'vehicle_received', label: 'Vehicle received' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'in_progress', label: 'Service in progress' },
  { key: 'quality_check', label: 'Quality check' },
  { key: 'ready_for_pickup', label: 'Ready for pickup' },
  { key: 'completed', label: 'Completed' }
];

// What the center's "next step" button says for each status.
export const NEXT_STEP = {
  accepted: { to: 'vehicle_received', label: 'Mark vehicle received' },
  vehicle_received: { to: 'inspection', label: 'Start inspection' },
  inspection: { to: 'in_progress', label: 'Start the work' },
  in_progress: { to: 'quality_check', label: 'Move to quality check' },
  quality_check: { to: 'ready_for_pickup', label: 'Mark ready for pickup' }
};

export const HEALTH_PARTS = [
  ['engine', 'Engine'], ['brakes', 'Brakes'], ['tyres', 'Tyres'], ['battery', 'Battery'], ['engineOil', 'Engine oil']
];
export const HEALTH_VALUES = {
  good: { label: 'Good', tone: 'good' },
  needs_attention: { label: 'Needs attention', tone: 'warn' },
  replace_soon: { label: 'Replace soon', tone: 'warn' },
  critical: { label: 'Critical', tone: 'bad' },
  replaced: { label: 'Replaced', tone: 'info' },
  changed: { label: 'Changed', tone: 'info' }
};
export const URGENCY_TONE = { High: 'bad', Medium: 'warn', Low: 'info' };
export const REC_STATUS = {
  awaiting: { label: 'Waiting for customer', tone: 'warn' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Rejected', tone: 'bad' }
};

// ---- Phase 6 ----
export const PAY_METHODS = { cash: 'Cash', card: 'Card', upi_counter: 'UPI at the counter', upi_online: 'UPI (online)' };
export const GST_RATES = [0, 5, 12, 18, 28];
// ₹1,234.50 (always 2 decimals, for bills)
export const inr2 = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
