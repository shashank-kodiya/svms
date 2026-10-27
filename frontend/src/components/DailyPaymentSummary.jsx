import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/client.js';
import { getSocket } from '../api/socket.js';
import { inr, localDate, PAY_METHODS } from '../utils/booking.js';

const shift = (date, days) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};
const longDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
const clock = (at) => new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

// End-of-day settlement for a service center: money collected on one day by method (cash, UPI, card),
// every payment that day, and what is still pending. The day can be changed to settle a past day.
export default function DailyPaymentSummary() {
  const today = localDate();
  const [date, setDate] = useState(today);
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get('/center/payments/summary', { params: { date } }).then(({ data }) => setS(data)).catch((e) => setError(errorMessage(e)));
  }, [date]);
  useEffect(() => { setS(null); load(); }, [load]);

  // Live: a payment confirmed or a bill marked paid updates today's totals without refreshing.
  useEffect(() => {
    if (date !== today) return undefined;
    const socket = getSocket();
    const onChange = () => load();
    socket.on('booking:changed', onChange);
    return () => socket.off('booking:changed', onChange);
  }, [date, today, load]);

  const downloadCsv = () => {
    const rows = [['Time', 'Invoice', 'Booking', 'Customer', 'Vehicle', 'Service', 'Method', 'Reference', 'Amount']]
      .concat(s.payments.map((p) => [clock(p.at), p.invoiceNo, p.bookingNo, p.customer, p.regNumber, p.service, PAY_METHODS[p.method] || p.method, p.reference, p.amount]))
      .concat([[], ['', '', '', '', '', '', '', 'Total', s.total]]);
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `payments-${date}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const m = s?.byMethod;
  const upi = m ? { total: m.upi_counter.total + m.upi_online.total, count: m.upi_counter.count + m.upi_online.count } : null;
  const diff = s ? s.total - s.yesterdayTotal : 0;

  return (
    <div className="card center-payments__card daily-summary">
      <div className="row between">
        <h3>{date === today ? "Today's collection" : 'Collection'}</h3>
        <div className="row daily-summary__nav">
          <button type="button" className="btn sm" onClick={() => setDate(shift(date, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Day" />
          <button type="button" className="btn sm" onClick={() => setDate(shift(date, 1))} disabled={date >= today} aria-label="Next day">›</button>
          {date !== today && <button type="button" className="btn sm" onClick={() => setDate(today)}>Today</button>}
        </div>
      </div>
      <p className="small muted">{longDate(date)} · bills marked paid this day (India time), for end-of-day settlement.</p>
      {error && <div className="alert bad">{error}</div>}

      {!s ? <p className="muted small">Loading…</p> : (
        <>
          <div className="stats">
            <div className="stat daily-summary__total">
              <span className="k">Total collected</span>
              <span className="v">{inr(s.total)}</span>
              <span className="s">
                {s.count} payment{s.count === 1 ? '' : 's'}
                {(s.total > 0 || s.yesterdayTotal > 0) && (
                  <> · <span className={diff >= 0 ? 'good-text' : 'bad-text'}>{diff >= 0 ? '▲' : '▼'} {inr(Math.abs(diff))}</span> vs previous day</>
                )}
              </span>
            </div>
            <div className="stat"><span className="k">₹ Cash</span><span className="v">{inr(m.cash.total)}</span><span className="s">{m.cash.count} payment{m.cash.count === 1 ? '' : 's'} · count the drawer</span></div>
            <div className="stat">
              <span className="k">⚡ UPI</span><span className="v">{inr(upi.total)}</span>
              <span className="s">Counter {inr(m.upi_counter.total)} · Online {inr(m.upi_online.total)}</span>
            </div>
            <div className="stat"><span className="k">💳 Card</span><span className="v">{inr(m.card.total)}</span><span className="s">{m.card.count} payment{m.card.count === 1 ? '' : 's'} · match the POS slip</span></div>
          </div>

          {(s.awaitingConfirmation.count > 0 || s.unpaid.count > 0) && (
            <div className="row small daily-summary__pending">
              {s.awaitingConfirmation.count > 0 && (
                <span className="chip warn">{s.awaitingConfirmation.count} online payment{s.awaitingConfirmation.count === 1 ? '' : 's'} to confirm · {inr(s.awaitingConfirmation.total)}</span>
              )}
              {s.unpaid.count > 0 && <span className="chip">{s.unpaid.count} unpaid bill{s.unpaid.count === 1 ? '' : 's'} · {inr(s.unpaid.total)}</span>}
            </div>
          )}

          {s.payments.length === 0 ? (
            <div className="empty small">No payments recorded on this day.</div>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Time</th><th>Invoice</th><th>Customer</th><th>Vehicle</th><th>Method</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {s.payments.map((p) => (
                      <tr key={p.bookingId}>
                        <td>{clock(p.at)}</td>
                        <td><Link className="mono" to={`/center/jobs/${p.bookingId}`}>{p.invoiceNo}</Link><div className="small muted">{p.service}</div></td>
                        <td>{p.customer}</td>
                        <td className="mono">{p.regNumber}</td>
                        <td>{PAY_METHODS[p.method] || p.method}{p.reference && <div className="small muted mono">Ref {p.reference}</div>}</td>
                        <td className="num">{inr(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><th colSpan={5}>Total</th><th className="num">{inr(s.total)}</th></tr></tfoot>
                </table>
              </div>
              <div className="row">
                <button type="button" className="btn sm" onClick={downloadCsv}>Download CSV</button>
                <button type="button" className="btn sm" onClick={() => window.print()}>Print</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
