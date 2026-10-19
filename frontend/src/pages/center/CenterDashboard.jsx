import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../api/client.js';

const STATUS_TEXT = {
  pending: ['warn', 'Waiting for admin verification', 'You can finish your setup now. Customers will see your center once the admin verifies it.'],
  verified: ['good', 'Verified', 'Your center is visible to customers.'],
  rejected: ['bad', 'Verification rejected', 'Contact the platform admin for details.'],
  suspended: ['bad', 'Suspended', 'Your center is hidden from customers. Contact the platform admin.']
};

export default function CenterDashboard() {
  const { center } = useAuth();
  const [mechanics, setMechanics] = useState(null);
  const [bs, setBs] = useState(null);
  useEffect(() => {
    api.get('/center/mechanics').then(({ data }) => setMechanics(data.length)).catch(() => {});
    api.get('/center/booking-stats').then(({ data }) => setBs(data)).catch(() => {});
  }, []);

  const [tone, label, help] = STATUS_TEXT[center?.verificationStatus] || STATUS_TEXT.pending;
  const setup = center?.setup || {};
  const steps = [
    { done: setup.brands, label: 'Choose the vehicle brands you service', to: '/center/profile' },
    { done: setup.services, label: 'Add services and starting prices', to: '/center/services' },
    { done: setup.hours, label: 'Set working hours and vehicles per slot', to: '/center/hours' },
    { done: mechanics > 0, label: 'Add your mechanics', to: '/center/mechanics', optional: true }
  ];
  const activeServices = (center?.services || []).filter((s) => s.isActive).length;
  const brandCount = (center?.brands?.Car?.length || 0) + (center?.brands?.Bike?.length || 0);

  return (
    <Layout title={center?.name || 'Service Center'} subtitle={center ? `${center.address}, ${center.city} ${center.pincode}` : ''}>
      <div className={`alert ${tone}`}>
        <span><b>{label}.</b> {help}</span>
        {center?.verificationNote && <span className="small">Admin note: {center.verificationNote}</span>}
      </div>

      {bs?.pending > 0 && (
        <div className="alert warn"><span><b>{bs.pending} booking request{bs.pending > 1 ? 's' : ''} waiting.</b> <Link to="/center/bookings">Review them</Link></span></div>
      )}
      {bs?.lowStock > 0 && (
        <div className="alert warn"><span><b>{bs.lowStock} spare part{bs.lowStock > 1 ? 's are' : ' is'} low on stock.</b> <Link to="/center/parts">Check Spare Parts</Link></span></div>
      )}
      <div className="stats">
        <Link to="/center/bookings" className="stat link-item"><span className="k">Today's bookings</span><span className="v">{bs?.todayCount ?? '—'}</span><span className="s">Pending + confirmed</span></Link>
        <Link to="/center/bookings" className="stat link-item"><span className="k">Waiting for you</span><span className="v">{bs?.pending ?? '—'}</span><span className="s">Accept or reject</span></Link>
        <div className="stat"><span className="k">Upcoming confirmed</span><span className="v">{bs?.upcoming ?? '—'}</span></div>
        <Link to="/center/jobs" className="stat link-item"><span className="k">In the workshop</span><span className="v">{bs?.inWorkshop ?? '—'}</span><span className="s">Open Workshop</span></Link>
      </div>
      <div className="stats">
        <div className="stat"><span className="k">Brands</span><span className="v">{brandCount}</span><span className="s">{center?.brands?.Car?.length || 0} car · {center?.brands?.Bike?.length || 0} bike</span></div>
        <div className="stat"><span className="k">Active services</span><span className="v">{activeServices}</span></div>
        <div className="stat"><span className="k">Vehicles per slot</span><span className="v">{center?.slotSettings?.capacityPerSlot ?? '—'}</span><span className="s">One-hour slots</span></div>
        <div className="stat"><span className="k">Mechanics</span><span className="v">{mechanics ?? '—'}</span></div>
      </div>

      <div className="card">
        <div className="row between">
          <h3>Setup checklist</h3>
          <span className={`chip ${setup.complete ? 'good' : 'warn'}`}>{setup.complete ? 'Ready for bookings' : 'Not ready for bookings yet'}</span>
        </div>
        <ol className="checklist">
          {steps.map((s) => (
            <li key={s.to} className={s.done ? 'done' : ''}>
              <span className="tick" aria-hidden="true">{s.done ? '✓' : ''}</span>
              <span>{s.label}{s.optional ? <span className="muted small"> (needed to start work on a vehicle)</span> : ''}</span>
              <Link className="btn sm" to={s.to}>{s.done ? 'Edit' : 'Set up'}</Link>
            </li>
          ))}
        </ol>
      </div>
    </Layout>
  );
}
