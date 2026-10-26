import ServiceCenter, { MAX_CENTER_PHOTOS } from '../models/ServiceCenter.js';
import Mechanic from '../models/Mechanic.js';
import { cloudinaryReady, uploadImage, deleteImage } from '../config/cloudinary.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { BRANDS } from '../constants/vehicles.js';
import { serviceByKey } from '../constants/services.js';
import { slotsForDate, checkDayHours, isValidDateStr } from '../utils/slots.js';

// Every route here works only on the logged-in owner's own center.
async function myCenter(req) {
  const center = await ServiceCenter.findOne({ owner: req.user._id });
  if (!center) throw new AppError('Service center profile not found.', 404);
  return center;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- profile ----------
export const getProfile = asyncHandler(async (req, res) => {
  res.json(await myCenter(req));
});

export const updateProfile = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  for (const f of ['name', 'description', 'address', 'city', 'pincode', 'phone']) {
    if (req.body[f] !== undefined) center[f] = req.body[f];
  }
  if (req.body.gstin !== undefined) center.gstin = req.body.gstin || undefined; // Phase 6: printed on invoices
  await center.save();
  res.json(center);
});

// ---------- showroom photos ----------
// POST /photos   multipart: image, caption   (the first photo becomes the cover)
export const addPhoto = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  if (center.photos.length >= MAX_CENTER_PHOTOS) throw new AppError(`You can add up to ${MAX_CENTER_PHOTOS} photos. Remove one first.`, 422);
  if (!req.file) throw new AppError('Choose a photo to upload.', 400);
  if (!cloudinaryReady()) throw new AppError('Photo upload is not set up yet. Add the Cloudinary keys to backend/.env.', 503);
  const result = await uploadImage(req.file.buffer, `svms/centers/${center._id}`);
  center.photos.push({
    url: result.secure_url,
    publicId: result.public_id,
    caption: String(req.body.caption || '').trim().slice(0, 120),
    isCover: !center.photos.some((p) => p.isCover)
  });
  await center.save();
  res.status(201).json(center);
});

// PATCH /photos/:photoId/cover
export const setCoverPhoto = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  if (!center.photos.id(req.params.photoId)) throw new AppError('Photo not found.', 404);
  center.photos.forEach((p) => { p.isCover = p._id.equals(req.params.photoId); });
  await center.save();
  res.json(center);
});

// DELETE /photos/:photoId   (if it was the cover, the next photo becomes the cover)
export const deletePhoto = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const p = center.photos.id(req.params.photoId);
  if (!p) throw new AppError('Photo not found.', 404);
  const { publicId } = p;
  center.photos = center.photos.filter((x) => !x._id.equals(p._id));
  if (center.photos.length && !center.photos.some((x) => x.isCover)) center.photos[0].isCover = true;
  await center.save();
  await deleteImage(publicId);
  res.json(center);
});

// PUT /brands   body: { Car: [...], Bike: [...] }
export const setBrands = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const next = {};
  for (const type of ['Car', 'Bike']) {
    const list = [...new Set(req.body[type] || [])];
    const bad = list.find((b) => !BRANDS[type].includes(b));
    if (bad) throw new AppError(`${bad} is not in the ${type.toLowerCase()} brand list.`, 422);
    next[type] = list;
  }
  // Don't leave services for a vehicle type the center no longer works on.
  const orphan = center.services.find((s) => s.isActive && next[s.vehicleType].length === 0);
  if (orphan) {
    throw new AppError(`You still offer ${serviceByKey(orphan.key)?.name || orphan.key} for ${orphan.vehicleType.toLowerCase()}s. Turn those services off before removing every ${orphan.vehicleType.toLowerCase()} brand.`, 422);
  }
  center.brands = next;
  await center.save();
  res.json(center);
});

// ---------- services ----------
function checkServiceFits(center, key, vehicleType) {
  const def = serviceByKey(key);
  if (!def) throw new AppError('Choose a service from the list.', 422);
  if (!def.types.includes(vehicleType)) throw new AppError(`${def.name} is not offered for ${vehicleType.toLowerCase()}s.`, 422);
  if (!center.brands[vehicleType]?.length) {
    throw new AppError(`Add at least one ${vehicleType.toLowerCase()} brand in your profile before adding ${vehicleType.toLowerCase()} services.`, 422);
  }
}

