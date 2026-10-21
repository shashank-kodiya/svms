import { useEffect, useRef } from 'react';
import useGoogleMaps from '../hooks/useGoogleMaps.js';

const COLORS = { center: '#0b6b4f', picked: '#d97706', place: '#6b7280', me: '#2563eb' };

// A Google map with numbered markers. markers: [{ id, lat, lng, title, label, tone: 'center' | 'place' }].
// `user` is the customer's own point. `route` can be { from, to } and draws a route line on the map.
// Click a marker to call onSelect(id). Shows nothing but a hint if Google is not set up.
export default function MapView({ markers = [], user = null, selectedId = null, onSelect, route = null, height = 340 }) {
  const { enabled, ready, error } = useGoogleMaps();
  const box = useRef(null);
  const map = useRef(null);
  const drawn = useRef([]);
  const lastFit = useRef('');

  useEffect(() => {
    if (!ready || !box.current) return;
    if (!map.current) {
      map.current = new window.google.maps.Map(box.current, {
        center: { lat: 20.5937, lng: 78.9629 }, zoom: 5, mapTypeControl: false, streetViewControl: false, fullscreenControl: true
      });
    }
    const g = window.google.maps;
    drawn.current.forEach((m) => m.setMap(null));
    drawn.current = [];

    const dot = (color, scale) => ({ path: g.SymbolPath.CIRCLE, scale, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 });
    markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)).forEach((m) => {
      const marker = new g.Marker({
        map: map.current,
        position: { lat: m.lat, lng: m.lng },
        title: m.title,
        icon: dot(m.id === selectedId ? COLORS.picked : COLORS[m.tone] || COLORS.center, m.tone === 'place' ? 7 : 12),
        label: m.label ? { text: String(m.label), color: '#ffffff', fontSize: '11px', fontWeight: '700' } : undefined,
        zIndex: m.id === selectedId ? 10 : m.tone === 'place' ? 1 : 5
      });
      if (onSelect) marker.addListener('click', () => onSelect(m.id));
      drawn.current.push(marker);
    });
    if (user) {
      drawn.current.push(new g.Marker({ map: map.current, position: user, title: 'You are here', icon: dot(COLORS.me, 8), zIndex: 20 }));
    }
    if (route && Number.isFinite(route.from?.lat) && Number.isFinite(route.from?.lng) && Number.isFinite(route.to?.lat) && Number.isFinite(route.to?.lng)) {
      const path = new g.Polyline({
        map: map.current,
        path: [
          { lat: route.from.lat, lng: route.from.lng },
          { lat: route.to.lat, lng: route.to.lng }
        ],
        strokeColor: '#4f8ef7',
        strokeOpacity: 0.95,
        strokeWeight: 4,
        geodesic: true
      });
      drawn.current.push(path);
    }

    // Zoom to fit everything, but only when the set of points changes (so clicking a marker doesn't re-zoom).
    const sig = JSON.stringify([markers.map((m) => [m.id, m.lat, m.lng]), user, route]);
    if (sig !== lastFit.current) {
      lastFit.current = sig;
      const pts = [...markers, ...(user ? [user] : [])].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
      if (route && Number.isFinite(route.from?.lat) && Number.isFinite(route.from?.lng) && Number.isFinite(route.to?.lat) && Number.isFinite(route.to?.lng)) {
        const b = new g.LatLngBounds();
        b.extend({ lat: route.from.lat, lng: route.from.lng });
        b.extend({ lat: route.to.lat, lng: route.to.lng });
        map.current.fitBounds(b, 80);
      } else if (pts.length === 1) { map.current.setCenter(pts[0]); map.current.setZoom(14); }
      else if (pts.length > 1) {
        const b = new g.LatLngBounds();
        pts.forEach((p) => b.extend({ lat: p.lat, lng: p.lng }));
        map.current.fitBounds(b, 48);
      }
    }
  }, [ready, markers, user, selectedId, onSelect, route]);

  if (!enabled) return <div className="map-note small muted">The map is not set up on this website yet (it needs a Google Maps key). The list below still shows each center’s distance.</div>;
  if (error) return <div className="alert warn">{error}</div>;
  return (
    <div className="map-wrap">
      <div ref={box} className="map-box" style={{ height }} role="application" aria-label="Map of service centers" />
      {!ready && <div className="map-loading small muted">Loading map…</div>}
    </div>
  );
}
