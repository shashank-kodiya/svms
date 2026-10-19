import { useState } from 'react';
import api, { errorMessage } from '../api/client.js';

// "How far by road, and how long?" for one center, from the customer's location.
export default function RouteInfo({ centerId, from }) {
  const [route, setRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.get('/maps/route', { params: { centerId, lat: from.lat, lng: from.lng } });
      setRoute(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!from) return null;
  return (
    <div className="row small">
      {!route && <button type="button" className="btn sm" onClick={go} disabled={busy}>{busy ? 'Checking…' : 'Road distance & time'}</button>}
      {route && (
        <>
          <span><b>{route.distanceKm} km</b> by road · about <b>{route.minutes} min</b>{route.estimated ? <span className="muted"> (estimate)</span> : <span className="muted"> (with traffic)</span>}</span>
          <a className="btn ghost sm" href={route.directionsUrl} target="_blank" rel="noreferrer">Open directions</a>
        </>
      )}
      {error && <span className="alert bad">{error}</span>}
    </div>
  );
}
