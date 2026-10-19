import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

const TONE = { high: 'bad', medium: 'warn', info: 'info' };

// Maintenance suggestions worked out from the last service, the km driven and the latest health check.
// With vehicleId it shows one vehicle; without, all of the customer's vehicles. Shows nothing if there is nothing to say.
export default function Suggestions({ vehicleId }) {
  const [groups, setGroups] = useState(null);

  useEffect(() => {
    api.get('/vehicles/suggestions').then(({ data }) => setGroups(data)).catch(() => setGroups([]));
  }, []);

  const shown = (groups || []).filter((g) => !vehicleId || g.vehicleId === vehicleId);
  if (!shown.length) return null;

  return (
    <div className="card">
      <h3>Maintenance suggestions</h3>
      <div className="list">
        {shown.map((g) => (
          <div key={g.vehicleId} className="list">
            {!vehicleId && <b className="small">{g.name} · <span className="mono">{g.regNumber}</span></b>}
            {g.items.map((s, i) => (
              <div key={i} className={`rec ${s.severity === 'high' ? 'High' : 'Medium'}`}>
                <div className="row between">
                  <b>{s.title}</b>
                  <span className={`chip ${TONE[s.severity]}`}>{s.severity === 'high' ? 'Act soon' : 'Plan ahead'}</span>
                </div>
                <div className="small">{s.detail}</div>
                {s.action === 'book' && <div className="row"><Link className="btn sm" to={`/customer/book?vehicle=${g.vehicleId}`}>Book a service</Link></div>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
