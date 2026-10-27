import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import StatusSteps from '../../components/StatusSteps.jsx';
import PhotoGrid from '../../components/PhotoGrid.jsx';
import { HealthGrid } from '../../components/HealthView.jsx';
import BillTable from '../../components/BillTable.jsx';
import PayPanel from '../../components/PayPanel.jsx';
import FeedbackPanel from '../../components/FeedbackPanel.jsx';
import api, { errorMessage, downloadFile } from '../../api/client.js';
import { getSocket } from '../../api/socket.js';
import PaymentMethods from '../../components/PaymentMethods.jsx';
import { statusLabel, statusTone, inr, niceDate, niceTime, URGENCY_TONE, REC_STATUS } from '../../utils/booking.js';

const UPDATE_TEXT = {
  status: 'The center updated the status.',
  inspection: 'The inspection results were updated.',
  recommendation: 'The center recommended extra work. Please review it below.',
  photo: 'The center added a photo.',
  mechanic: 'A mechanic was assigned.',
  bill: 'Your bill is ready. You can see it below.',
  payment: 'Your payment was updated. See the bill below.',
  completed: 'Vehicle handed over. Thank you!'
};

export default function BookingDetail() {
  const { id } = useParams();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [codeMsg, setCodeMsg] = useState(null);

  const load = useCallback(() => {
    api.get(`/bookings/${id}`).then(({ data }) => setB(data)).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Live updates from the workshop.
  useEffect(() => {
    const socket = getSocket();
    const onChange = (e) => {
      if (e.id !== id) return;
      setLive(UPDATE_TEXT[e.kind] || (e.kind === 'accepted' ? 'The center confirmed your booking.' : 'This booking was updated.'));
      load();
    };
    socket.on('booking:changed', onChange);
    return () => socket.off('booking:changed', onChange);
  }, [id, load]);

  const decide = async (recId, decision) => {
    setBusy(recId);
    setMsg(null);
    try {
      const { data } = await api.patch(`/bookings/${id}/recommendations/${recId}`, { decision });
      setB(data);
      setMsg({ tone: decision === 'approved' ? 'good' : 'warn', text: decision === 'approved' ? 'Approved. The center can now do this repair.' : 'Rejected. The center will not do this repair.' });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const newCode = async () => {
    setCodeMsg(null);
    try {
      const { data } = await api.post(`/bookings/${id}/pickup-code`);
      setB((x) => ({ ...x, pickup: { ...x.pickup, otp: data.otp } }));
      setCodeMsg({ tone: 'good', text: data.message });
    } catch (err) {
      setCodeMsg({ tone: 'bad', text: errorMessage(err) });
    }
  };
  const pdf = () => downloadFile(`/bookings/${id}/invoice.pdf`, `${b.bill.invoiceNo}.pdf`).catch((e) => setCodeMsg({ tone: 'bad', text: errorMessage(e) }));

  if (error && !b) return <Layout title="Booking"><div className="alert bad">{error}</div><Link to="/customer/bookings">Back to My Bookings</Link></Layout>;
  if (!b) return <Layout title="Booking"><p className="muted">Loading…</p></Layout>;

  const waiting = b.recommendations.filter((r) => r.status === 'awaiting');
  const approvedTotal = b.recommendations.filter((r) => r.status === 'approved').reduce((s, r) => s + r.partsCost + r.labourCost, 0);
  const canDecide = ['inspection', 'in_progress'].includes(b.status);

  return (
    <Layout
      title={`${b.service.name} · ${b.vehicleSnapshot?.brand} ${b.vehicleSnapshot?.model}`}
      subtitle={`${b.bookingNo} · ${niceDate(b.date)} at ${niceTime(b.slot)} · ${b.center?.name}`}
      actions={<div className="row"><Plate reg={b.vehicleSnapshot?.regNumber} /><span className={`chip ${statusTone(b.status)}`}>{statusLabel(b.status)}</span></div>}
    >
      {live && <div className="alert info" role="status">{live}</div>}
      <div className="card">
        <StatusSteps status={b.status} />
        <div className="small">{b.center?.address}, {b.center?.city} · {b.center?.phone}{b.mechanic ? ` · Mechanic: ${b.mechanic.name}` : ''}</div>
        {b.status === 'completed' && <div className="alert good">Service completed. You collected your vehicle on {new Date(b.pickup?.collectedAt || b.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.</div>}
        {['pending', 'accepted'].includes(b.status) && <div className="small muted">To reschedule or cancel, go to <Link to="/customer/bookings">My Bookings</Link>.</div>}
        {['pending', 'accepted'].includes(b.status) && (
          <div className="tow-shortcut small">
            🚨 Stuck on the way to {b.center?.name || 'the center'}? <Link className="btn sm" to={`/customer/towing?booking=${b._id}`}>Get towing help</Link>
          </div>
        )}
      </div>

      {b.status === 'ready_for_pickup' && (
        <div className="card">
          <h3>Your vehicle is ready to collect</h3>
          {b.pickupLocked ? (
            <div className="otp-box locked">
              <span className="otp" aria-hidden="true">🔒</span>
              <span><b>Pay the bill to get your pickup code</b></span>
              <span className="small">{b.center?.name} releases vehicles after payment. Amount: <b>{b.bill ? `₹${b.bill.total.toLocaleString('en-IN')}` : '—'}</b>. Pay online below, or pay at the counter; the code appears here as soon as the payment is confirmed.</span>
            </div>
          ) : (
            <>
              <div className="otp-box">
                <span className="small">Show this pickup code at {b.center?.name}</span>
                <span className="otp" aria-label={`Pickup code ${b.pickup?.otp?.split('').join(' ')}`}>{b.pickup?.otp || '----'}</span>
                <span className="small">Amount to pay: <b>{b.bill ? `₹${b.bill.total.toLocaleString('en-IN')}` : '—'}</b> {b.bill?.payment?.status === 'paid' ? '(paid)' : '(pay online below, or cash, card or UPI at the counter)'}</span>
              </div>
              <p className="small muted">Only give this code to the center when you collect the vehicle. Never share it on a phone call.</p>
              <div className="row"><button className="btn sm" onClick={newCode}>Get a new code</button></div>
            </>
          )}
          {codeMsg && <div className={`alert ${codeMsg.tone}`}>{codeMsg.text}</div>}
        </div>
      )}

      {b.bill && b.bill.payment?.status !== 'paid' && ['quality_check', 'ready_for_pickup'].includes(b.status) && (
        <PayPanel key={b.updatedAt} bookingId={b._id} onChanged={load} />
      )}

      {b.bill && (
        <div className="card">
          <div className="row between"><h3>Bill</h3><button className="btn sm" onClick={pdf}>Download invoice PDF</button></div>
          <BillTable bill={b.bill} bookingId={b._id} />
          <PaymentMethods methods={b.paymentMethods} label={`${b.center?.name || 'The center'} accepts`} />
          {b.status !== 'ready_for_pickup' && codeMsg && <div className={`alert ${codeMsg.tone}`}>{codeMsg.text}</div>}
        </div>
      )}

      {['vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup', 'completed'].includes(b.status) && (
        <FeedbackPanel bookingId={b._id} status={b.status} />
      )}

      {(b.recommendations.length > 0 || canDecide) && (
        <div className="card">
          <div className="row between">
            <h3>Extra repairs recommended</h3>
            {approvedTotal > 0 && <span className="small">You approved: <b>{inr(approvedTotal)}</b> (parts + labour, GST extra)</span>}
          </div>
          {waiting.length > 0 && canDecide && <div className="alert warn">{waiting.length} repair{waiting.length > 1 ? 's need' : ' needs'} your decision. Nothing extra is done without your approval.</div>}
          {b.recommendations.length === 0 && <p className="small muted">The center hasn't recommended any extra work.</p>}
          <div className="list">
            {b.recommendations.map((r) => (
              <div key={r._id} className={`rec ${r.urgency}`}>
                <div className="row between"><b>{r.problem}</b><span className={`chip ${URGENCY_TONE[r.urgency]}`}>{r.urgency} urgency</span></div>
                <div className="small">{r.reason}</div>
                <div className="row between">
                  <span className="small">Parts {inr(r.partsCost)} + labour {inr(r.labourCost)} = <b>{inr(r.partsCost + r.labourCost)}</b></span>
                  {r.status === 'awaiting' && canDecide ? (
                    <div className="row">
                      <button className="btn bad sm" disabled={busy === r._id} onClick={() => decide(r._id, 'rejected')}>Reject</button>
                      <button className="btn good sm" disabled={busy === r._id} onClick={() => decide(r._id, 'approved')}>Approve</button>
                    </div>
                  ) : (
                    <div className="row"><span className={`chip ${REC_STATUS[r.status].tone}`}>{r.status === 'awaiting' ? 'Waiting' : REC_STATUS[r.status].label}</span>{r.done && <span className="chip info">Done</span>}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {msg && <div className={`alert ${msg.tone}`}>{msg.text}</div>}
        </div>
      )}

      <div className="grid2 top">
        <div className="card">
          <h3>Vehicle health check</h3>
          {b.health ? <HealthGrid record={b.health} /> : <p className="small muted">The center records this during inspection.</p>}
          <Link className="small" to={`/customer/vehicles/${b.vehicle?._id}`}>See this vehicle's full health history</Link>
        </div>
        <div className="card">
          <h3>Photos from the workshop</h3>
          {b.photos.length ? <PhotoGrid photos={b.photos} /> : <p className="small muted">No photos yet.</p>}
        </div>
      </div>

      <div className="card">
        <h3>Timeline</h3>
        <ul className="plain">
          {[...b.history].reverse().map((h, i) => (
            <li key={i} className="row between small">
              <span><span className={`chip ${statusTone(h.status)}`}>{h.status === 'pending' ? 'Booked' : statusLabel(h.status)}</span>{h.note ? ` ${h.note}` : ''}</span>
              <span className="muted">{new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
