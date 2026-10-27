import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import { vehiclePhoto } from '../../components/VehicleThumb.jsx';
import api, { errorMessage } from '../../api/client.js';
import { getSocket } from '../../api/socket.js';
import { statusLabel, statusTone, niceDate, niceTime } from '../../utils/booking.js';

const COLUMNS = [
  { title: 'Arriving', statuses: ['accepted'] },
  { title: 'In the workshop', statuses: ['vehicle_received', 'inspection', 'in_progress', 'quality_check'] },
  { title: 'Ready for pickup', statuses: ['ready_for_pickup'] }
];

// List of today's arrivals and every vehicle currently in the workshop.
export default function CenterJobs() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/center/jobs').then(({ data }) => setJobs(data)).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Customer decisions update the "waiting" counts without refreshing.
  useEffect(() => {
    const socket = getSocket();
    socket.on('booking:changed', load);
    return () => socket.off('booking:changed', load);
  }, [load]);

  return (
    <Layout title="Workshop" subtitle="Vehicles due today or already with you. Open a job card to update its progress.">
      {error && <div className="alert bad">{error}</div>}
      {jobs === null ? <p className="muted">Loading…</p> : jobs.length === 0 ? (
        <div className="empty">No vehicles due today or in the workshop. Confirmed bookings appear here on their day.</div>
      ) : (
        <div className="board">
          {COLUMNS.map((col) => {
            const list = jobs.filter((j) => col.statuses.includes(j.status));
            return (
              <section key={col.title} className="card board-col">
                <h3>{col.title} <span className="muted small">({list.length})</span></h3>
                {list.length === 0 ? <p className="small muted">None</p> : list.map((j) => {
                  const waiting = (j.recommendations || []).filter((r) => r.status === 'awaiting').length;
                  return (
                    <Link key={j._id} to={`/center/jobs/${j._id}`} className="item link-item">
                      {vehiclePhoto(j) && <img className="job-photo" src={vehiclePhoto(j)} alt={`${j.vehicleSnapshot?.brand} ${j.vehicleSnapshot?.model}`} loading="lazy" />}
                      <div className="row between"><Plate reg={j.vehicleSnapshot?.regNumber} /><span className={`chip ${statusTone(j.status)}`}>{statusLabel(j.status)}</span></div>
                      <b>{j.vehicleSnapshot?.brand} {j.vehicleSnapshot?.model} · {j.service.name}</b>
                      <span className="small muted">{niceDate(j.date)} {niceTime(j.slot)} · {j.customer?.name}</span>
                      <span className="small">{j.mechanic ? `Mechanic: ${j.mechanic.name}` : <span className="warn-text">No mechanic assigned</span>}</span>
                      {waiting > 0 && <span className="chip warn">{waiting} repair{waiting > 1 ? 's' : ''} waiting for customer</span>}
                    </Link>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
