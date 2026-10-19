import ServiceCenter from '../models/ServiceCenter.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { haversineKm, hasLocation, estimateRoute } from '../services/geo.js';
import { mapsReady, geocode, drivingRoute, nearbyGarages } from '../services/maps.js';

const round1 = (n) => Math.round(n * 10) / 10;

// ---------------- Customer ----------------

// GET /api/maps/status   Tells the app whether Google is set up (otherwise distances are straight-line estimates).
export const status = (req, res) => res.json({ google: mapsReady() });

// GET /api/maps/centers?lat=&lng=&radiusKm=   Verified centers that have a map location, nearest first.
export const centersOnMap = asyncHandler(async (req, res) => {
  const me = { lat: req.query.lat, lng: req.query.lng };
  const centers = await ServiceCenter.find({ verificationStatus: 'verified', 'location.lat': { $exists: true }, 'location.lng': { $exists: true } })
    .select('name address city pincode phone description brands location ratingAvg ratingCount').limit(300).lean();
  let list = centers.filter(hasLocation).map((c) => ({
    _id: c._id, name: c.name, address: c.address, city: c.city, pincode: c.pincode, phone: c.phone, description: c.description,
    brands: c.brands, ratingAvg: c.ratingAvg || 0, ratingCount: c.ratingCount || 0, lat: c.location.lat, lng: c.location.lng,
    distanceKm: me.lat != null ? round1(haversineKm(me, c.location)) : null
  }));
  if (me.lat != null) {
    if (req.query.radiusKm) list = list.filter((c) => c.distanceKm <= req.query.radiusKm);
    list.sort((a, b) => a.distanceKm - b.distanceKm);
  }
  res.json({ google: mapsReady(), centers: list });
});

// GET /api/maps/route?centerId=&lat=&lng=   Driving distance and time from the customer to a center.
export const routeToCenter = asyncHandler(async (req, res) => {
  const center = await ServiceCenter.findOne({ _id: req.query.centerId, verificationStatus: 'verified' }).select('location name');
  if (!center) throw new AppError('Service center not found.', 404);
  if (!hasLocation(center)) throw new AppError('This center has not set its map location yet.', 404);
  const from = { lat: req.query.lat, lng: req.query.lng };
  const straightKm = haversineKm(from, center.location);
  try {
    const r = await drivingRoute(from, center.location);
    if (r) return res.json({ ...r, straightKm: round1(straightKm), directionsUrl: directionsUrl(from, center.location) });
  } catch (err) {
    console.warn(`Google Routes failed, using an estimate: ${err.message}`); // never block the customer on this
  }
  res.json({ ...estimateRoute(straightKm), straightKm: round1(straightKm), directionsUrl: directionsUrl(from, center.location) });
});

// Opens Google Maps with directions already filled in (no API key needed).
const directionsUrl = (from, to) =>
  `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;

// GET /api/maps/places?lat=&lng=&radiusKm=   Other garages around the customer from Google Places.
export const otherGarages = asyncHandler(async (req, res) => {
  if (!mapsReady()) return res.json({ available: false, places: [], message: 'Google Places is not set up on this server.' });
  const at = { lat: req.query.lat, lng: req.query.lng };
  let places;
  try {
    places = await nearbyGarages(at, req.query.radiusKm || 5);
  } catch (err) {
    console.warn(`Google Places failed: ${err.message}`);
    throw new AppError('Google Places did not answer. Try again in a moment.', 502);
  }
  // Leave out garages that are already on SVMS (same name within about 150 m), so nothing is listed twice.
  const ours = await ServiceCenter.find({ 'location.lat': { $exists: true } }).select('name location').lean();
  const fresh = places.filter((p) => !ours.some((c) => c.name.trim().toLowerCase() === (p.name || '').trim().toLowerCase() && haversineKm({ lat: p.lat, lng: p.lng }, c.location) < 0.15));
  res.json({
    available: true,
    places: fresh.map((p) => ({ ...p, distanceKm: round1(haversineKm(at, p)) })).sort((a, b) => a.distanceKm - b.distanceKm)
  });
});

// ---------------- Service center ----------------

async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

// PUT /api/center/location   body: { lat, lng }   (for example from "Use my current location" at the shop)
export const setLocation = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  center.location = { lat: req.body.lat, lng: req.body.lng, source: 'device' };
  await center.save();
  res.json(center);
});

// POST /api/center/location/from-address   Finds the map point for the saved address with Google Geocoding.
export const locationFromAddress = asyncHandler(async (req, res) => {
  if (!mapsReady()) throw new AppError('Finding a location from an address needs Google Maps to be set up on the server. Use "Use my current location" instead.', 503);
  const center = await myCenter(req);
  let found;
  try {
    found = await geocode(`${center.address}, ${center.city} ${center.pincode}, India`);
  } catch (err) {
    console.warn(`Geocoding failed: ${err.message}`);
    throw new AppError('Google could not look up the address right now. Try again, or use "Use my current location".', 502);
  }
  if (!found) throw new AppError('Google could not find this address. Check the address, city and PIN code, or use "Use my current location".', 422);
  center.location = { lat: found.lat, lng: found.lng, source: 'address' };
  await center.save();
  res.json(center);
});

// DELETE /api/center/location
export const clearLocation = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  center.location = undefined;
  await center.save();
  res.json(center);
});
