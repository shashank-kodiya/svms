import { niceTime } from '../utils/booking.js';

// Grid of one-hour slots. Full or past slots can't be picked.
export default function SlotPicker({ availability, value, onChange }) {
  if (!availability) return <p className="muted small">Loading slots…</p>;
  if (!availability.open) return <p className="empty small">{availability.reason}.</p>;
  return (
    <div className="slots">
      {availability.slots.map((s) => {
        const disabled = s.remaining <= 0;
        return (
          <button
            key={s.start}
            type="button"
            className="slot pick"
            aria-pressed={value === s.start}
            disabled={disabled}
            onClick={() => onChange(s.start)}
          >
            <b>{niceTime(s.start)}</b>
            <small>{s.past ? 'Passed' : disabled ? 'Full' : `${s.remaining} of ${s.capacity} free`}</small>
          </button>
        );
      })}
    </div>
  );
}
