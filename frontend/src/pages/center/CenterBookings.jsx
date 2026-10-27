import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import VehicleThumb, { vehiclePhoto } from '../../components/VehicleThumb.jsx';
import api, { errorMessage } from '../../api/client.js';
import { getSocket } from '../../api/socket.js';
import { statusLabel, statusTone, inr, localDate, niceDate, niceTime } from '../../utils/booking.js';

function RequestRow({ b, onDone }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (url, body, text) => {
    setBusy(true);
    setErr('');
    try {
      await api.patch(url, body);
      onDone(text);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="item">
      <div className="row between request-row">
        <VehicleThumb booking={b} size={84} />
        <div className="grow">
          <b>{niceDate(b.date)} · {niceTime(b.slot)}</b> <span className="muted small mono">{b.bookingNo}</span>
          <div className="small">{b.service.name} · from {inr(b.service.price)}</div>
          <div className="small muted">{b.customer?.name} · {b.customer?.phone || b.customer?.email} · {b.vehicleSnapshot?.brand} {b.vehicleSnapshot?.model}</div>
          {b.problem && <div className="small">Customer says: “{b.problem}”</div>}
        </div>
        <Plate reg={b.vehicleSnapshot?.regNumber} />
      </div>
      {rejecting ? (
        <div className="row align-end">
          <label className="field grow"><span>Reason for the customer</span><input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No bay free that day, please pick another date" /></label>
          <button className="btn bad sm" disabled={busy} onClick={() => run(`/center/bookings/${b._id}/reject`, { reason }, `Booking ${b.bookingNo} rejected. The slot is free again.`)}>Reject booking</button>
          <button className="btn sm" onClick={() => setRejecting(false)}>Back</button>
        </div>
      ) : (
        <div className="row">
          <button className="btn good sm" disabled={busy} onClick={() => run(`/center/bookings/${b._id}/accept`, {}, `Booking ${b.bookingNo} confirmed.`)}>Accept</button>
          <button className="btn bad sm" onClick={() => setRejecting(true)}>Reject…</button>
        </div>
      )}
      {err && <div className="alert bad small">{err}</div>}
    </div>
  );
}

export default function CenterBookings() {
  const [pending, setPending] = useState(null);
  const [date, setDate] = useState(localDate());
  const [day, setDay] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadPending = useCallback(() => {
    api.get('/center/bookings', { params: { status: 'pending' } }).then(({ data }) => setPending(data)).catch((e) => setError(errorMessage(e)));
  }, []);
  const loadDay = useCallback(() => {
    api.get('/center/schedule', { params: { date } }).then(({ data }) => setDay(data)).catch((e) => setError(errorMessage(e)));
  }, [date]);

  useEffect(loadPending, [loadPending]);
  useEffect(loadDay, [loadDay]);

  // Live: new, cancelled or rescheduled bookings appear without refreshing.
  useEffect(() => {
    const socket = getSocket();
    const onChange = (e) => {
      loadPending();
      loadDay();
      const words = { created: 'New booking', cancelled: 'Booking cancelled by customer', rescheduled: 'Booking rescheduled by customer' };
      if (words[e.kind]) setMsg(`${words[e.kind]}: ${e.bookingNo}`);
    };
    socket.on('booking:changed', onChange);
    return () => socket.off('booking:changed', onChange);
  }, [loadPending, loadDay]);

  const done = (text) => { setMsg(text); loadPending(); loadDay(); };

  return (
    <Layout title="Bookings" subtitle="New requests arrive here instantly. Accept or reject them, and see each day's slots.">
      {msg && <div className="alert good" role="status">{msg}</div>}
      {error && <div className="alert bad">{error}</div>}

      <div className="card">
        <div className="row between"><h3>Requests waiting for you</h3><span className="chip good live">Live</span></div>
        {pending === null ? <p className="muted">Loading…</p> : pending.length === 0 ? <p className="empty">No requests waiting.</p> : (
          <div className="list">{pending.map((b) => <RequestRow key={b._id} b={b} onDone={done} />)}</div>
        )}
      </div>

      <div className="card">
        <div className="row between align-end">
          <h3>Day schedule</h3>
          <div className="row align-end">
            <button className="btn sm" onClick={() => setDate(localDate())}>Today</button>
            <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
        </div>
        {day && (!day.open ? <p className="empty">{day.reason}.</p> : (
          <div className="schedule">
            {day.slots.map((s) => {
              const inSlot = day.bookings.filter((b) => b.slot === s.start && !['rejected', 'cancelled'].includes(b.status));
              return (
                <div key={s.start} className="sched-row">
                  <div className="sched-time"><b>{niceTime(s.start)}</b><span className="small muted">{s.booked}/{s.capacity} used</span></div>
                  <div className="meter" aria-hidden="true"><i style={{ width: `${Math.min(100, (s.booked / s.capacity) * 100)}%` }} /></div>
                  <div className="row chips">
                    {inSlot.length === 0 ? <span className="small muted">Free</span> : inSlot.map((b) => (
                      <Link key={b._id} to={`/center/jobs/${b._id}`} className={`chip link-chip ${statusTone(b.status)}`} title={`${b.customer?.name} · ${b.service.name} · open job card`}>
                        {vehiclePhoto(b) && <img className="chip-thumb" src={vehiclePhoto(b)} alt="" />}
                        {b.vehicleSnapshot?.regNumber} · {b.service.name} · {statusLabel(b.status)}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {day && day.bookings.some((b) => ['rejected', 'cancelled'].includes(b.status)) && (
          <p className="small muted">{day.bookings.filter((b) => ['rejected', 'cancelled'].includes(b.status)).length} cancelled or rejected booking(s) on this day are not shown.</p>
        )}
      </div>
    </Layout>
  );
}
