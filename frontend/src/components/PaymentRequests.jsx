import { useEffect, useState, useCallback } from 'react';
import Notice from './Notice.jsx';
import api, { errorMessage } from '../api/client.js';
import { getSocket } from '../api/socket.js';
import { inr2 } from '../utils/booking.js';

// Service center: online payments the customers say they made. Check your bank or UPI app for the
// amount and reference, then Confirm (the bill becomes Paid) or Reject with a reason.
// Pass bookingId to show only one job's payment.
export default function PaymentRequests({ bookingId, onChanged }) {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    api.get('/center/payments', { params: { status: 'submitted' } })
      .then(({ data }) => setList(bookingId ? data.filter((p) => p.booking?._id === bookingId) : data))
      .catch((e) => setMsg({ tone: 'bad', text: errorMessage(e) }));
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const socket = getSocket();
    const onChange = (e) => { if (e.kind === 'payment') load(); };
    socket.on('booking:changed', onChange);
    return () => socket.off('booking:changed', onChange);
  }, [load]);

  const act = async (p, action, body, ok) => {
    setBusy(p._id);
    setMsg(null);
    try {
      await api.patch(`/center/payments/${p._id}/${action}`, body);
      setMsg({ tone: 'good', text: ok });
      setRejecting(null);
      setReason('');
      load();
      onChanged?.();
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  if (!list) return null;
  if (list.length === 0 && !msg) return bookingId ? null : <p className="small muted">No online payments waiting for you.</p>;

  return (
    <div className="list">
      {list.map((p) => (
        <div key={p._id} className="rec Medium">
          <div className="row between">
            <b>{inr2(p.amount)} · invoice <span className="mono">{p.invoiceNo}</span></b>
            <span className="chip warn">Waiting for you</span>
          </div>
          <div className="small">{p.customer?.name} · {p.booking?.vehicleSnapshot?.regNumber} · reference <span className="mono">{p.reference}</span></div>
          <div className="small muted">Check that {inr2(p.amount)} with this reference is in your account before you confirm.</div>
          {rejecting === p._id ? (
            <div className="row align-end">
              <label className="field grow"><span>Reason for the customer</span><input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Amount not received" /></label>
              <button className="btn bad sm" disabled={busy === p._id} onClick={() => act(p, 'reject', { reason }, 'Payment rejected. The customer has been told.')}>Reject payment</button>
              <button className="btn sm" onClick={() => setRejecting(null)}>Cancel</button>
            </div>
          ) : (
            <div className="row">
              <button className="btn good sm" disabled={busy === p._id} onClick={() => act(p, 'confirm', undefined, 'Payment confirmed. The bill is now paid.')}>Confirm received</button>
              <button className="btn bad sm" onClick={() => setRejecting(p._id)}>Reject…</button>
            </div>
          )}
        </div>
      ))}
      <Notice msg={msg} />
    </div>
  );
}
