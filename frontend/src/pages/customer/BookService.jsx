import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import SlotPicker from '../../components/SlotPicker.jsx';
import MapView from '../../components/MapView.jsx';
import DirectionsBar, { useCenterRoute } from '../../components/DirectionsBar.jsx';
import PaymentMethods from '../../components/PaymentMethods.jsx';
import CenterReviews from '../../components/CenterReviews.jsx';
import { Stars } from '../../components/Stars.jsx';
import useMyLocation from '../../hooks/useMyLocation.js';
import api, { errorMessage } from '../../api/client.js';
import { getSocket } from '../../api/socket.js';
import { inr, hrs, localDate, niceDate, niceTime } from '../../utils/booking.js';
import './BookService.css';

export default function BookService() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [vehicles, setVehicles] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState({ vehicleId: params.get('vehicle') || '', serviceKey: '', date: localDate(1), city: '' });
  const [search, setSearch] = useState(null); // { results, ... }
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(null); // { centerId, slot }
  const [problem, setProblem] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');
  const [liveNote, setLiveNote] = useState('');
  const { loc, asking, error: locError, ask, clear: clearLoc } = useMyLocation();   // Phase 9
  const [sortBy, setSortBy] = useState('best');
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    api.get('/vehicles').then(({ data }) => {
      setVehicles(data);
      setForm((f) => ({ ...f, vehicleId: f.vehicleId || data[0]?._id || '' }));
    }).catch((e) => setError(errorMessage(e)));
    api.get('/meta/service-catalog').then(({ data }) => setCatalog(data.services)).catch(() => {});
  }, []);

  const vehicle = vehicles?.find((v) => v._id === form.vehicleId);
  const services = useMemo(() => (catalog || []).filter((s) => !vehicle || s.types.includes(vehicle.type)), [catalog, vehicle]);

  const runSearch = async (e) => {
    e?.preventDefault();
    setError('');
    setPick(null);
    setBookError('');
    if (!form.vehicleId || !form.serviceKey) return setError('Choose a vehicle and a service.');
    setSearching(true);
    try {
      const { data } = await api.get('/bookings/search', { params: { vehicleId: form.vehicleId, serviceKey: form.serviceKey, date: form.date, ...(form.city ? { city: form.city } : {}), ...(loc ? { lat: loc.lat, lng: loc.lng } : {}) } });
      setSearch(data);
    } catch (err) {
      setError(errorMessage(err));
      setSearch(null);
    } finally {
      setSearching(false);
    }
  };

  // Live updates: when anyone books or frees a slot at a listed center, refresh that center's slots.
  const refreshCenter = useCallback(async (centerId) => {
    const { data } = await api.get(`/bookings/availability/${centerId}`, { params: { date: search.date } });
    setSearch((s) => s && ({
      ...s,
      results: s.results.map((r) => (String(r.center._id) === centerId ? { ...r, availability: data, freeSlots: data.slots.filter((x) => x.remaining > 0).length } : r))
    }));
    setPick((p) => {
      if (p && p.centerId === centerId && !data.slots.find((x) => x.start === p.slot && x.remaining > 0)) {
        setLiveNote(`${niceTime(p.slot)} was just booked by someone else. Please pick another time.`);
        return null;
      }
      return p;
    });
  }, [search?.date]);

  useEffect(() => {
    if (!search?.results?.length) return undefined;
    const socket = getSocket();
    const rooms = search.results.map((r) => ({ centerId: String(r.center._id), date: search.date }));
    const watchAll = () => rooms.forEach((r) => socket.emit('slots:watch', r));
    watchAll();
    socket.on('connect', watchAll); // re-join after a reconnect
    const onChange = ({ centerId, date }) => { if (date === search.date) refreshCenter(centerId).catch(() => {}); };
    socket.on('slots:changed', onChange);
    return () => {
      rooms.forEach((r) => socket.emit('slots:unwatch', r));
      socket.off('connect', watchAll);
      socket.off('slots:changed', onChange);
    };
  }, [search?.results?.length, search?.date, refreshCenter]);

  const confirm = async () => {
    setBookError('');
    setBooking(true);
    try {
      const { data } = await api.post('/bookings', { vehicleId: form.vehicleId, centerId: pick.centerId, serviceKey: form.serviceKey, date: search.date, slot: pick.slot, problem });
      navigate('/customer/bookings', { state: { message: `Booking ${data.bookingNo} sent to ${data.center.name}. You'll see it here once the center confirms.` } });
    } catch (err) {
      setBookError(errorMessage(err));
      if (err.response?.status === 409) refreshCenter(pick.centerId).catch(() => {});
    } finally {
      setBooking(false);
    }
  };

  const picked = search?.results.find((r) => String(r.center._id) === pick?.centerId);

  // Phase 9: the server sends results best match first; the customer can re-order them here.
  const sorted = useMemo(() => {
    const list = [...(search?.results || [])];
    if (sortBy === 'near') list.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || b.score - a.score);
    if (sortBy === 'cheap') list.sort((a, b) => a.service.price - b.service.price || b.score - a.score);
    return list;
  }, [search?.results, sortBy]);
  const markers = useMemo(
    () => sorted.map((r, i) => ({ r, i })).filter(({ r }) => r.center.lat != null)
      .map(({ r, i }) => ({ id: String(r.center._id), lat: r.center.lat, lng: r.center.lng, title: r.center.name, label: i + 1, tone: 'center' })),
    [sorted]
  );
  const focusCard = useCallback((id) => {
    setFocus(id);
    document.getElementById(`center-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Directions: the focused center's road route on the map (same as Find centers).
  const focusedCenter = useMemo(() => {
    const r = search?.results.find((x) => String(x.center._id) === focus);
    return r && r.center.lat != null ? { _id: focus, name: r.center.name, lat: r.center.lat, lng: r.center.lng } : null;
  }, [search?.results, focus]);
  const { data: routeData, route: routeToFocused } = useCenterRoute(focusedCenter, loc);
  const showDirections = (id) => {
    setFocus(id);
    document.getElementById('book-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!loc && !asking) ask();
  };

  return (
    <Layout className="book-service-page" title="Book a service" subtitle="Only verified centers that service your vehicle's brand and offer the service are shown.">
      {vehicles?.length === 0 ? (
        <div className="empty">Add a vehicle first. <Link to="/customer/vehicles/new">Add vehicle</Link></div>
      ) : (
        <form className="card" onSubmit={runSearch} noValidate>
          <div className="fgrid">
            <label className="field">
              <span>Vehicle</span>
              <select value={form.vehicleId} onChange={(e) => { setForm({ ...form, vehicleId: e.target.value, serviceKey: '' }); setSearch(null); }}>
                {(vehicles || []).map((v) => <option key={v._id} value={v._id}>{v.brand} {v.model} · {v.regNumber}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Service</span>
              <select value={form.serviceKey} onChange={(e) => setForm({ ...form, serviceKey: e.target.value })}>
                <option value="">Choose a service</option>
                {services.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Date</span><input type="date" min={localDate()} max={localDate(90)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="field"><span>City (optional)</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Mysuru" /></label>
            <button className="btn primary" disabled={searching}>{searching ? 'Searching…' : 'Find centers'}</button>
          </div>
          <div className="row small">
            {loc ? (
              <><span className="chip good">Using your location for distance</span><button type="button" className="btn ghost sm" onClick={clearLoc}>Stop using it</button></>
            ) : (
              <button type="button" className="btn sm" onClick={ask} disabled={asking}>{asking ? 'Finding you…' : 'Use my location (shows distance)'}</button>
            )}
            <span className="muted">Used only in this tab, never saved.</span>
          </div>
          {locError && <div className="alert warn">{locError}</div>}
          {error && <div className="alert bad">{error}</div>}
        </form>
      )}

      {search && (
        <>
          <div className="row between">
            <b>{search.results.length} center{search.results.length === 1 ? '' : 's'} for {search.vehicle.brand} {search.vehicle.model} · {search.service.name} · {niceDate(search.date)}</b>
            <span className="chip good live">Live availability</span>
          </div>
          {search.results.length > 1 && (
            <div className="row small">
              <span className="muted">Sort by</span>
              <div className="seg">
                {[['best', 'Best match'], ['near', 'Nearest'], ['cheap', 'Lowest price']].map(([k, t]) => (
                  <button key={k} type="button" aria-pressed={sortBy === k} disabled={k === 'near' && !search.located} title={k === 'near' && !search.located ? 'Use your location first' : undefined} onClick={() => setSortBy(k)}>{t}</button>
                ))}
              </div>
            </div>
          )}
          {markers.length > 0 && (
            <div id="book-map" className="directions-wrap">
              <DirectionsBar center={focusedCenter} from={loc} data={routeData} asking={asking} onAsk={ask} onClose={() => setFocus(null)} />
              <MapView markers={markers} user={loc} selectedId={focus} onSelect={focusCard} route={routeToFocused} height={focusedCenter ? 360 : 280} />
            </div>
          )}
          {liveNote && <div className="alert warn">{liveNote}</div>}
          {search.results.length === 0 && (
            <div className="empty">No verified center services {search.vehicle.brand} {search.vehicle.type.toLowerCase()}s for {search.service.name}{form.city ? ` in ${form.city}` : ''} yet. Try another service{form.city ? ' or clear the city' : ''}.</div>
          )}
          {sorted.map((r, idx) => {
            const id = String(r.center._id);
            const isPicked = pick?.centerId === id;
            return (
              <div key={id} id={`center-${id}`} className={`card result ${isPicked || focus === id ? 'sel' : ''}`}>
                <div className="row between">
                  <div>
                    <h3>
                      {r.center.lat != null && <span className="num-dot">{idx + 1}</span>} {r.center.name}
                      {sortBy === 'best' && idx === 0 && search.results.length > 1 && <span className="chip good">Best match</span>}
                    </h3>
                    <div className="row small">
                      <span className="chip info" title="Distance 35%, price 25%, free slots 15%, rating 15%, experience 10%">Match {r.score}%</span>
                      <Stars value={r.ratingAvg} count={r.ratingCount} />
                      {r.distanceKm != null && <span><b>{r.distanceKm} km</b> away</span>}
                      {r.reasons?.map((t) => <span key={t} className="muted">· {t}</span>)}
                    </div>
                    <div className="small muted">{r.center.address}, {r.center.city} {r.center.pincode} · {r.center.phone}</div>
                    {r.center.description && <div className="small">{r.center.description}</div>}
                    <PaymentMethods methods={r.center.paymentMethods} />
                  </div>
                  <div className="price">
                    <b>{inr(r.service.price)}</b>
                    <span className="small muted">from · about {hrs(r.service.durationMins)}</span>
                  </div>
                </div>
                {r.service.notes && <div className="small muted">{r.service.notes}</div>}
                <div className="row small">
                  <Link className="btn sm" to={`/customer/centers/${id}`}>More details</Link>
                  {r.center.lat != null && <button type="button" className="btn sm" onClick={() => showDirections(id)}>{focus === id ? 'Showing directions ↑' : 'Show directions'}</button>}
                </div>
                <CenterReviews centerId={id} ratingCount={r.ratingCount} />
                <SlotPicker
                  availability={r.availability}
                  value={isPicked ? pick.slot : null}
                  onChange={(slot) => { setPick({ centerId: id, slot }); setLiveNote(''); setBookError(''); }}
                />
              </div>
            );
          })}
        </>
      )}

      {pick && picked && (
        <div className="card confirm-bar">
          <div className="row between">
            <div>
              <b>{picked.center.name}</b> · {search.service.name}
              <div className="small">{niceDate(search.date)} at {niceTime(pick.slot)} · from {inr(picked.service.price)} (parts and GST extra)</div>
            </div>
            {vehicle && (
              <div className="row confirm-vehicle">
                {vehicle.image?.url && <img className="confirm-vehicle__photo" src={vehicle.image.url} alt={`${vehicle.brand} ${vehicle.model}`} />}
                <Plate reg={vehicle.regNumber} />
              </div>
            )}
          </div>
          {vehicle && !vehicle.image?.url && (
            <div className="alert info small">
              Add a photo of your {vehicle.brand} {vehicle.model} so the center can recognise it when you arrive.{' '}
              <Link to={`/customer/vehicles/${vehicle._id}`}>Add photo</Link> (your booking choices here are kept only until you leave this page).
            </div>
          )}
          {vehicle?.image?.url && <p className="small muted">The center sees this photo with your booking request.</p>}
          <label className="field"><span>Anything the mechanic should know? (optional)</span>
            <textarea rows={2} maxLength={500} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="Squeaking noise when braking" />
          </label>
          {bookError && <div className="alert bad">{bookError}</div>}
          <div className="row">
            <button className="btn primary" onClick={confirm} disabled={booking}>{booking ? 'Booking…' : 'Confirm booking'}</button>
            <button className="btn" onClick={() => setPick(null)}>Change</button>
          </div>
        </div>
      )}
    </Layout>
  );
}
