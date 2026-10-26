import { useEffect, useRef } from 'react';
import useGoogleMaps, { MAP_ID } from '../hooks/useGoogleMaps.js';
import { formatTravelTime } from './RouteInfo.jsx';

const COLORS = { center: '#0b6b4f', picked: '#d97706', place: '#6b7280', me: '#2563eb' };
const ROUTE_BLUE = '#1a73e8';

const isPoint = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);

// Google's encoded polyline format -> [{ lat, lng }] (what the Routes API returns for a road path).
function decodePolyline(str) {
  const points = [];
  let i = 0; let lat = 0; let lng = 0;
  const next = () => {
    let result = 0; let shift = 0; let b;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Asks Google Directions from the browser (uses the map key). Resolves null if it is not allowed for this key.
function browserDirections(g, from, to) {
  return new Promise((resolve) => {
    try {
      new g.DirectionsService().route({ origin: from, destination: to, travelMode: g.TravelMode.DRIVING }, (res, status) => {
        const leg = res?.routes?.[0]?.legs?.[0];
        if (status !== 'OK' || !leg) return resolve(null);
        resolve({
          path: res.routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
          distanceKm: Math.round(leg.distance.value / 100) / 10,
          minutes: Math.max(1, Math.round(leg.duration.value / 60))
        });
      });
    } catch {
      resolve(null);
    }
  });
}

// A round coloured pin with an optional number, centred on its point (advanced markers anchor at the bottom).
function dotElement(color, size, label) {
  const el = document.createElement('div');
  el.className = 'map-dot';
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, background: color, transform: `translateY(${size / 2}px)` });
  if (label) el.textContent = String(label);
  return el;
}

function routeLabel(distanceKm, minutes, estimated) {
  const box = document.createElement('div');
  box.className = 'route-label';
  box.innerHTML = `<b>${formatTravelTime(minutes)}</b><span>${distanceKm} km${estimated ? ' · estimate' : ''}</span>`;
  return box;
}

