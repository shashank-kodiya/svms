import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import DocChips from '../../components/DocChips.jsx';
import Suggestions from '../../components/Suggestions.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api, { errorMessage } from '../../api/client.js';
import { DOC_LABELS, docStatus, fmtKm } from '../../utils/format.js';
import { localDate, niceDate, niceTime, statusLabel, statusTone } from '../../utils/booking.js';
import bikeHeroVideo from '../../assets/login/bike-film-30s-landscape.mp4';
import './CustomerDashboard.css';

export default function CustomerDashboard() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState('');
  const [next, setNext] = useState(undefined);
  const [toDecide, setToDecide] = useState([]);

  useEffect(() => {
    api.get('/vehicles').then(({ data }) => setVehicles(data)).catch((e) => setError(errorMessage(e)));
    api.get('/bookings').then(({ data }) => {
      const today = localDate();
      const up = data.filter((b) => ['pending', 'accepted'].includes(b.status) && b.date >= today)
        .sort((a, b) => (a.date + a.slot).localeCompare(b.date + b.slot));
      setNext(up[0] || null);
      setToDecide(data.filter((b) => ['inspection', 'in_progress'].includes(b.status) && (b.recommendations || []).some((r) => r.status === 'awaiting')));
    }).catch(() => setNext(null));
  }, []);

  // Documents that are expired or expire within 30 days.
  const attention = (vehicles || []).flatMap((v) =>
    Object.entries(DOC_LABELS)
      .map(([k, label]) => ({ v, label, s: docStatus(v.documents?.[k]) }))
      .filter((x) => x.s.level === 'expired' || x.s.level === 'soon')
  );

  return (
    <Layout className="customer-dashboard" title={`Hello, ${user.name}`} subtitle="Your vehicles and what needs attention.">
      <section className="customer-dashboard__hero" aria-label="Customer dashboard overview">
        <div className="customer-dashboard__visual">
          <video className="customer-dashboard__video" autoPlay loop muted playsInline src={bikeHeroVideo} />
          <div className="customer-dashboard__visualShade" />
          <div className="customer-dashboard__visualCopy">
            <p>Book a service, follow repairs, and keep your vehicle records together.</p>
            <div className="customer-dashboard__chips"><span>Online booking</span><span>Repair updates</span><span>Service history</span></div>
          </div>
        </div>
        <div className="customer-dashboard__welcome">
          <span className="customer-dashboard__eyebrow">Customer dashboard</span>
          <p>Pick up where you left off or plan your next visit.</p>
          <div className="customer-dashboard__actions">
            <Link className="btn primary" to="/customer/book">Book a service <span aria-hidden="true">→</span></Link>
            <Link className="btn" to="/customer/vehicles">My vehicles</Link>
          </div>
          <div className="customer-dashboard__next">
            <span className="customer-dashboard__eyebrow">Next booking</span>
            {next ? <><b>{niceDate(next.date)} · {niceTime(next.slot)}</b><span>{next.center?.name} · {next.vehicleSnapshot?.model}</span></> : <><b>{next === null ? 'No upcoming visits' : 'Checking your bookings…'}</b><span>{next === null ? 'Ready when you are.' : 'Your latest booking will appear here.'}</span></>}
            <Link to="/customer/bookings">View bookings <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      {error && <div className="alert bad">{error}</div>}
      {toDecide.map((b) => (
        <div key={b._id} className="alert warn">
          <span><b>{b.center?.name} recommends extra repairs on your {b.vehicleSnapshot?.model}.</b> Nothing extra is done without your approval.</span>
          <Link className="btn sm" to={`/customer/bookings/${b._id}`}>Review repairs</Link>
        </div>
      ))}

      {attention.length > 0 && (
        <div className="alert warn">
          <b>{attention.length} document{attention.length > 1 ? 's need' : ' needs'} attention</b>
          <ul className="tight">
            {attention.map((x, i) => (
              <li key={i}>{x.label} for {x.v.brand} {x.v.model}: {x.s.text.toLowerCase()}</li>
            ))}
          </ul>
          <Link to="/customer/vehicles">Update dates in My Vehicles</Link>
        </div>
      )}

      <Suggestions />

      <div className="stats">
        <div className="stat"><span className="k">My vehicles</span><span className="v">{vehicles ? vehicles.length : '—'}</span><span className="s">{vehicles ? `${vehicles.filter((v) => v.type === 'Car').length} car, ${vehicles.filter((v) => v.type === 'Bike').length} bike` : ''}</span></div>
        <div className="stat"><span className="k">Documents to renew</span><span className="v">{vehicles ? attention.length : '—'}</span><span className="s">Within 30 days</span></div>
        <Link to="/customer/bookings" className="stat link-item"><span className="k">Upcoming booking</span><span className="v">{next ? niceDate(next.date).replace(/ \d{4}$/, '') : '—'}</span><span className="s">{next ? <>{niceTime(next.slot)} · {next.center?.name} · <span className={`chip ${statusTone(next.status)}`}>{statusLabel(next.status)}</span></> : next === null ? 'No upcoming bookings' : ''}</span></Link>
      </div>

      <div className="card">
        <div className="row between"><h3>My vehicles</h3><div className="row"><Link className="btn" to="/customer/vehicles/new">Add vehicle</Link><Link className="btn primary" to="/customer/book">Book a service</Link></div></div>
        {vehicles === null ? <p className="muted">Loading…</p> : vehicles.length === 0 ? (
          <p className="empty">No vehicles yet. <Link to="/customer/vehicles/new">Add your first vehicle</Link> to start booking services.</p>
        ) : (
          <div className="list">
            {vehicles.map((v) => (
              <Link key={v._id} to={`/customer/vehicles/${v._id}`} className="item link-item">
                <div className="row between"><b>{v.brand} {v.model}</b><Plate reg={v.regNumber} /></div>
                <span className="small muted">{v.type} · {v.year} · {v.fuel} · {fmtKm(v.km)}</span>
                <DocChips documents={v.documents} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
