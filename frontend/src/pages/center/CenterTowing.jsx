import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout.jsx';
import Notice from '../../components/Notice.jsx';
import api, { errorMessage } from '../../api/client.js';
import { getSocket } from '../../api/socket.js';
import { TOW_TYPES, TOW_STATUS } from '../../utils/towing.js';
import MapView from '../../components/MapView.jsx';
import { formatTravelTime } from '../../components/RouteInfo.jsx';

const blankContact = { name: '', phone: '', vehicleType: 'flatbed' };
const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// One tow request, with the customer's location and the next steps.
function RequestCard({ t, onDone }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeErr, setRouteErr] = useState('');
  const toggleRoute = async () => {
    if (route) { setRoute(null); return; }
    setRouteBusy(true);
    setRouteErr('');
    try {
      const { data } = await api.get(`/towing/center/requests/${t._id}/route`);
      setRoute(data);
    } catch (e) {
      setRouteErr(errorMessage(e));
    } finally {
      setRouteBusy(false);
    }
  };
  const set = async (status) => {
    setBusy(status);
    setMsg(null);
    try {
      await api.patch(`/towing/center/requests/${t._id}`, { status, note });
      setNote('');
      onDone();
    } catch (e) {
      setMsg({ tone: 'bad', text: errorMessage(e) });
    } finally {
      setBusy('');
    }
  };
  const s = TOW_STATUS[t.status];
  const open = ['requested', 'accepted', 'on_the_way'].includes(t.status);
  return (
    <div className={`item tow-request ${t.status}`}>
      <div className="row between">
        <div>
          <b>{t.vehicle?.regNumber || 'Vehicle'}</b> · {[t.vehicle?.brand, t.vehicle?.model].filter(Boolean).join(' ')}
          <div className="small muted">{t.customer?.name} · {when(t.createdAt)}{t.booking?.bookingNo ? ` · booking ${t.booking.bookingNo}` : ''}</div>
        </div>
        <span className={`chip ${s.tone}`}>{s.label}</span>
      </div>
      {t.note && <div className="small">Customer says: “{t.note}”</div>}
      {t.centerNote && <div className="small muted">Your note: {t.centerNote}</div>}
      <div className="row small">
        <a className="btn sm primary" href={`tel:${t.phone}`}>📞 Call {t.phone}</a>
        <a className="btn sm" href={route?.directionsUrl || t.directionsUrl} target="_blank" rel="noreferrer">🧭 Directions from our center</a>
        <button type="button" className="btn sm" onClick={toggleRoute} disabled={routeBusy}>{routeBusy ? 'Finding route…' : route ? 'Hide route' : '🗺️ Show route'}</button>
      </div>
      {routeErr && <div className="alert warn small">{routeErr}</div>}
      {route && (
        <div className="tow-route">
          <div className="small">
            Truck route: <b>{route.distanceKm} km</b> by road · about <b>{formatTravelTime(route.minutes)}</b>
            <span className="muted">{route.estimated ? ' (estimate)' : ' (with traffic)'}</span>
          </div>
          <MapView
            markers={[
              { id: 'center', lat: route.from.lat, lng: route.from.lng, title: 'Your center (truck starts here)', label: 'C', tone: 'center' },
              { id: 'customer', lat: route.to.lat, lng: route.to.lng, title: `${t.customer?.name || 'Customer'} is here`, label: '!', tone: 'picked' }
            ]}
            route={{ from: route.from, to: route.to, polyline: route.polyline, distanceKm: route.distanceKm, minutes: route.minutes, estimated: route.estimated }}
            height={300}
          />
        </div>
      )}
      {open && (
        <div className="row align-end">
          <label className="field grow"><span>Message to the customer (optional)</span>
            <input maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.status === 'requested' ? 'Truck coming, about 20 minutes' : 'Driver Ravi, KA19 AB 1234'} />
          </label>
          {t.status === 'requested' && <button className="btn good sm" disabled={!!busy} onClick={() => set('accepted')}>Accept</button>}
          {t.status === 'accepted' && <button className="btn primary sm" disabled={!!busy} onClick={() => set('on_the_way')}>Truck on the way</button>}
          {t.status === 'on_the_way' && <button className="btn primary sm" disabled={!!busy} onClick={() => set('completed')}>Towing done</button>}
          {['requested', 'accepted'].includes(t.status) && <button className="btn bad sm" disabled={!!busy} onClick={() => set('declined')}>Can't come</button>}
        </div>
      )}
      <Notice msg={msg} />
    </div>
  );
}

