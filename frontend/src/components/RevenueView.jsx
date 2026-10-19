import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/client.js';
import { inr, PAY_METHODS } from '../utils/booking.js';

const isoDay = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const daysAgo = (n) => isoDay(new Date(Date.now() - n * 86400000));

// A small bar list: the widest bar is the biggest value.
function Bars({ rows, label, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  if (!rows.length) return <p className="small muted">{empty}</p>;
  return (
    <ul className="plain bars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="row between small"><span>{label(r)}</span><b>{inr(r.total)}</b></div>
          <div className="bar" role="img" aria-label={`${label(r)}: ${inr(r.total)}`}><span style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

// Revenue = bills that are paid. Used by the service center (own money) and the admin (whole platform).
export default function RevenueView({ url, admin = false }) {
  const [range, setRange] = useState({ from: daysAgo(29), to: daysAgo(0) });
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get(url, { params: range }).then(({ data }) => setD(data)).catch((e) => setError(errorMessage(e)));
  }, [url, range]);
  useEffect(() => { load(); }, [load]);

  const preset = (n) => setRange({ from: daysAgo(n - 1), to: daysAgo(0) });

  return (
    <>
      <div className="card">
        <div className="row between">
          <div className="seg">
            {[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([n, t]) => (
              <button key={n} type="button" aria-pressed={range.from === daysAgo(n - 1)} onClick={() => preset(n)}>{t}</button>
            ))}
          </div>
          <div className="row align-end">
            <label className="field"><span>From</span><input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} /></label>
            <label className="field"><span>To</span><input type="date" value={range.to} min={range.from} max={daysAgo(0)} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} /></label>
          </div>
        </div>
        {error && <div className="alert bad">{error}</div>}
      </div>

      <div className="stats">
        <div className="stat"><span className="k">Revenue (paid)</span><span className="v">{d ? inr(d.total) : '—'}</span><span className="s">GST included</span></div>
        <div className="stat"><span className="k">Paid invoices</span><span className="v">{d?.count ?? '—'}</span></div>
        <div className="stat"><span className="k">Average bill</span><span className="v">{d ? inr(d.average) : '—'}</span></div>
        <div className="stat"><span className="k">Billed, not paid yet</span><span className="v">{d ? inr(d.outstanding.total) : '—'}</span><span className="s">{d ? `${d.outstanding.count} invoice${d.outstanding.count === 1 ? '' : 's'}` : ''}</span></div>
      </div>

      {d && (
        <div className="grid2 top">
          <div className="card">
            <h3>By payment method</h3>
            <Bars rows={d.byMethod.map((r) => ({ ...r, key: r.method }))} label={(r) => `${PAY_METHODS[r.method] || r.method} · ${r.count}`} empty="No payments in this period." />
          </div>
          <div className="card">
            <h3>{admin ? 'By service center' : 'By service'}</h3>
            {admin
              ? <Bars rows={d.byCenter.map((r) => ({ ...r, key: r.centerId }))} label={(r) => `${r.name}${r.city ? `, ${r.city}` : ''} · ${r.count}`} empty="No payments in this period." />
              : <Bars rows={d.byService.map((r) => ({ ...r, key: r.service }))} label={(r) => `${r.service} · ${r.count}`} empty="No payments in this period." />}
          </div>
        </div>
      )}

      {d && (
        <div className="card">
          <h3>Day by day</h3>
          {d.byDay.length === 0 ? <p className="small muted">No payments in this period.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th className="num">Invoices</th><th className="num">Revenue</th></tr></thead>
                <tbody>
                  {[...d.byDay].reverse().map((r) => (
                    <tr key={r.date}><td>{new Date(`${r.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td className="num">{r.count}</td><td className="num">{inr(r.total)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
