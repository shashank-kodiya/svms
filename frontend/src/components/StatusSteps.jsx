import { WORKSHOP_STEPS, statusLabel } from '../utils/booking.js';

// Progress bar of the booking's journey. Rejected or cancelled bookings just show their status.
export default function StatusSteps({ status }) {
  if (status === 'rejected' || status === 'cancelled') {
    return <div className="steps-off"><span className={`chip ${status === 'rejected' ? 'bad' : ''}`}>{statusLabel(status)}</span></div>;
  }
  const at = WORKSHOP_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="steps" aria-label="Booking progress">
      {WORKSHOP_STEPS.map((s, i) => (
        <li key={s.key} className={i < at || status === 'completed' ? 'done' : i === at ? 'cur' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="dot" aria-hidden="true" />
          <span className="lbl">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
