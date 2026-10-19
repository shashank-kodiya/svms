// Distance maths that works without any map service.
const R = 6371; // Earth radius in km
const rad = (d) => (d * Math.PI) / 180;

// Straight-line ("as the crow flies") distance between two points, in km (haversine formula).
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const hasLocation = (c) => Number.isFinite(c?.location?.lat) && Number.isFinite(c?.location?.lng);

// Used when Google Routes is not set up: roads are longer than the straight line (about 1.3x in a city)
// and city traffic averages about 25 km/h. It is an estimate, and the app says so.
export function estimateRoute(km) {
  const road = km * 1.3;
  return { distanceKm: Math.round(road * 10) / 10, minutes: Math.max(1, Math.round((road / 25) * 60)), estimated: true };
}
