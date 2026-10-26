import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import { formatTravelTime } from './RouteInfo.jsx';

// Road route from the customer to one center: { data, route } where `route` is ready for <MapView route={...} />.
// center: { _id, name, lat, lng } or null. from: the customer's { lat, lng } or null.
export function useCenterRoute(center, from) {
  const [data, setData] = useState(null);
  const centerId = center?._id ? String(center._id) : null;
  useEffect(() => {
    if (!centerId || !from) { setData(null); return undefined; }
    let alive = true;
    setData(null);
    api.get('/maps/route', { params: { centerId, lat: from.lat, lng: from.lng } })
      .then(({ data: d }) => alive && setData({ centerId, ...d }))
      .catch(() => alive && setData({ centerId }));
    return () => { alive = false; };
  }, [centerId, from?.lat, from?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const route = useMemo(() => (
    center && from && Number.isFinite(center.lat) && data?.centerId === centerId
      ? { from, to: { lat: center.lat, lng: center.lng }, polyline: data.polyline, distanceKm: data.distanceKm, minutes: data.minutes, estimated: data.estimated }
      : null
  ), [center, centerId, from, data]);

  return { data: data?.centerId === centerId ? data : null, route };
}

// "Directions to <center>: 18 min · 6.4 km by road" with Start in Google Maps / Use my location / Close.
export default function DirectionsBar({ center, from, data, asking, onAsk, onClose }) {
  if (!center) return null;
  return (
    <div className="card directions-bar">
      <div>
        <div className="small muted">Directions to</div>
        <b>{center.name}</b>
        <div className="small">
          {!from ? (asking ? 'Finding your location…' : 'Share your location to see the road route.')
            : !data ? 'Finding the route…'
              : data.distanceKm != null
                ? <><b className="good-text">{formatTravelTime(data.minutes)}</b> · {data.distanceKm} km by road{data.estimated ? ' (estimate)' : ''}</>
                : 'Route not available, showing the straight line.'}
        </div>
      </div>
      <div className="row">
        {!from && <button type="button" className="btn primary sm" onClick={onAsk} disabled={asking}>{asking ? 'Finding you…' : 'Use my location'}</button>}
        {from && <a className="btn primary sm" href={`https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${center.lat},${center.lng}&travelmode=driving`} target="_blank" rel="noreferrer">Start in Google Maps</a>}
        <button type="button" className="btn sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
