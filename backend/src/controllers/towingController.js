import ServiceCenter, { TOW_VEHICLE_TYPES } from '../models/ServiceCenter.js';
import TowRequest, { TOW_OPEN } from '../models/TowRequest.js';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import User from '../models/User.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { haversineKm, hasLocation, estimateRoute } from '../services/geo.js';
import { drivingRoute } from '../services/maps.js';
import { notify } from '../services/notifications.js';
import { emitToUser } from '../realtime.js';
import { openStatus } from './mapsController.js';

const round1 = (n) => Math.round(n * 10) / 10;
const mapsLink = (p) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
const TYPE_LABEL = { flatbed: 'Flatbed truck', wheel_lift: 'Wheel-lift truck', bike_carrier: 'Bike carrier' };

async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

// Can this center's tow trucks go out now? Always if 24x7, otherwise during its working hours.
const towingAvailable = (c) => !!c.towing?.available24x7 || openStatus(c).isOpen;

// ======================= Service center =======================

// GET /api/towing/center   The center's towing settings and tow trucks.
export const getTowing = asyncHandler(async (req, res) => {
  const c = await myCenter(req);
  res.json({ enabled: false, radiusKm: 25, available24x7: false, charges: '', contacts: [], ...c.towing?.toObject?.() });
});

// PUT /api/towing/center   body: { enabled, radiusKm, available24x7, charges, contacts: [{ name, phone, vehicleType }] }
export const updateTowing = asyncHandler(async (req, res) => {
  const c = await myCenter(req);
  const contacts = (req.body.contacts || []).map((x) => ({ name: x.name, phone: x.phone.replace(/\s/g, ''), vehicleType: x.vehicleType || 'flatbed' }));
  if (req.body.enabled && !contacts.length) throw new AppError('Add at least one tow truck contact to offer towing.', 422);
  if (req.body.enabled && !hasLocation(c)) throw new AppError('Set your location on the map (Profile) first, so customers nearby can find your towing.', 422);
  c.towing = { enabled: !!req.body.enabled, radiusKm: req.body.radiusKm || 25, available24x7: !!req.body.available24x7, charges: req.body.charges || '', contacts };
  await c.save();
  res.json(c.towing);
});

// Google Maps directions for the tow truck: from the center (where the truck leaves) to the customer.
// Without an origin Google starts from wherever the viewer's device is, which is wrong on a desk PC.
const truckDirections = (center, to) => (hasLocation(center)
  ? `https://www.google.com/maps/dir/?api=1&origin=${center.location.lat},${center.location.lng}&destination=${to.lat},${to.lng}&travelmode=driving`
  : `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=driving`);

// GET /api/towing/center/requests?status=open|history|all   (history: towed, declined or cancelled)
export const centerTowRequests = asyncHandler(async (req, res) => {
  const c = await myCenter(req);
  const filter = { center: c._id };
  if (req.query.status === 'history') filter.status = { $nin: TOW_OPEN };
  else if (req.query.status !== 'all') filter.status = { $in: TOW_OPEN };
  const list = await TowRequest.find(filter).sort({ createdAt: -1 }).limit(100).populate('customer', 'name').populate('booking', 'bookingNo').lean();
  res.json(list.map((t) => ({ ...t, mapUrl: mapsLink(t.location), directionsUrl: truckDirections(c, t.location) })));
});

// GET /api/towing/center/requests/:id/route   Road route for the tow truck, drawn on the Towing page.
export const towRoute = asyncHandler(async (req, res) => {
  const c = await myCenter(req);
  const t = await TowRequest.findOne({ _id: req.params.id, center: c._id }).select('location').lean();
  if (!t) throw new AppError('Tow request not found.', 404);
  if (!hasLocation(c)) throw new AppError('Set your center\'s location on the map (Profile) to see the route.', 409);
  const from = { lat: c.location.lat, lng: c.location.lng };
  const base = { from, to: t.location, directionsUrl: truckDirections(c, t.location) };
  try {
    const r = await drivingRoute(from, t.location);
    if (r) return res.json({ ...base, ...r });
  } catch (err) {
    console.warn(`Google Routes failed for tow route, using an estimate: ${err.message}`);
  }
  res.json({ ...base, ...estimateRoute(haversineKm(from, t.location)) });
});

