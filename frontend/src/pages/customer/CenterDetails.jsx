import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import MapView from '../../components/MapView.jsx';
import CenterGallery from '../../components/CenterGallery.jsx';
import Lightbox from '../../components/Lightbox.jsx';
import DirectionsBar, { useCenterRoute } from '../../components/DirectionsBar.jsx';
import PaymentMethods from '../../components/PaymentMethods.jsx';
import { Stars } from '../../components/Stars.jsx';
import useMyLocation from '../../hooks/useMyLocation.js';
import api, { errorMessage } from '../../api/client.js';
import { inr, hrs } from '../../utils/booking.js';
import './CenterDetails.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TABS = [['overview', 'Overview'], ['reviews', 'Reviews'], ['photos', 'Photos'], ['services', 'Services']];

const clock = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
};
const dayLine = (d) => (!d?.isOpen ? 'Closed'
  : d.breakStart && d.breakEnd ? `${clock(d.open)}–${clock(d.breakStart)}, ${clock(d.breakEnd)}–${clock(d.close)}` : `${clock(d.open)}–${clock(d.close)}`);
const niceDay = (s) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

// Straight-line km between two points (only for the "x km away" line; the route gives the road distance).
function kmBetween(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

function Icon({ name }) {
  const paths = {
    pin: 'M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 10.4 3.5 2.1-.8 1.3L11 13V7h2Z',
    phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1Z',
    web: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.2 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.8 1.9-4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4Zm.8 2h3a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.4-3.6A15.7 15.7 0 0 0 8.1 8ZM12 20c-.8-1.2-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.8-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.2 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6ZM16.3 14a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4Z',
    car: 'M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8l-2.1-6ZM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3ZM5 11l1.5-4.5h11L19 11H5Z',
    directions: 'M21.7 11.3 12.7 2.3a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4ZM14 14.5V12h-4v3H8v-4c0-.6.4-1 1-1h5V7.5l3.5 3.5-3.5 3.5Z',
    calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Z',
    wallet: 'M21 7h-1V5a2 2 0 0 0-2-2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1ZM5 5h13v2H5a1 1 0 0 1 0-2Zm15 14H5a1 1 0 0 1-1-1V8.8c.3.1.6.2 1 .2h15v3h-4a2 2 0 0 0 0 4h4v3Zm0-5v1h-4v-1h4Z',
    share: 'M18 16.1c-.8 0-1.4.3-2 .8l-7.1-4.2c.1-.2.1-.5.1-.7s0-.5-.1-.7L16 7.2c.5.5 1.2.8 2 .8a3 3 0 1 0-3-3c0 .2 0 .5.1.7L8 9.8C7.5 9.3 6.8 9 6 9a3 3 0 1 0 0 6c.8 0 1.5-.3 2-.8l7.1 4.2-.1.6a2.9 2.9 0 1 0 3-2.9Z',
    google: 'M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Zm-5.6-8c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4 5.6-4Z'
  };
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d={paths[name]} /></svg>;
}

function RatingSummary({ value, count, reviews }) {
  const dist = [5, 4, 3, 2, 1].map((n) => [n, reviews.filter((r) => Math.round(r.rating) === n).length]);
  const max = Math.max(1, ...dist.map(([, c]) => c));
  return (
    <div className="place-rating">
      <div className="place-rating__bars">
        {dist.map(([n, c]) => (
          <div key={n} className="place-rating__bar"><span>{n}</span><i><b style={{ width: `${(c / max) * 100}%` }} /></i></div>
        ))}
      </div>
      <div className="place-rating__big">
        <b>{count ? value.toFixed(1) : '–'}</b>
        <Stars value={value} />
        <span className="small muted">{count} review{count === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

// A center's page, laid out like a Google Maps place: photos, name, rating, open now, actions,
// then Overview / Reviews / Photos / Services, with the map (and directions) beside it.
export default function CenterDetails() {
  const { id } = useParams();
  const { loc, asking, error: locError, ask } = useMyLocation();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState(null);
  const [tab, setTab] = useState('overview');
  const [hoursOpen, setHoursOpen] = useState(false);
  const [directions, setDirections] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(null);
  const [shared, setShared] = useState('');

  useEffect(() => {
    setC(null); setError(''); setReviews(null); setTab('overview'); setDirections(false);
    api.get(`/maps/centers/${id}`).then(({ data }) => setC(data)).catch((e) => setError(errorMessage(e)));
    api.get(`/bookings/centers/${id}/reviews`).then(({ data }) => setReviews(data.reviews)).catch(() => setReviews([]));
  }, [id]);

  const target = useMemo(() => (c && c.lat != null ? { _id: c._id, name: c.name, lat: c.lat, lng: c.lng } : null), [c]);
  const { data: routeData, route } = useCenterRoute(directions ? target : null, loc);
  const markers = useMemo(() => (target ? [{ id: c._id, lat: c.lat, lng: c.lng, title: c.name, tone: 'center' }] : []), [target, c]);

  // Our photos first, then Google's (with the photographer's name, as Google asks).
  const allPhotos = useMemo(() => [
    ...(c?.photos || []).map((p) => ({ ...p })),
    ...(c?.google?.photos || []).map((p, i) => ({ _id: `g${i}`, url: p.url, caption: '', credit: p.author ? `Photo by ${p.author} on Google` : 'From Google' }))
  ], [c]);

  const startDirections = () => {
    setDirections(true);
    if (!loc && !asking) ask();
    document.getElementById('place-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: c.name, text: `${c.name}, ${c.address}, ${c.city}`, url });
      else { await navigator.clipboard.writeText(url); setShared('Link copied'); setTimeout(() => setShared(''), 2000); }
    } catch { /* closed the share sheet */ }
  };

  if (error) return <Layout title="Service center"><div className="alert bad">{error}</div><Link className="btn" to="/customer/nearby">Back to Find centers</Link></Layout>;
  if (!c) return <Layout title="Service center"><p className="muted">Loading…</p></Layout>;

  const types = [c.brands?.Car?.length ? 'Car' : null, c.brands?.Bike?.length ? 'Bike' : null].filter(Boolean);
  const category = `${types.join(' & ')} service center`;
  const g = c.google;
  const today = c.workingHours.find((d) => d.day === c.todayDay);
  const away = loc && c.lat != null ? kmBetween(loc, c) : null;
  const ourReviews = reviews || [];
  const servicesByType = ['Car', 'Bike'].map((t) => [t, c.services.filter((s) => s.vehicleType === t)]).filter(([, list]) => list.length);

  return (
    <Layout className="place-layout" title="Service center details" subtitle={`${c.name} · ${c.city}`}>
      <Link className="btn ghost sm place-back" to="/customer/nearby">← Back to Find centers</Link>
      <div className="place-page">
        <section className="place-panel card">
          {allPhotos.length > 0
            ? <CenterGallery photos={allPhotos} name={c.name} max={5} className="place-hero" />
            : <div className="place-hero place-hero--empty"><Icon name="car" /><span className="small muted">No photos yet</span></div>}

          <header className="place-head">
            <h2>{c.name}</h2>
            <div className="row small place-head__rating">
              {c.ratingCount > 0
                ? <><b>{c.ratingAvg.toFixed(1)}</b><Stars value={c.ratingAvg} /><button type="button" className="linklike" onClick={() => setTab('reviews')}>({c.ratingCount})</button></>
                : <span className="muted">No reviews yet</span>}
            </div>
            <div className="small muted">{category}{types.includes('Car') ? ` · ${c.brands.Car.slice(0, 3).join(', ')}${c.brands.Car.length > 3 ? '…' : ''}` : ''}</div>
            <div className="small">
              <b className={c.status.isOpen ? (c.status.closingSoon ? 'warn-text' : 'good-text') : 'bad-text'}>{c.status.label.split(' · ')[0]}</b>
              {c.status.label.includes(' · ') && <span> · {c.status.label.split(' · ').slice(1).join(' · ')}</span>}
              {g?.openNow != null && <span className="muted"> · Google says {g.openNow ? 'open now' : 'closed now'}</span>}
            </div>
          </header>

          <div className="place-actions">
            <button type="button" className="place-action primary" onClick={startDirections} disabled={c.lat == null}><span><Icon name="directions" /></span>Directions</button>
            <a className="place-action" href={`tel:${c.phone}`}><span><Icon name="phone" /></span>Call</a>
            <Link className="place-action" to="/customer/book"><span><Icon name="calendar" /></span>Book</Link>
            <button type="button" className="place-action" onClick={share}><span><Icon name="share" /></span>{shared || 'Share'}</button>
            {(g?.url || c.lat != null) && (
              <a className="place-action" href={g?.url || `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" rel="noreferrer"><span><Icon name="google" /></span>Google Maps</a>
            )}
          </div>

          <nav className="place-tabs" role="tablist">
            {TABS.map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {t}{k === 'reviews' && c.ratingCount > 0 ? ` (${c.ratingCount})` : ''}{k === 'photos' && allPhotos.length ? ` (${allPhotos.length})` : ''}
              </button>
            ))}
          </nav>

          {tab === 'overview' && (
            <div className="place-section">
              {c.description && <p className="place-about">{c.description}</p>}
              <ul className="place-info">
                <li><Icon name="pin" /><div>{c.address}, {c.city} {c.pincode}{away != null && <div className="small muted">{away} km away (straight line)</div>}</div></li>
                <li>
                  <Icon name="clock" />
                  <div className="grow">
                    <button type="button" className="linklike place-hours-toggle" onClick={() => setHoursOpen(!hoursOpen)} aria-expanded={hoursOpen}>
                      <b className={c.status.isOpen ? 'good-text' : 'bad-text'}>{c.status.label.split(' · ')[0]}</b> · Today {dayLine(today)} <span aria-hidden="true">{hoursOpen ? '▴' : '▾'}</span>
                    </button>
                    {hoursOpen && (
                      <table className="place-hours">
                        <tbody>
                          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                            const h = c.workingHours.find((x) => x.day === d);
                            return <tr key={d} className={d === c.todayDay ? 'today' : ''}><th>{DAYS[d]}</th><td>{dayLine(h)}</td></tr>;
                          })}
                        </tbody>
                      </table>
                    )}
                    {c.upcomingHolidays.length > 0 && (
                      <div className="small warn-text">Closed on {c.upcomingHolidays.map((h) => `${niceDay(h.date)}${h.reason ? ` (${h.reason})` : ''}`).join(', ')}</div>
                    )}
                    {g?.weekdayHours?.length > 0 && hoursOpen && (
                      <details className="small"><summary>Hours on Google</summary><ul className="plain">{g.weekdayHours.map((l) => <li key={l}>{l}</li>)}</ul></details>
                    )}
                  </div>
                </li>
                <li><Icon name="phone" /><div><a href={`tel:${c.phone}`}>{c.phone}</a>{g?.phone && g.phone.replace(/\D/g, '').slice(-10) !== c.phone && <div className="small muted">On Google: {g.phone}</div>}</div></li>
                {g?.website && <li><Icon name="web" /><div><a href={g.website} target="_blank" rel="noreferrer">{g.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a></div></li>}
                <li>
                  <Icon name="car" />
                  <div className="place-brands">
                    {['Car', 'Bike'].flatMap((t) => (c.brands?.[t] || []).map((b) => <span key={`${t}${b}`} className="chip">{b}{types.length > 1 ? ` · ${t}` : ''}</span>))}
                  </div>
                </li>
                {c.paymentMethods?.length > 0 && (
                  <li><Icon name="wallet" /><div><PaymentMethods methods={c.paymentMethods} label="Payments:" />{c.payBeforePickup && <div className="small muted">Bill to be paid before the vehicle is released.</div>}</div></li>
                )}
              </ul>
              {servicesByType.length > 0 && (
                <div className="place-preview">
                  <div className="row between"><h3>Popular services</h3><button type="button" className="linklike" onClick={() => setTab('services')}>See all</button></div>
                  <div className="place-chips">
                    {c.services.slice(0, 6).map((s) => <span key={`${s.vehicleType}${s.key}`} className="chip info">{s.name}{types.length > 1 ? ` (${s.vehicleType})` : ''} · from {inr(s.price)}</span>)}
                  </div>
                </div>
              )}
              {!c.googleEnabled && <p className="small muted">Google hours and website appear here once Google Places is set up on the server.</p>}
              {c.googleEnabled && !g && c.lat != null && <p className="small muted">No matching Google listing was found at this center’s map pin.</p>}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="place-section">
              <h3>Customer reviews</h3>
              {c.ratingCount > 0 && <RatingSummary value={c.ratingAvg} count={c.ratingCount} reviews={ourReviews} />}
              {reviews === null && <p className="muted small">Loading…</p>}
              {reviews?.length === 0 && <p className="muted small">No reviews yet. Customers can review the center after a completed service.</p>}
              <ul className="plain place-reviews">
                {ourReviews.map((r) => (
                  <li key={r._id}>
                    <div className="place-review__head"><span className="avatar">{(r.who || '?').slice(0, 1).toUpperCase()}</span><div><b>{r.who}</b><div className="small muted">{r.serviceName}</div></div></div>
                    <div className="small"><Stars value={r.rating} /> <span className="muted">{new Date(r.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                    {r.comment && <p>{r.comment}</p>}
                    {r.reply && <div className="place-reply small"><b>Response from the owner</b><div>{r.reply.text}</div></div>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'photos' && (
            <div className="place-section">
              {allPhotos.length === 0 ? <p className="muted small">This center hasn’t added photos yet.</p> : (
                <div className="place-photos">
                  {allPhotos.map((p, i) => (
                    <button key={p._id} type="button" onClick={() => setPhotoOpen(i)} aria-label={`Open photo ${i + 1}`}>
                      <img src={p.url} alt={p.caption || `${c.name} photo ${i + 1}`} loading="lazy" />
                      {(p.caption || p.credit) && <span>{p.caption || p.credit}</span>}
                    </button>
                  ))}
                </div>
              )}
              <Lightbox photos={allPhotos} index={photoOpen} onChange={setPhotoOpen} onClose={() => setPhotoOpen(null)} title={c.name} />
            </div>
          )}

          {tab === 'services' && (
            <div className="place-section">
              {servicesByType.length === 0 && <p className="muted small">No services listed yet.</p>}
              {servicesByType.map(([t, list]) => (
                <div key={t}>
                  {servicesByType.length > 1 && <h3>{t}</h3>}
                  <ul className="plain place-services">
                    {list.map((s) => (
                      <li key={s.key}>
                        <div><b>{s.name}</b>{s.notes && <div className="small muted">{s.notes}</div>}<div className="small muted">About {hrs(s.durationMins)}</div></div>
                        <div className="price"><b>{inr(s.price)}</b><span className="small muted">starting price</span></div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <Link className="btn primary" to="/customer/book">Book a service</Link>
              <p className="small muted">Prices are before parts and GST.</p>
            </div>
          )}
        </section>

        <section id="place-map" className="place-map">
          {directions && <DirectionsBar center={target} from={loc} data={routeData} asking={asking} onAsk={ask} onClose={() => setDirections(false)} />}
          {locError && directions && <div className="alert warn">{locError}</div>}
          {target ? <MapView markers={markers} user={loc} selectedId={directions ? c._id : null} route={route} height={520} />
            : <div className="map-note small muted">This center hasn’t set its map location yet.</div>}
        </section>
      </div>
    </Layout>
  );
}
