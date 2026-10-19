// Google Maps Platform calls, made from the server so the key never reaches the browser.
// GOOGLE_MAPS_SERVER_KEY needs these APIs switched on: Geocoding, Routes, Places (New).
// Without a key every function returns null and the app falls back to straight-line distance.
export const mapsReady = () => !!process.env.GOOGLE_MAPS_SERVER_KEY;

const key = () => process.env.GOOGLE_MAPS_SERVER_KEY;
const TIMEOUT_MS = 8000;

// Small cache so repeated searches don't cost money: entries last 10 minutes.
const cache = new Map();
const TTL = 10 * 60 * 1000;
function remember(k, value) {
  if (cache.size > 500) cache.clear();
  cache.set(k, { value, at: Date.now() });
  return value;
}
function recall(k) {
  const hit = cache.get(k);
  return hit && Date.now() - hit.at < TTL ? hit.value : undefined;
}

async function call(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Google returned ${res.status}`);
  return body;
}

// Address -> { lat, lng, formatted } (Geocoding API). null if not found or no key.
export async function geocode(address) {
  if (!mapsReady()) return null;
  const k = `geo:${address.toLowerCase()}`;
  const hit = recall(k);
  if (hit !== undefined) return hit;
  const q = new URLSearchParams({ address, region: 'in', key: key() });
  const body = await call(`https://maps.googleapis.com/maps/api/geocode/json?${q}`);
  if (body.status === 'ZERO_RESULTS') return remember(k, null);
  if (body.status !== 'OK') throw new Error(body.error_message || `Geocoding: ${body.status}`);
  const r = body.results[0];
  return remember(k, { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formatted: r.formatted_address });
}

// Driving distance and time between two points (Routes API, with live traffic). null if no key.
export async function drivingRoute(from, to) {
  if (!mapsReady()) return null;
  const k = `route:${from.lat.toFixed(3)},${from.lng.toFixed(3)}:${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const hit = recall(k);
  if (hit !== undefined) return hit;
  const body = await call('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key(), 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE'
    })
  });
  const r = body.routes?.[0];
  if (!r) return remember(k, null);
  return remember(k, { distanceKm: Math.round(r.distanceMeters / 100) / 10, minutes: Math.max(1, Math.round(parseInt(r.duration, 10) / 60)), estimated: false });
}

// Car repair shops around a point (Places API New, "Nearby Search"). null if no key.
export async function nearbyGarages(at, radiusKm) {
  if (!mapsReady()) return null;
  const k = `places:${at.lat.toFixed(2)},${at.lng.toFixed(2)}:${radiusKm}`;
  const hit = recall(k);
  if (hit !== undefined) return hit;
  const body = await call('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': key(),
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.currentOpeningHours.openNow'
    },
    body: JSON.stringify({
      includedTypes: ['car_repair'],
      maxResultCount: 12,
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: at.lat, longitude: at.lng }, radius: Math.min(50000, radiusKm * 1000) } }
    })
  });
  return remember(k, (body.places || []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text,
    address: p.formattedAddress,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating,
    ratings: p.userRatingCount,
    openNow: p.currentOpeningHours?.openNow,
    url: p.googleMapsUri
  })));
}