// PATCH /api/towing/center/requests/:id   body: { status: accepted | on_the_way | completed | declined, note }
const NEXT = { requested: ['accepted', 'declined'], accepted: ['on_the_way', 'declined'], on_the_way: ['completed'] };
const CUSTOMER_TEXT = {
  accepted: (c) => `${c.name} accepted your tow request. A truck will be sent to you.`,
  on_the_way: (c) => `The tow truck from ${c.name} is on the way to you.`,
  completed: (c) => `Your vehicle has been towed by ${c.name}.`,
  declined: (c) => `${c.name} cannot send a tow truck right now. Try another center on the Roadside help page.`
};
export const updateTowRequest = asyncHandler(async (req, res) => {
  const c = await myCenter(req);
  const t = await TowRequest.findOne({ _id: req.params.id, center: c._id });
  if (!t) throw new AppError('Tow request not found.', 404);
  const to = req.body.status;
  const NOW = { requested: 'new', accepted: 'accepted', on_the_way: 'on the way', completed: 'already done', declined: 'declined', cancelled: 'cancelled by the customer' };
  if (!NEXT[t.status]?.includes(to)) throw new AppError(`This request is ${NOW[t.status]}, so it can't be marked "${to.replace('_', ' ')}" now.`, 409);
  t.status = to;
  if (req.body.note) t.centerNote = req.body.note;
  t.history.push({ status: to });
  await t.save();
  await notify(t.customer, {
    type: 'towing',
    title: { accepted: 'Tow request accepted', on_the_way: 'Tow truck on the way', completed: 'Towing done', declined: 'Tow request declined' }[to],
    body: `${CUSTOMER_TEXT[to](c)}${req.body.note ? ` ${req.body.note}` : ''}`,
    link: '/customer/towing'
  });
  emitToUser(t.customer, 'tow:changed', { id: String(t._id), status: to });
  res.json(t);
});

// ======================= Customer =======================

// GET /api/towing/nearby?lat=&lng=&bookingId=   Centers whose tow trucks reach this point, nearest first.
// The booked center (if any) comes first, even if it is farther.
export const towingNearby = asyncHandler(async (req, res) => {
  const me = { lat: req.query.lat, lng: req.query.lng };
  let bookedCenter = null;
  if (req.query.bookingId) {
    const b = await Booking.findOne({ _id: req.query.bookingId, customer: req.user._id }).select('center').lean();
    bookedCenter = b ? String(b.center) : null;
  }
  const centers = await ServiceCenter.find({ verificationStatus: 'verified', 'towing.enabled': true })
    .select('name address city phone location towing workingHours holidays brands').lean();
  const list = centers.filter(hasLocation).map((c) => {
    const km = round1(haversineKm(me, c.location));
    return {
      _id: c._id, name: c.name, address: `${c.address}, ${c.city}`, phone: c.phone, distanceKm: km,
      inRange: km <= (c.towing.radiusKm || 25),
      availableNow: towingAvailable(c),
      available24x7: !!c.towing.available24x7,
      radiusKm: c.towing.radiusKm,
      charges: c.towing.charges || '',
      contacts: c.towing.contacts.map((x) => ({ name: x.name, phone: x.phone, vehicleType: x.vehicleType, vehicleLabel: TYPE_LABEL[x.vehicleType] })),
      brands: [...(c.brands?.Car || []), ...(c.brands?.Bike || [])],
      booked: bookedCenter === String(c._id)
    };
  }).filter((c) => c.inRange || c.booked);
  list.sort((a, b) => Number(b.booked) - Number(a.booked) || Number(b.availableNow) - Number(a.availableNow) || a.distanceKm - b.distanceKm);
  res.json({ centers: list.slice(0, 20) });
});

