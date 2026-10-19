import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout.jsx';
import Plate from '../../components/Plate.jsx';
import DocChips from '../../components/DocChips.jsx';
import api, { errorMessage } from '../../api/client.js';
import { fmtKm } from '../../utils/format.js';

export default function VehicleList() {
  const [vehicles, setVehicles] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/vehicles').then(({ data }) => setVehicles(data)).catch((e) => setError(errorMessage(e)));
  }, []);

  return (
    <Layout
      title="My Vehicles"
      subtitle="Each vehicle keeps its own odometer history, documents and, later, its service history."
      actions={<Link className="btn primary" to="/customer/vehicles/new">Add vehicle</Link>}
    >
      {error && <div className="alert bad">{error}</div>}
      {vehicles === null && !error && <p className="muted">Loading…</p>}
      {vehicles?.length === 0 && (
        <div className="empty">
          <p>You haven't added a vehicle yet.</p>
          <Link className="btn primary" to="/customer/vehicles/new">Add your first vehicle</Link>
        </div>
      )}
      <div className="vgrid">
        {vehicles?.map((v) => (
          <Link key={v._id} to={`/customer/vehicles/${v._id}`} className="card vcard">
            <div className="vphoto">
              {v.image?.url ? <img src={v.image.url} alt={`${v.brand} ${v.model}`} /> : <span>{v.type === 'Bike' ? 'Bike' : 'Car'}</span>}
            </div>
            <div className="row between"><h3>{v.brand} {v.model}</h3><Plate reg={v.regNumber} /></div>
            <span className="small muted">{v.variant ? `${v.variant} · ` : ''}{v.year} · {v.fuel} · {fmtKm(v.km)}</span>
            <DocChips documents={v.documents} />
          </Link>
        ))}
      </div>
    </Layout>
  );
}
