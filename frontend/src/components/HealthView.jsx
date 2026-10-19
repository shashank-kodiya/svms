import { HEALTH_PARTS, HEALTH_VALUES } from '../utils/booking.js';
import { fmtKm } from '../utils/format.js';

export function HealthChip({ value }) {
  const v = HEALTH_VALUES[value];
  return v ? <span className={`chip ${v.tone}`}>{v.label}</span> : <span className="muted">—</span>;
}

// One inspection as a compact grid of parts.
export function HealthGrid({ record }) {
  if (!record) return <p className="small muted">No inspection recorded yet.</p>;
  return (
    <div className="list">
      <div className="health-grid">
        {HEALTH_PARTS.map(([k, label]) => (
          <div key={k} className="health-cell"><span className="small muted">{label}</span><HealthChip value={record.items?.[k]} /></div>
        ))}
      </div>
      <div className="small muted">Checked {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}{record.km != null ? ` at ${fmtKm(record.km)}` : ''}{record.notes ? ` · ${record.notes}` : ''}</div>
    </div>
  );
}

// Several inspections side by side, oldest first, so changes over time are easy to see.
export function HealthHistory({ records }) {
  if (!records?.length) return <p className="empty small">No inspections yet. Each service adds a health check here.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Part</th>
            {records.map((r) => (
              <th key={r._id}>{new Date(`${r.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}<div className="th-sub">{r.center?.name || ''}{r.km != null ? ` · ${fmtKm(r.km)}` : ''}</div></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HEALTH_PARTS.map(([k, label]) => (
            <tr key={k}><td><b>{label}</b></td>{records.map((r) => <td key={r._id}><HealthChip value={r.items?.[k]} /></td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