// POST /api/towing/requests   body: { centerId, lat, lng, phone, note, bookingId?, vehicleId? }
export const createTowRequest = asyncHandler(async (req, res) => {
  const { centerId, lat, lng, phone, note, bookingId, vehicleId } = req.body;
  if (await TowRequest.exists({ customer: req.user._id, status: { $in: TOW_OPEN } })) {
    throw new AppError('You already have a tow request in progress. Cancel it first to ask another center.', 409);
  }
  const c = await ServiceCenter.findOne({ _id: centerId, verificationStatus: 'verified', 'towing.enabled': true })
    .select('name owner location towing workingHours holidays').lean();
  if (!c) throw new AppError('This center does not offer towing.', 404);
  const where = { lat, lng };
  const km = round1(haversineKm(where, c.location));

  let booking = null;
  if (bookingId) booking = await Booking.findOne({ _id: bookingId, customer: req.user._id }).select('bookingNo vehicle vehicleSnapshot center').lean();
  if (!booking && km > (c.towing.radiusKm || 25)) throw new AppError(`You are ${km} km away; this center tows up to ${c.towing.radiusKm} km.`, 422);
  const v = vehicleId ? await Vehicle.findOne({ _id: vehicleId, owner: req.user._id }).select('brand model regNumber type').lean() : null;
  const vehicle = v || booking?.vehicleSnapshot || {};

  const t = await TowRequest.create({
    customer: req.user._id, center: c._id, booking: booking?._id || null,
    vehicle: { brand: vehicle.brand, model: vehicle.model, regNumber: vehicle.regNumber, type: vehicle.type },
    location: where, distanceKm: km, phone, note, history: [{ status: 'requested' }]
  });

  const who = await User.findById(req.user._id).select('name').lean();
  const what = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'A vehicle';
  await notify(c.owner, {
    type: 'towing',
    title: `Tow request: ${vehicle.regNumber || what}`,
    body: `${who?.name || 'A customer'} needs towing ${km} km away${booking ? ` (booking ${booking.bookingNo})` : ''}. ${what}. Call ${phone}.${note ? ` "${note}"` : ''}`,
    link: '/center/towing',
    email: true
  });
  emitToUser(c.owner, 'tow:changed', { id: String(t._id), status: 'requested' });
  res.status(201).json({ ...t.toObject(), centerName: c.name });
});

// GET /api/towing/requests   The customer's tow requests (latest first).
export const myTowRequests = asyncHandler(async (req, res) => {
  const list = await TowRequest.find({ customer: req.user._id }).sort({ createdAt: -1 }).limit(20)
    .populate('center', 'name phone towing.contacts').lean();
  res.json(list);
});

// PATCH /api/towing/requests/:id/cancel
export const cancelTowRequest = asyncHandler(async (req, res) => {
  const t = await TowRequest.findOne({ _id: req.params.id, customer: req.user._id });
  if (!t) throw new AppError('Tow request not found.', 404);
  if (!TOW_OPEN.includes(t.status)) throw new AppError('This request is already closed.', 409);
  t.status = 'cancelled';
  t.history.push({ status: 'cancelled' });
  await t.save();
  const c = await ServiceCenter.findById(t.center).select('owner').lean();
  if (c) {
    await notify(c.owner, { type: 'towing', title: 'Tow request cancelled', body: `The customer cancelled the tow request for ${t.vehicle?.regNumber || 'their vehicle'}.`, link: '/center/towing' });
    emitToUser(c.owner, 'tow:changed', { id: String(t._id), status: 'cancelled' });
  }
  res.json(t);
});

export { TOW_VEHICLE_TYPES };