export default function CenterTowing() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get('/towing/center').then(({ data }) => setForm({ ...data, contacts: data.contacts?.length ? data.contacts : [{ ...blankContact }] }))
      .catch((e) => setMsg({ tone: 'bad', text: errorMessage(e) }));
  }, []);

  // Open requests at the top, finished ones in the history at the bottom.
  const loadRequests = useCallback(() => {
    api.get('/towing/center/requests', { params: { status: 'open' } }).then(({ data }) => setRequests(data)).catch(() => setRequests([]));
    api.get('/towing/center/requests', { params: { status: 'history' } }).then(({ data }) => setHistory(data)).catch(() => setHistory([]));
  }, []);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  // Live: new tow requests and cancellations appear without refreshing.
  useEffect(() => {
    const socket = getSocket();
    socket.on('tow:changed', loadRequests);
    return () => socket.off('tow:changed', loadRequests);
  }, [loadRequests]);

  const setContact = (i, k, v) => setForm((f) => ({ ...f, contacts: f.contacts.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const contacts = form.contacts.filter((c) => c.name.trim() || c.phone.trim());
      const { data } = await api.put('/towing/center', { ...form, radiusKm: Number(form.radiusKm), contacts });
      setForm({ ...data, contacts: data.contacts?.length ? data.contacts : [{ ...blankContact }] });
      setMsg({ tone: 'good', text: data.enabled ? 'Saved. Customers stuck nearby can now see your tow trucks and request a tow.' : 'Saved. Towing is off, so customers will not see it.' });
    } catch (err) {
      setMsg({ tone: 'bad', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const open = requests || [];
  return (
    <Layout title="Towing" subtitle="Help customers who break down on the way: list your tow trucks and answer tow requests.">
      <div className="card">
        <h3>Tow requests {open.length > 0 && <span className="chip bad">{open.length} open</span>}</h3>
        {requests === null ? <p className="muted small">Loading…</p> : requests.length === 0 ? (
          <div className="empty small">No open tow requests. New ones appear here instantly, and you get a notification. Finished ones move to the history below.</div>
        ) : (
          <div className="list">{requests.map((t) => <RequestCard key={t._id} t={t} onDone={loadRequests} />)}</div>
        )}
      </div>

      <form className="card" onSubmit={save} noValidate>
        <h3>Towing settings</h3>
        {!form ? <p className="muted">Loading…</p> : (
          <>
            <label className="row"><input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> <span><b>We offer towing</b> for customers who break down nearby</span></label>
            <div className="fgrid">
              <label className="field"><span>Towing area (km from your center)</span><input type="number" min={1} max={200} value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: e.target.value })} /></label>
              <label className="field"><span>When</span>
                <select value={form.available24x7 ? '24x7' : 'hours'} onChange={(e) => setForm({ ...form, available24x7: e.target.value === '24x7' })}>
                  <option value="hours">During our working hours</option>
                  <option value="24x7">24 × 7</option>
                </select>
              </label>
              <label className="field full"><span>Charges (shown to customers)</span><input maxLength={200} value={form.charges} onChange={(e) => setForm({ ...form, charges: e.target.value })} placeholder="₹1,500 up to 10 km, then ₹40 per km. Free for our booked customers within 5 km." /></label>
            </div>

            <fieldset className="fieldset">
              <legend>Tow trucks and drivers</legend>
              <p className="small muted">Customers can call these numbers directly. Add the driver or the towing desk.</p>
              <div className="list">
                {form.contacts.map((c, i) => (
                  <div key={i} className="row align-end tow-contact">
                    <label className="field"><span>Name</span><input maxLength={60} value={c.name} onChange={(e) => setContact(i, 'name', e.target.value)} placeholder="Ravi (driver)" /></label>
                    <label className="field"><span>Phone</span><input inputMode="tel" maxLength={15} value={c.phone} onChange={(e) => setContact(i, 'phone', e.target.value)} placeholder="9876543210" /></label>
                    <label className="field"><span>Truck</span>
                      <select value={c.vehicleType} onChange={(e) => setContact(i, 'vehicleType', e.target.value)}>
                        {Object.entries(TOW_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                    <button type="button" className="btn ghost sm" onClick={() => setForm((f) => ({ ...f, contacts: f.contacts.filter((_, j) => j !== i) }))} disabled={form.contacts.length === 1 && !c.name && !c.phone}>Remove</button>
                  </div>
                ))}
              </div>
              {form.contacts.length < 10 && <button type="button" className="btn sm" onClick={() => setForm((f) => ({ ...f, contacts: [...f.contacts, { ...blankContact }] }))}>+ Add tow truck</button>}
            </fieldset>
            <div className="row"><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save towing settings'}</button></div>
          </>
        )}
        <Notice msg={msg} />
      </form>

      <TowHistory list={history} />
    </Layout>
  );
}

// Finished tow requests (towed, declined, cancelled), newest first, with a quick count of each.
const HISTORY_FILTERS = [['all', 'All'], ['completed', 'Towed'], ['declined', 'Declined'], ['cancelled', 'Cancelled']];
function TowHistory({ list }) {
  const [filter, setFilter] = useState('all');
  const count = (s) => (list || []).filter((t) => t.status === s).length;
  const shown = (list || []).filter((t) => filter === 'all' || t.status === filter);
  const finishedAt = (t) => t.history?.[t.history.length - 1]?.at || t.updatedAt;

  return (
    <div className="card tow-history">
      <div className="row between">
        <h3>Towing history</h3>
        {list?.length > 0 && <span className="small muted">Last {list.length} finished request{list.length === 1 ? '' : 's'}</span>}
      </div>
      {list === null ? <p className="muted small">Loading…</p> : list.length === 0 ? (
        <div className="empty small">No finished tow requests yet. Requests appear here once they are towed, declined or cancelled.</div>
      ) : (
        <>
          <div className="stats tow-history__stats">
            <div className="stat"><span className="k">Total</span><span className="v">{list.length}</span></div>
            <div className="stat"><span className="k">Towed</span><span className="v good-text">{count('completed')}</span></div>
            <div className="stat"><span className="k">Declined</span><span className="v">{count('declined')}</span></div>
            <div className="stat"><span className="k">Cancelled by customer</span><span className="v">{count('cancelled')}</span></div>
          </div>
          <div className="seg" role="group" aria-label="Filter history">
            {HISTORY_FILTERS.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {label}{k !== 'all' ? ` (${count(k)})` : ''}
              </button>
            ))}
          </div>
          {shown.length === 0 ? <p className="small muted">None in this list.</p> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Requested</th><th>Customer</th><th>Vehicle</th><th className="num">Distance</th><th>Status</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t._id}>
                      <td>{when(t.createdAt)}<div className="small muted">Closed {when(finishedAt(t))}</div></td>
                      <td>{t.customer?.name || '–'}<div className="small muted"><a href={`tel:${t.phone}`}>{t.phone}</a></div></td>
                      <td className="mono">{t.vehicle?.regNumber || '–'}<div className="small muted">{[t.vehicle?.brand, t.vehicle?.model].filter(Boolean).join(' ')}{t.booking?.bookingNo ? ` · ${t.booking.bookingNo}` : ''}</div></td>
                      <td className="num">{t.distanceKm != null ? `${t.distanceKm} km` : '–'}</td>
                      <td><span className={`chip ${TOW_STATUS[t.status]?.tone || ''}`}>{TOW_STATUS[t.status]?.label || t.status}</span></td>
                      <td className="small">
                        {t.note && <div>Customer: “{t.note}”</div>}
                        {t.centerNote && <div className="muted">You: {t.centerNote}</div>}
                        {!t.note && !t.centerNote && <span className="muted">–</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
