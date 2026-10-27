import crypto from 'crypto';
import Booking from '../models/Booking.js';
import VehicleHealth from '../models/VehicleHealth.js';

// A vehicle's service history report, used for the PDF (owner) and the public QR check page (buyer).
// It lists every completed booking for the vehicle, with the km at each service, what was done and the bill.

const HEALTH_LABEL = { good: 'Good', needs_attention: 'Needs attention', replace_soon: 'Replace soon', critical: 'Critical', replaced: 'Replaced', changed: 'Changed' };
export const healthLabel = (v) => HEALTH_LABEL[v] || v;

// Random, unguessable link id. Anyone with the link (or the QR) can see the report; the owner can switch it off.
export const newShareToken = () => crypto.randomBytes(16).toString('hex');

export function historyUrl(token) {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
  return `${base}/history/${token}`;
}

// "KA19MH4521" -> "KA19••4521" (the buyer can match it with the car, but it is not printed in full on a public page).
export const maskReg = (reg = '') => (reg.length > 4 ? `${reg.slice(0, 4)}••${reg.slice(-4)}` : reg);

export async function buildHistory(vehicle) {
  const [bookings, checks] = await Promise.all([
    Booking.find({ vehicle: vehicle._id, status: 'completed' }).populate('center', 'name city').sort({ date: 1, slot: 1 }).lean(),
    VehicleHealth.find({ vehicle: vehicle._id }).sort({ date: 1, createdAt: 1 }).lean()
  ]);
  const checkFor = new Map(checks.filter((h) => h.booking).map((h) => [String(h.booking), h]));

  const services = bookings.map((b) => {
    const check = checkFor.get(String(b._id));
    const repairs = (b.recommendations || []).filter((r) => r.status === 'approved').map((r) => r.problem);
    const parts = [...new Set((b.partsUsed || []).map((p) => p.name))];
    return {
      date: b.date,
      km: check?.km ?? b.vehicleSnapshot?.km ?? null,
      center: b.center ? `${b.center.name}, ${b.center.city}` : 'Service center',
      service: b.service.name,
      repairs,
      parts,
      invoiceNo: b.bill?.invoiceNo || null,
      total: b.bill?.total ?? null
    };
  });

  // Odometer readings should only go up from one service to the next; a drop can mean the meter was changed.
  const kms = services.map((s) => s.km).filter((k) => Number.isFinite(k));
  const odometerConsistent = kms.every((k, i) => i === 0 || k >= kms[i - 1]);

  const latest = checks[checks.length - 1] || null;
  return {
    vehicle: {
      type: vehicle.type, brand: vehicle.brand, model: vehicle.model, variant: vehicle.variant || '',
      year: vehicle.year, fuel: vehicle.fuel, regNumber: vehicle.regNumber, km: vehicle.km
    },
    services,
    totalSpent: services.reduce((sum, s) => sum + (s.total || 0), 0),
    lastService: services[services.length - 1] || null,
    odometerConsistent,
    latestHealth: latest ? { date: latest.date, km: latest.km, items: latest.items } : null,
    documents: {
      insuranceExpiry: vehicle.documents?.insuranceExpiry || null,
      pucExpiry: vehicle.documents?.pucExpiry || null
    },
    generatedAt: new Date()
  };
}
