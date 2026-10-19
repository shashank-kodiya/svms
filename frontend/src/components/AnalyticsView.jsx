import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/client.js';
import { Stars } from './Stars.jsx';
import { statusLabel } from '../utils/booking.js';

const isoDay = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86400000));

function Bars({ rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="small muted">{empty}</p>;
  return (
    <ul className="plain bars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="row between small"><span>{r.label}</span><b>{r.n}</b></div>
          <div className="bar" role="img" aria-label={`${r.label}: ${r.n}`}><span style={{ width: `${Math.max(2, (r.n / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

// Admin: how the platform is doing over a date range (by booking date).
export default function AnalyticsView() {
  const [range, setRange] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get('/admin/analytics', { params: range }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e)));
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const maxDay = Math.max(1, ...(d?.byDay || []).map((x) => x.n));
  return (
    <>
      <div className="card">
        <div className="row between">
          <div className="seg">
            {[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([n, t]) => (
              <button key={n} type="button" aria-pressed={range.from === daysAgo(n - 1)} onClick={() => setRange({ from: daysAgo(n - 1), to: daysAgo(0) })}>{t}</button>
            ))}
          </div>
          <div className="row align-end">
            <label className="field"><span>From</span><input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} /></label>
            <label className="field"><span>To</span><input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} /></label>
          </div>
        </div>
        {error && <div className="alert bad">{error}</div>}
      </div>

      <div className="stats">
        <div className="stat"><span className="k">Bookings</span><span className="v">{d?.bookings ?? '—'}</span><span className="s">{d ? `${d.completed} completed` : ''}</span></div>
        <div className="stat"><span className="k">Cancellation rate</span><span className="v">{d ? `${d.cancellationRate}%` : '—'}</span><span className="s">Cancelled or rejected</span></div>
        <div className="stat"><span className="k">Customer rating</span><span className="v">{d ? (d.reviews.count ? d.reviews.avg.toFixed(1) : '—') : '—'}</span><span className="s">{d ? `${d.reviews.count} reviews (${d.reviews.inRange} in this period)` : ''}</span></div>
        <div className="stat"><span className="k">Open complaints</span><span className="v">{d ? d.complaints.open + d.complaints.responded : '—'}</span><span className="s">{d ? `${d.complaints.resolved} resolved in total` : ''}</span></div>
        <div className="stat"><span className="k">New customers</span><span className="v">{d?.newCustomers ?? '—'}</span></div>
      </div>

      {d && (
        <>
          <div className="card">
            <h3>Bookings per day</h3>
            {d.byDay.length === 0 ? <p className="small muted">No bookings in this period.</p> : (
              <div className="cols" role="img" aria-label={`Bookings per day, busiest day ${maxDay}`}>
                {d.byDay.map((x) => <div key={x.date} className="col" title={`${x.date}: ${x.n}`}><span style={{ height: `${Math.max(4, (x.n / maxDay) * 100)}%` }} /></div>)}
              </div>
            )}
            <div className="row between small muted"><span>{d.from}</span><span>{d.to}</span></div>
          </div>

          <div className="grid2 top">
            <div className="card"><h3>Most booked services</h3><Bars rows={d.topServices.map((s) => ({ key: s.service, label: s.service, n: s.n }))} empty="No bookings yet." /></div>
            <div className="card"><h3>Bookings by status</h3><Bars rows={d.byStatus.map((s) => ({ key: s.status, label: statusLabel(s.status), n: s.n }))} empty="No bookings yet." /></div>
          </div>

          <div className="card">
            <h3>Top service centers</h3>
            {d.topCenters.length === 0 ? <p className="small muted">No bookings in this period.</p> : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Center</th><th className="num">Bookings</th><th className="num">Completed</th><th className="num">Cancelled</th><th>Rating</th></tr></thead>
                  <tbody>
                    {d.topCenters.map((c) => (
                      <tr key={c.centerId}><td><b>{c.name}</b>{c.city ? <span className="muted small"> · {c.city}</span> : null}</td><td className="num">{c.bookings}</td><td className="num">{c.completed}</td><td className="num">{c.cancelled}</td><td><Stars value={c.ratingAvg} count={c.ratingCount} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
