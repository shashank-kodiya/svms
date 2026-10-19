import Vehicle from '../models/Vehicle.js';
import VehicleHealth from '../models/VehicleHealth.js';
import AppError, { asyncHandler } from '../utils/AppError.js';
import { normaliseReg, BRANDS } from '../constants/vehicles.js';
import { cloudinaryReady, uploadImage, deleteImage } from '../config/cloudinary.js';
import { nowIST } from '../utils/time.js';
import { buildSuggestions } from '../services/maintenance.js';

const MAX_KM_JUMP = 100000;

// Loads a vehicle only if it belongs to the logged-in customer.
// Another customer's vehicle gives the same 404 as a missing one, so IDs reveal nothing.
async function ownVehicle(req) {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, owner: req.user._id, isActive: true });
  if (!vehicle) throw new AppError('Vehicle not found.', 404);
  return vehicle;
}

async function assertRegFree(regNumber, exceptId) {
  const clash = await Vehicle.findOne({ regNumber, isActive: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).lean();
  if (clash) throw new AppError('A vehicle with this registration number is already registered on the platform.', 409);
}

const pickDocs = (d = {}) => ({
  insuranceExpiry: d.insuranceExpiry || undefined,
  pucExpiry: d.pucExpiry || undefined,
  rcExpiry: d.rcExpiry || undefined
});

// GET /api/vehicles
export const listVehicles = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ owner: req.user._id, isActive: true }).sort({ createdAt: 1 });
  res.json(vehicles);
});

// GET /api/vehicles/:id
export const getVehicle = asyncHandler(async (req, res) => {
  res.json(await ownVehicle(req));
});

// POST /api/vehicles
export const createVehicle = asyncHandler(async (req, res) => {
  const { type, brand, model, variant, year, regNumber, fuel, km, documents } = req.body;
  const reg = normaliseReg(regNumber);
  await assertRegFree(reg);
  const vehicle = await Vehicle.create({
    owner: req.user._id,
    type, brand, model, variant, year, fuel,
    regNumber: reg,
    km,
    odometer: [{ km, date: new Date() }],
    documents: pickDocs(documents)
  });
  res.status(201).json(vehicle);
});

// PATCH /api/vehicles/:id   (details only; odometer and documents have their own routes)
export const updateVehicle = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  const fields = ['type', 'brand', 'model', 'variant', 'year', 'fuel'];
  for (const f of fields) if (req.body[f] !== undefined) vehicle[f] = req.body[f];
  if (req.body.regNumber !== undefined) {
    const reg = normaliseReg(req.body.regNumber);
    if (reg !== vehicle.regNumber) await assertRegFree(reg, vehicle._id);
    vehicle.regNumber = reg;
  }
  if (!BRANDS[vehicle.type]?.includes(vehicle.brand)) {
    throw new AppError(`${vehicle.brand} is not a ${vehicle.type.toLowerCase()} brand. Choose the brand again.`, 422);
  }
  await vehicle.save();
  res.json(vehicle);
});

// POST /api/vehicles/:id/odometer   body: { km }
export const addOdometer = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  const km = Math.round(req.body.km);
  if (km < vehicle.km) throw new AppError(`The reading can't be lower than the current ${vehicle.km.toLocaleString('en-IN')} km.`, 422);
  if (km - vehicle.km > MAX_KM_JUMP) throw new AppError('That is a very large jump. Please check the reading.', 422);

  // Keep one reading per day: replace today's reading if there is one.
  const today = new Date().toDateString();
  vehicle.odometer = vehicle.odometer.filter((o) => new Date(o.date).toDateString() !== today || o.source !== 'customer');
  vehicle.odometer.push({ km, date: new Date(), source: 'customer' });
  vehicle.km = km;
  await vehicle.save();
  res.json(vehicle);
});

// PUT /api/vehicles/:id/documents   body: { insuranceExpiry, pucExpiry, rcExpiry }  (empty = remove)
export const setDocuments = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  vehicle.documents = pickDocs(req.body);
  await vehicle.save();
  res.json(vehicle);
});

// POST /api/vehicles/:id/image   multipart field "image"
export const uploadVehicleImage = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  if (!req.file) throw new AppError('Choose a photo to upload.', 400);
  if (!cloudinaryReady()) throw new AppError('Photo upload is not set up yet. Add the Cloudinary keys to backend/.env.', 503);

  const result = await uploadImage(req.file.buffer, `svms/vehicles/${req.user._id}`);
  const oldId = vehicle.image?.publicId;
  vehicle.image = { url: result.secure_url, publicId: result.public_id };
  await vehicle.save();
  await deleteImage(oldId);
  res.json(vehicle);
});

// DELETE /api/vehicles/:id/image
export const removeVehicleImage = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  const oldId = vehicle.image?.publicId;
  vehicle.image = undefined;
  await vehicle.save();
  await deleteImage(oldId);
  res.json(vehicle);
});

// DELETE /api/vehicles/:id
// Archives instead of deleting, so future service history and bills keep their vehicle.
export const archiveVehicle = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  vehicle.isActive = false;
  await vehicle.save();
  res.json({ message: 'Vehicle removed from your list.' });
});

// GET /api/vehicles/:id/health   every inspection of this vehicle, oldest first
export const vehicleHealth = asyncHandler(async (req, res) => {
  const vehicle = await ownVehicle(req);
  const records = await VehicleHealth.find({ vehicle: vehicle._id }).sort({ date: 1, createdAt: 1 }).populate('center', 'name').lean();
  res.json(records);
});

// GET /api/vehicles/suggestions   Maintenance suggestions for each of my vehicles (Phase 8).
// Only vehicles that have something to suggest are returned.
export const suggestions = asyncHandler(async (req, res) => {
  const vehicles = await Vehicle.find({ owner: req.user._id, isActive: true }).lean();
  const today = nowIST().date;
  const out = [];
  for (const v of vehicles) {
    const latest = await VehicleHealth.findOne({ vehicle: v._id }).sort({ date: -1, createdAt: -1 }).lean();
    const items = buildSuggestions(v, latest, today);
    if (items.length) out.push({ vehicleId: v._id, name: `${v.brand} ${v.model}`, regNumber: v.regNumber, items });
  }
  res.json(out);
});
