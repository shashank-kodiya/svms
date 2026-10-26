import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client.js';

export const formatTravelTime = (minutes) => {
  const totalMinutes = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr`;
  return `${hours} hr ${mins} min`;
};

// "How far by road, and how long?" for one center, from the customer's location.
export default function RouteInfo({ centerId, from, autoFetch = false }) {
  const [route, setRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    if (!from) return;
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

  useEffect(() => {
    if (!autoFetch || !from) return;
    go();
  }, [autoFetch, centerId, from?.lat, from?.lng]);

  if (!from) return null;
  return (
    <div className="row small">
      {!route && !busy && !error && !autoFetch && <button type="button" className="btn sm" onClick={go} disabled={busy}>{busy ? 'Checking…' : 'Road distance & time'}</button>}
      {busy && <span className="muted">Checking route…</span>}
      {route && (
        <>
          <span><b>{route.distanceKm} km</b> by road · about <b>{formatTravelTime(route.minutes)}</b>{route.estimated ? <span className="muted"> (estimate)</span> : <span className="muted"> (with traffic)</span>}</span>
          <a className="btn ghost sm" href={route.directionsUrl} target="_blank" rel="noreferrer">Open directions</a>
        </>
      )}
      {error && <span className="alert bad">{error}</span>}
    </div>
  );
}
