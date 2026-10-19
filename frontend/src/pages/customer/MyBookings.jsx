import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import SlotPicker from '../../components/SlotPicker.jsx';
import api, { errorMessage } from '../../api/client.js';
import { getSocket } from '../../api/socket.js';
import { statusLabel, statusTone, inr, localDate, niceDate, niceTime } from '../../utils/booking.js';

const CHANGEABLE = ['pending', 'accepted'];
const ACTIVE = ['pending', 'accepted', 'vehicle_received', 'inspection', 'in_progress', 'quality_check', 'ready_for_pickup'];

function BookingCard({ b, onChanged }) {
  const [mode, setMode] = useState(null); // 'cancel' | 'reschedule'
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(b.date);
  const [avail, setAvail] = useState(null);
  const [slot, setSlot] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== 'reschedule') return;
    setAvail(null);
    setSlot(null);
    api.get(`/bookings/availability/${b.center._id}`, { params: { date } })
      .then(({ data }) => setAvail(data))
      .catch((e) => setAvail({ open: false, reason: errorMessage(e), slots: [] }));
  }, [mode, date, b.center._id]);

  const act = async (fn, ok) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMode(null);
      onChanged(ok);
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="row between">
        <div>
          <h3>{b.service.name} <span className="muted small mono">{b.bookingNo}</span></h3>
          <div className="small">{niceDate(b.date)} at {niceTime(b.slot)} · {b.center?.name}</div>
          <div className="small muted">{b.center?.address}, {b.center?.city} · {b.center?.phone}</div>
        </div>
        <div className="row">
          <Plate reg={b.vehicleSnapshot?.regNumber || b.vehicle?.regNumber} />
          <span className={`chip ${statusTone(b.status)}`}>{statusLabel(b.status)}</span>
        </div>
      </div>
      <div className="small">{b.bill ? <>Bill <b>{inr(b.bill.total)}</b></> : <>From {inr(b.service.price)}</>} · {b.vehicleSnapshot?.brand} {b.vehicleSnapshot?.model}{b.problem ? ` · “${b.problem}”` : ''}</div>
      {(b.recommendations || []).some((r) => r.status === 'awaiting') && (
        <div className="alert warn small"><span><b>The center recommends extra repairs.</b> Nothing extra is done until you decide. <Link to={`/customer/bookings/${b._id}`}>Review now</Link></span></div>
      )}
      {b.status === 'ready_for_pickup' && (
        <div className="alert good small"><span><b>Your vehicle is ready.</b> <Link to={`/customer/bookings/${b._id}`}>Open to see your pickup code and bill</Link></span></div>
      )}
      <div><Link className="btn sm" to={`/customer/bookings/${b._id}`}>{b.bill ? 'View details & bill' : 'View details & progress'}</Link></div>
      {b.status === 'rejected' && b.rejectReason && <div className="alert bad small">Reason from the center: {b.rejectReason}</div>}

      {CHANGEABLE.includes(b.status) && !mode && (
        <div className="row">
          <button className="btn sm" onClick={() => setMode('reschedule')}>Reschedule</button>
          <button className="btn sm ghost" onClick={() => setMode('cancel')}>Cancel booking</button>
        </div>
      )}

      {mode === 'cancel' && (
        <div className="item">
          <label className="field"><span>Reason (optional)</span><input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Plans changed" /></label>
          <div className="row">
            <button className="btn bad sm" disabled={busy} onClick={() => act(() => api.patch(`/bookings/${b._id}/cancel`, { reason }), `Booking ${b.bookingNo} cancelled. The slot has been released.`)}>Yes, cancel it</button>
            <button className="btn sm" onClick={() => setMode(null)}>Keep booking</button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className="item">
          <label className="field" style={{ maxWidth: 220 }}><span>New date</span><input type="date" min={localDate()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <SlotPicker availability={avail} value={slot} onChange={setSlot} />
          <div className="row">
            <button className="btn primary sm" disabled={!slot || busy} onClick={() => act(() => api.patch(`/bookings/${b._id}/reschedule`, { date, slot }), `Booking moved to ${niceDate(date)} at ${niceTime(slot)}. The center will confirm again.`)}>Move booking</button>
            <button className="btn sm" onClick={() => setMode(null)}>Back</button>
          </div>
          <p className="small muted">The center needs to confirm the new time again.</p>
        </div>
      )}
      {msg && <div className={`alert ${msg.tone}`}>{msg.text}</div>}
    </div>
  );
}

export default function MyBookings() {
  const location = useLocation();
  const [list, setList] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [msg, setMsg] = useState(location.state?.message || '');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/bookings').then(({ data }) => setList(data)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  // Live: the center accepted / rejected one of my bookings.
  useEffect(() => {
    const socket = getSocket();
    const onChange = (e) => {
      load();
      if (e.kind === 'accepted') setMsg(`Booking ${e.bookingNo} was confirmed by the center.`);
      if (e.kind === 'rejected') setMsg(`Booking ${e.bookingNo} was rejected by the center.`);
      if (e.kind === 'status') setMsg(`Booking ${e.bookingNo}: the center updated the status.`);
      if (e.kind === 'recommendation') setMsg(`Booking ${e.bookingNo}: the center recommended extra work. Open the booking to review it.`);
    };
    socket.on('booking:changed', onChange);
    return () => socket.off('booking:changed', onChange);
  }, [load]);

  const today = localDate();
  const upcoming = (list || []).filter((b) => ACTIVE.includes(b.status) && b.date >= today).sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
  const past = (list || []).filter((b) => !upcoming.includes(b));
  const shown = tab === 'upcoming' ? upcoming : past;

  return (
    <Layout title="My Bookings" subtitle="Track, reschedule or cancel your service bookings." actions={<Link className="btn primary" to="/customer/book">Book a service</Link>}>
      {msg && <div className="alert good" role="status">{msg}</div>}
      {error && <div className="alert bad">{error}</div>}
      <div className="seg">
        <button type="button" aria-pressed={tab === 'upcoming'} onClick={() => setTab('upcoming')}>Upcoming ({upcoming.length})</button>
        <button type="button" aria-pressed={tab === 'past'} onClick={() => setTab('past')}>Past & cancelled ({past.length})</button>
      </div>
      {list === null ? <p className="muted">Loading…</p> : shown.length === 0 ? (
        <div className="empty">{tab === 'upcoming' ? <>No upcoming bookings. <Link to="/customer/book">Book a service</Link></> : 'Nothing here yet.'}</div>
      ) : shown.map((b) => <BookingCard key={b._id} b={b} onChanged={(text) => { setMsg(text); load(); }} />)}
    </Layout>
  );
}
