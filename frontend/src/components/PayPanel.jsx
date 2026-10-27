import { useEffect, useState, useCallback } from 'react';
import Notice from './Notice.jsx';
import PaymentMethods from './PaymentMethods.jsx';
import api, { errorMessage } from '../api/client.js';
import { inr2 } from '../utils/booking.js';

// Customer: pay the final bill by UPI (demo). Scan the QR or open the link in a UPI app,
// then type the 12-digit reference number from the payment app. The service center confirms it.
export default function PayPanel({ bookingId, onChanged }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/bookings/${bookingId}/pay`).then(({ data }) => { setInfo(data); setError(''); }).catch((e) => setError(errorMessage(e)));
  }, [bookingId]);
  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(info.upiId); setMsg({ tone: 'good', text: 'UPI ID copied.' }); }
    catch { setMsg({ tone: 'warn', text: `Copy this UPI ID: ${info.upiId}` }); }
  };

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { data } = await api.post(`/bookings/${bookingId}/payments`, { reference });
      setReference('');
      setMsg({ tone: 'good', text: data.message });
      load();
      onChanged?.();
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (error) return null; // for example "already paid": nothing to show
  if (!info) return null;
  const waiting = info.latest?.status === 'submitted';
  const rejected = info.latest?.status === 'rejected';

  return (
    <div className="card">
      <h3>Pay online (UPI)</h3>
      <PaymentMethods methods={info.methods} label="This center accepts" />
      {!info.available ? (
        <p className="small muted">{info.message} Amount to pay: <b>{inr2(info.amount)}</b>.</p>
      ) : (
        <>
          <p className="small">Amount: <b>{inr2(info.amount)}</b> · Invoice <span className="mono">{info.invoiceNo}</span>. This is a demo: no money moves through this website.</p>
          <div className="pay-grid">
            {info.centerQr && (
              <div className="pay-qr">
                <img src={info.centerQr} alt={`${info.payeeName} UPI QR code`} width={200} height={200} className="center-upi-qr" />
                <span className="small muted">{info.payeeName}'s QR · enter <b>{inr2(info.amount)}</b> in your app</span>
              </div>
            )}
            <div className="pay-qr">
              <img src={info.qr} alt={`UPI QR code to pay ${inr2(info.amount)} to ${info.payeeName}`} width={200} height={200} />
              {info.centerQr && <span className="small muted">Or scan this one: amount already filled in</span>}
              <a className="btn sm" href={info.link}>Open in UPI app</a>
            </div>
            <div className="list">
              <div className="small">Pay to <b>{info.payeeName}</b></div>
              <div className="row"><span className="mono">{info.upiId}</span><button type="button" className="btn ghost sm" onClick={copy}>Copy</button></div>
              {rejected && <div className="alert bad">The center did not accept your last payment: {info.latest.rejectReason}. You can send it again.</div>}
              {waiting ? (
                <div className="alert info">Payment sent (reference <span className="mono">{info.latest.reference}</span>). Waiting for the service center to confirm.</div>
              ) : (
                <form className="row align-end" onSubmit={send} noValidate>
                  <label className="field grow"><span>UPI reference number (UTR) after paying</span>
                    <input inputMode="numeric" maxLength={12} value={reference} onChange={(e) => setReference(e.target.value.replace(/\D/g, ''))} placeholder="12 digits" />
                  </label>
                  <button className="btn primary" disabled={busy}>I have paid</button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
      <Notice msg={msg} />
    </div>
  );
}