export const addService = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const { key, vehicleType, price, durationMins, notes } = req.body;
  checkServiceFits(center, key, vehicleType);
  if (center.services.some((s) => s.key === key && s.vehicleType === vehicleType)) {
    throw new AppError(`You already offer ${serviceByKey(key).name} for ${vehicleType.toLowerCase()}s. Edit the existing price instead.`, 409);
  }
  center.services.push({ key, vehicleType, price, durationMins, notes });
  await center.save();
  res.status(201).json(center);
});

export const updateService = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const svc = center.services.id(req.params.serviceId);
  if (!svc) throw new AppError('Service not found.', 404);
  for (const f of ['price', 'durationMins', 'notes', 'isActive']) if (req.body[f] !== undefined) svc[f] = req.body[f];
  if (svc.isActive) checkServiceFits(center, svc.key, svc.vehicleType);
  await center.save();
  res.json(center);
});

export const deleteService = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const svc = center.services.id(req.params.serviceId);
  if (!svc) throw new AppError('Service not found.', 404);
  center.services = center.services.filter((x) => !x._id.equals(svc._id));
  await center.save();
  res.json(center);
});

// ---------- hours, slots, holidays ----------
export const setHours = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const days = req.body.workingHours;
  if (!Array.isArray(days) || days.length !== 7) throw new AppError('Send all 7 days.', 422);
  const seen = new Set();
  for (const d of days) {
    if (!Number.isInteger(d.day) || d.day < 0 || d.day > 6 || seen.has(d.day)) throw new AppError('Each day must appear once.', 422);
    seen.add(d.day);
    const problem = checkDayHours(d);
    if (problem) throw new AppError(`${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.day]}: ${problem}`, 422);
  }
  center.workingHours = days
    .map((d) => ({ day: d.day, isOpen: !!d.isOpen, open: d.open, close: d.close, breakStart: d.breakStart || '', breakEnd: d.breakEnd || '' }))
    .sort((a, b) => a.day - b.day);
  await center.save();
  res.json(center);
});

export const setSlotSettings = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const { capacityPerSlot, bookingWindowDays } = req.body;
  if (capacityPerSlot !== undefined) center.slotSettings.capacityPerSlot = capacityPerSlot;
  if (bookingWindowDays !== undefined) center.slotSettings.bookingWindowDays = bookingWindowDays;
  await center.save();
  res.json(center);
});

export const addHoliday = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const { date, reason } = req.body;
  if (!isValidDateStr(date)) throw new AppError('Choose a valid date.', 422);
  if (date < todayStr()) throw new AppError('Choose today or a future date.', 422);
  if (center.holidays.some((h) => h.date === date)) throw new AppError('That date is already marked as a holiday.', 409);
  center.holidays.push({ date, reason });
  center.holidays.sort((a, b) => a.date.localeCompare(b.date));
  await center.save();
  res.status(201).json(center);
});

export const removeHoliday = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const before = center.holidays.length;
  center.holidays = center.holidays.filter((h) => h.date !== req.params.date);
  if (center.holidays.length === before) throw new AppError('Holiday not found.', 404);
  await center.save();
  res.json(center);
});

// GET /slots/preview?date=YYYY-MM-DD
export const previewSlots = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const date = req.query.date || todayStr();
  if (!isValidDateStr(date)) throw new AppError('Choose a valid date.', 422);
  res.json({ date, ...slotsForDate(center, date) });
});

// ---------- mechanics ----------
export const listMechanics = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const filter = { center: center._id };
  if (req.query.all !== 'true') filter.isActive = true;
  res.json(await Mechanic.find(filter).sort({ isActive: -1, name: 1 }));
});

export const addMechanic = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const { name, phone, skills, experienceYears } = req.body;
  const mech = await Mechanic.create({ center: center._id, name, phone, skills, experienceYears });
  res.status(201).json(mech);
});

export const updateMechanic = asyncHandler(async (req, res) => {
  const center = await myCenter(req);
  const mech = await Mechanic.findOne({ _id: req.params.mechanicId, center: center._id });
  if (!mech) throw new AppError('Mechanic not found.', 404);
  for (const f of ['name', 'phone', 'skills', 'experienceYears', 'isActive']) if (req.body[f] !== undefined) mech[f] = req.body[f];
  await mech.save();
  res.json(mech);
});