// A Google map with numbered markers. markers: [{ id, lat, lng, title, label, tone: 'center' | 'place' }].
// `user` is the customer's own point. `route` can be { from, to, polyline?, distanceKm?, minutes?, estimated? }:
// it draws the road path (from the server's polyline, or Google Directions in the browser) with a time/distance label,
// or a dashed straight line when no road path is available.
// Click a marker to call onSelect(id). Shows nothing but a hint if Google is not set up.
export default function MapView({ markers = [], user = null, selectedId = null, onSelect, onMapClick, route = null, height = 340 }) {
  const { enabled, ready, error } = useGoogleMaps();
  const box = useRef(null);
  const map = useRef(null);
  const drawn = useRef([]);
  const routeDrawn = useRef([]);
  const mapClickListener = useRef(null);
  const lastFit = useRef('');

  const hasRoute = !!route && isPoint(route.from) && isPoint(route.to);

  useEffect(() => {
    if (!ready || !box.current) return;
    if (!map.current) {
      map.current = new window.google.maps.Map(box.current, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, mapId: MAP_ID, mapTypeControl: false, streetViewControl: false, fullscreenControl: true
      });
    }
    const g = window.google.maps;
    mapClickListener.current?.remove();
    mapClickListener.current = onMapClick
      ? map.current.addListener('click', (event) => {
        if (event.latLng) onMapClick({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      })
      : null;
    drawn.current.forEach((m) => { m.map = null; });
    drawn.current = [];

    const pin = ({ position, title, color, size, label, zIndex, onClick }) => {
      const marker = new g.marker.AdvancedMarkerElement({
        map: map.current, position, title, zIndex, content: dotElement(color, size, label), gmpClickable: !!onClick
      });
      if (onClick) marker.addEventListener('gmp-click', onClick);
      drawn.current.push(marker);
    };
    markers.filter(isPoint).forEach((m) => pin({
      position: { lat: m.lat, lng: m.lng },
      title: m.title,
      color: m.id === selectedId ? COLORS.picked : COLORS[m.tone] || COLORS.center,
      size: m.tone === 'place' ? 14 : 24,
      label: m.label,
      zIndex: m.id === selectedId ? 10 : m.tone === 'place' ? 1 : 5,
      onClick: onSelect ? () => onSelect(m.id) : null
    }));
    if (user) pin({ position: user, title: 'You are here', color: COLORS.me, size: 16, zIndex: 20 });

    // Zoom to fit everything, but only when the set of points changes (so clicking a marker doesn't re-zoom).
    // When picking a point, fit only once so each click doesn't snap the map back. A route fits itself (below).
    const sig = JSON.stringify([markers.map((m) => [m.id, m.lat, m.lng]), user]);
    if (sig !== lastFit.current && !(onMapClick && lastFit.current) && !hasRoute) {
      lastFit.current = sig;
      const pts = [...markers, ...(user ? [user] : [])].filter(isPoint);
      if (pts.length === 1) { map.current.setCenter(pts[0]); map.current.setZoom(14); }
      else if (pts.length > 1) {
        const b = new g.LatLngBounds();
        pts.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
        map.current.fitBounds(b, 48);
      }
    }
  }, [ready, markers, user, selectedId, onSelect, onMapClick, hasRoute]);

  // The route from the customer to the selected center, drawn like Google Maps: a blue road line with a time label.
  const routeKey = hasRoute
    ? JSON.stringify([route.from.lat, route.from.lng, route.to.lat, route.to.lng, route.polyline || '', route.distanceKm ?? '', route.minutes ?? '', !!route.estimated])
    : '';
  useEffect(() => {
    const clear = () => {
      routeDrawn.current.forEach((o) => (o.close ? o.close() : o.setMap(null)));
      routeDrawn.current = [];
    };
    clear();
    if (!ready || !map.current || !routeKey) return undefined;
    const g = window.google.maps;
    let alive = true;

    const draw = (path, info, exact) => {
      if (!alive) return;
      clear();
      if (exact) {
        routeDrawn.current.push(
          new g.Polyline({ map: map.current, path, strokeColor: '#ffffff', strokeOpacity: 1, strokeWeight: 9, zIndex: 2 }),
          new g.Polyline({ map: map.current, path, strokeColor: ROUTE_BLUE, strokeOpacity: 1, strokeWeight: 6, zIndex: 3 })
        );
      } else {
        routeDrawn.current.push(new g.Polyline({
          map: map.current, path, strokeOpacity: 0, zIndex: 3,
          icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: ROUTE_BLUE, scale: 4 }, offset: '0', repeat: '16px' }]
        }));
      }
      if (info && Number.isFinite(info.distanceKm) && Number.isFinite(info.minutes)) {
        const label = new g.InfoWindow({
          content: routeLabel(info.distanceKm, info.minutes, !exact || info.estimated),
          position: path[Math.floor(path.length / 2)],
          disableAutoPan: true,
          headerDisabled: true
        });
        label.open({ map: map.current });
        routeDrawn.current.push(label);
      }
      const b = new g.LatLngBounds();
      path.forEach((p) => b.extend(p));
      map.current.fitBounds(b, 70);
    };

    const from = { lat: route.from.lat, lng: route.from.lng };
    const to = { lat: route.to.lat, lng: route.to.lng };
    if (route.polyline) {
      draw(decodePolyline(route.polyline), route, true);
    } else {
      // Show the straight line straight away, then swap in the road path if the browser key may use Directions.
      draw([from, to], route, false);
      browserDirections(g, from, to).then((road) => { if (road) draw(road.path, road, true); });
    }
    return () => { alive = false; clear(); };
  }, [ready, routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => mapClickListener.current?.remove(), []);

  if (!enabled) return <div className="map-note small muted">The map is not set up on this website yet (it needs a Google Maps key). The list below still shows each center’s distance.</div>;
  if (error) return <div className="alert warn">{error}</div>;
  return (
    <div className="map-wrap">
      <div ref={box} className="map-box" style={{ height, cursor: onMapClick ? 'crosshair' : undefined }} role="application" aria-label={onMapClick ? 'Choose a location on the map' : 'Map of service centers'} />
      {!ready && <div className="map-loading small muted">Loading map…</div>}
    </div>
  );
}
