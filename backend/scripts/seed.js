// Creates the admin account plus one demo customer and one demo service center.
// Safe to run more than once: existing accounts are left unchanged.
// Run:  npm run seed
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import ServiceCenter from '../src/models/ServiceCenter.js';
import Vehicle from '../src/models/Vehicle.js';
import Mechanic from '../src/models/Mechanic.js';
import Booking from '../src/models/Booking.js';
import SlotSeat from '../src/models/SlotSeat.js';
import VehicleHealth from '../src/models/VehicleHealth.js';
import SparePart from '../src/models/SparePart.js';
import { nowIST, addDaysStr } from '../src/utils/time.js';

async function ensureUser(data) {
  const found = await User.findOne({ email: data.email });
  if (found) {
    console.log(`exists   ${data.role.padEnd(15)} ${data.email}`);
    return found;
  }
  const user = await User.create(data);
  console.log(`created  ${data.role.padEnd(15)} ${data.email}`);
  return user;
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  await ensureUser({
    name: 'Platform Admin',
    email: process.env.ADMIN_EMAIL || 'admin@svms.local',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe@123',
    role: 'admin'
  });

  // Phase 10: on a live (deployed) database create only the admin. The demo accounts below have
  // well-known passwords, so they must never exist in production.   npm run seed:admin
  if (process.argv.includes('--admin-only')) {
    console.log('Admin only: demo customer, centers and data were skipped.');
    await mongoose.disconnect();
    return;
  }

  const customer = await ensureUser({ name: 'Demo Customer', email: 'customer@svms.local', phone: '9000000001', password: 'Customer@123', role: 'customer' });
  if (!(await Vehicle.exists({ owner: customer._id }))) {
    const day = (offset) => new Date(Date.now() + offset * 86400000);
    await Vehicle.create([
      {
        owner: customer._id, type: 'Car', brand: 'Hyundai', model: 'Creta', variant: 'SX', year: 2023,
        regNumber: 'KA09MB4821', fuel: 'Petrol', km: 18450,
        odometer: [{ km: 10120, date: day(-275) }, { km: 15800, date: day(-116) }, { km: 18450, date: day(-4) }],
        documents: { insuranceExpiry: day(155), pucExpiry: day(10), rcExpiry: day(4135) }
      },
      {
        owner: customer._id, type: 'Bike', brand: 'Honda', model: 'Activa 6G', year: 2021,
        regNumber: 'KA09HK1177', fuel: 'Petrol', km: 21300,
        odometer: [{ km: 20050, date: day(-73) }, { km: 21300, date: day(-13) }],
        documents: { insuranceExpiry: day(36), pucExpiry: day(92), rcExpiry: day(3578) }
      }
    ]);
    console.log('created  2 demo vehicles for the customer');
  }

  const owner = await ensureUser({ name: 'Kaveri Motor Works', email: 'center@svms.local', phone: '9000000101', password: 'Center@123', role: 'service_center' });
  if (!(await ServiceCenter.exists({ owner: owner._id }))) {
    await ServiceCenter.create({
      owner: owner._id,
      name: 'Kaveri Motor Works',
      address: '4th Cross, Saraswathipuram',
      city: 'Mysuru',
      pincode: '570009',
      phone: '9000000101',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
    });
    console.log('created  service center profile (verified)');
  }
  const kaveri = await ServiceCenter.findOne({ owner: owner._id });
  // Phase 3 setup for the demo center (also fills it in if it was created by an earlier phase).
  if (!kaveri.services.length) {
    Object.assign(kaveri, {
      description: 'Multi-brand car workshop since 2009. Genuine parts, pick-up on request.',
      brands: { Car: ['Hyundai', 'Maruti Suzuki', 'Honda'], Bike: ['Honda', 'TVS'] },
      services: [
        { key: 'general_service', vehicleType: 'Car', price: 4200, durationMins: 240, notes: 'Oil, filters and 40-point check' },
        { key: 'oil_change', vehicleType: 'Car', price: 2400, durationMins: 60 },
        { key: 'brake_repair', vehicleType: 'Car', price: 1800, durationMins: 120, notes: 'Labour only; pads extra' },
        { key: 'battery_service', vehicleType: 'Car', price: 900, durationMins: 45 },
        { key: 'ac_service', vehicleType: 'Car', price: 1500, durationMins: 90 },
        { key: 'general_service', vehicleType: 'Bike', price: 950, durationMins: 120 }
      ],
    });
    await kaveri.save();
    console.log('added    brands and services to the demo center');
  }
  if (!(await Mechanic.exists({ center: kaveri._id }))) {
    await Mechanic.create([
      { center: kaveri._id, name: 'Ravi Kumar', phone: '9000000201', skills: ['Engine', 'Brakes'], experienceYears: 8 },
      { center: kaveri._id, name: 'Suresh P.', phone: '9000000202', skills: ['Electrical', 'AC'], experienceYears: 5 },
      { center: kaveri._id, name: 'Imran Pasha', phone: '9000000203', skills: ['Tyres', 'Suspension'], experienceYears: 11 }
    ]);
    console.log('created  3 mechanics');
  }

  // A second verified center so customers can compare. Capacity 1 per slot makes "slot full" easy to show.
  const owner2 = await ensureUser({ name: 'Vijayanagar Auto Hub', email: 'center2@svms.local', phone: '9000000102', password: 'Center@123', role: 'service_center' });
  if (!(await ServiceCenter.exists({ owner: owner2._id }))) {
    await ServiceCenter.create({
      owner: owner2._id,
      name: 'Vijayanagar Auto Hub',
      address: '2nd Stage, Vijayanagar',
      city: 'Mysuru',
      pincode: '570017',
      phone: '9000000102',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      description: 'Hyundai, Tata and Kia specialists. Open Sundays.',
      brands: { Car: ['Hyundai', 'Tata', 'Kia'], Bike: [] },
      services: [
        { key: 'general_service', vehicleType: 'Car', price: 3900, durationMins: 240 },
        { key: 'tyre_service', vehicleType: 'Car', price: 600, durationMins: 60 },
        { key: 'brake_repair', vehicleType: 'Car', price: 1700, durationMins: 120 }
      ],
      workingHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, isOpen: true, open: '08:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' })),
      slotSettings: { slotMinutes: 60, capacityPerSlot: 1, bookingWindowDays: 30 }
    });
    console.log('created  second service center (verified, 1 vehicle per slot)');
  }

  // Phase 5 demo: the customer's Creta is already at Kaveri, inspected, with two repairs waiting for approval.
  // Also an older health check, so the health history has something to compare with.
  const creta = await Vehicle.findOne({ owner: customer._id, regNumber: 'KA09MB4821', isActive: true });
  if (creta && !(await Booking.exists({ customer: customer._id }))) {
    const today = nowIST().date;
    const ravi = await Mechanic.findOne({ center: kaveri._id, name: 'Ravi Kumar' });
    await VehicleHealth.create({
      vehicle: creta._id, center: kaveri._id, date: addDaysStr(today, -116), km: 15800,
      items: { engine: 'good', brakes: 'needs_attention', tyres: 'good', battery: 'replace_soon', engineOil: 'good' },
      notes: 'Brakes slightly worn. Battery 3 years old.'
    });
    const job = await Booking.create({
      bookingNo: `SB-${today.slice(2).replace(/-/g, '')}-DEMO`,
      customer: customer._id, vehicle: creta._id, center: kaveri._id,
      service: { key: 'general_service', name: 'General Service', vehicleType: 'Car', price: 4200, durationMins: 240 },
      vehicleSnapshot: { brand: creta.brand, model: creta.model, regNumber: creta.regNumber, type: creta.type, km: creta.km },
      date: today, slot: '09:00', problem: 'Squeaking noise when braking',
      status: 'inspection', mechanic: ravi?._id || null,
      inspectionNotes: 'Front pads worn. Battery weak on load test.',
      history: [
        { status: 'pending', by: 'customer' }, { status: 'accepted', by: 'service_center' },
        { status: 'vehicle_received', by: 'service_center' }, { status: 'inspection', by: 'service_center' }
      ],
      recommendations: [
        { problem: 'Front brake pads worn', reason: 'Pad thickness 2.5 mm, below the 3 mm limit', urgency: 'High', partsCost: 2500, labourCost: 600 },
        { problem: 'Battery weak', reason: 'Cranking voltage 9.4 V on load test; battery is 3+ years old', urgency: 'Medium', partsCost: 5200, labourCost: 300 }
      ]
    });
    await SlotSeat.create({ center: kaveri._id, date: today, slot: '09:00', seat: 0, booking: job._id });
    await VehicleHealth.create({
      vehicle: creta._id, booking: job._id, center: kaveri._id, date: today, km: 18450,
      items: { engine: 'good', brakes: 'needs_attention', tyres: 'good', battery: 'replace_soon', engineOil: 'changed' },
      notes: 'Front pads worn. Battery weak on load test.'
    });
    console.log(`created  demo job ${job.bookingNo} (Creta at Kaveri, in inspection, 2 repairs awaiting approval)`);
  }

  // Phase 6: spare parts in stock at Kaveri, and a GSTIN to print on invoices.
  if (!kaveri.gstin) {
    await ServiceCenter.updateOne({ _id: kaveri._id }, { $set: { gstin: '29AAKFK4821M1Z5' } });
  }
  // Phase 9: map positions for the two demo centers (Mysuru) so distance and the map work straight away.
  const demoSpots = [[kaveri._id, 12.3052, 76.6552], [owner2._id, 12.3331, 76.6190]];
  for (const [ref, lat, lng] of demoSpots) {
    const filter = ref === kaveri._id ? { _id: ref } : { owner: ref };
    const r = await ServiceCenter.updateOne({ ...filter, 'location.lat': { $exists: false } }, { $set: { location: { lat, lng, source: 'seed' } } });
    if (r.modifiedCount) console.log(`updated  demo center map position (${lat}, ${lng})`);
  }

  // Phase 7: a demo UPI ID so the customer's "Pay online" panel works straight away.
  if (!kaveri.paymentSettings?.upiId) {
    await ServiceCenter.updateOne({ _id: kaveri._id }, { $set: { paymentSettings: { acceptsUpi: true, upiId: 'kaveri.motors@okaxis', payeeName: 'Kaveri Motor Works' } } });
    console.log('updated  Kaveri: demo UPI ID kaveri.motors@okaxis (online payments on)');
  }
  if (!(await SparePart.exists({ center: kaveri._id }))) {
    await SparePart.create([
      { center: kaveri._id, name: 'Engine oil 5W-30 (1 L)', partNo: 'OIL-5W30-1L', hsn: '2710', unitPrice: 520, gstRate: 18, stock: 40, lowStockAt: 8 },
      { center: kaveri._id, name: 'Oil filter (Hyundai)', partNo: 'HY-26300-35505', hsn: '8421', unitPrice: 320, gstRate: 18, stock: 12, lowStockAt: 4 },
      { center: kaveri._id, name: 'Air filter (Creta)', partNo: 'HY-28113-M0000', hsn: '8421', unitPrice: 640, gstRate: 18, stock: 6, lowStockAt: 3 },
      { center: kaveri._id, name: 'Wiper blade set', partNo: 'WB-24-16', hsn: '8512', unitPrice: 750, gstRate: 18, stock: 2, lowStockAt: 3 },
      { center: kaveri._id, name: 'Coolant (1 L)', partNo: 'CL-1L', hsn: '3820', unitPrice: 380, gstRate: 18, stock: 15, lowStockAt: 5 },
      { center: kaveri._id, name: 'Scooter engine oil 10W-30 (0.8 L)', partNo: 'OIL-10W30-08', hsn: '2710', unitPrice: 360, gstRate: 18, stock: 25, lowStockAt: 6 },
      { center: kaveri._id, name: 'Scooter spark plug', partNo: 'SP-U22', hsn: '8511', unitPrice: 180, gstRate: 18, stock: 10, lowStockAt: 3 },
      { center: kaveri._id, name: 'Front brake shoe (scooter)', partNo: 'BS-ACT-F', hsn: '8714', unitPrice: 290, gstRate: 18, stock: 1, lowStockAt: 2 }
    ]);
    console.log('created  8 spare parts at Kaveri (2 of them low on stock)');
  }

  // Phase 6 demo job: the customer's Activa is at Kaveri with the work in progress,
  // ready for you to add parts, generate the bill and hand it over with the pickup code.
  const activa = await Vehicle.findOne({ owner: customer._id, regNumber: 'KA09HK1177', isActive: true });
  if (activa && !(await Booking.exists({ bookingNo: /-DEMO6$/ }))) {
    const today = nowIST().date;
    const imran = await Mechanic.findOne({ center: kaveri._id, name: 'Imran Pasha' });
    let slot = null;
    for (const t of ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00']) {
      if ((await SlotSeat.countDocuments({ center: kaveri._id, date: today, slot: t })) < (kaveri.slotSettings?.capacityPerSlot || 2)) { slot = t; break; }
    }
    if (slot) {
      const job = await Booking.create({
        bookingNo: `SB-${today.slice(2).replace(/-/g, '')}-DEMO6`,
        customer: customer._id, vehicle: activa._id, center: kaveri._id,
        service: { key: 'general_service', name: 'General Service', vehicleType: 'Bike', price: 950, durationMins: 120 },
        vehicleSnapshot: { brand: activa.brand, model: activa.model, regNumber: activa.regNumber, type: activa.type, km: activa.km },
        date: today, slot, problem: 'Pick-up is slow and front brake feels soft',
        status: 'in_progress', mechanic: imran?._id || null,
        inspectionNotes: 'Engine oil due. Front brake shoe worn.',
        history: [
          { status: 'pending', by: 'customer' }, { status: 'accepted', by: 'service_center' },
          { status: 'vehicle_received', by: 'service_center' }, { status: 'inspection', by: 'service_center' },
          { status: 'in_progress', by: 'service_center' }
        ]
      });
      for (let seat = 0; seat < (kaveri.slotSettings?.capacityPerSlot || 2); seat += 1) {
        try { await SlotSeat.create({ center: kaveri._id, date: today, slot, seat, booking: job._id }); break; } catch (e) { if (e.code !== 11000) throw e; }
      }
      await VehicleHealth.create({
        vehicle: activa._id, booking: job._id, center: kaveri._id, date: today, km: 21480,
        items: { engine: 'good', brakes: 'needs_attention', tyres: 'good', battery: 'good', engineOil: 'replace_soon' },
        notes: 'Engine oil due. Front brake shoe worn.'
      });
      console.log(`created  demo job ${job.bookingNo} (Activa at Kaveri, service in progress, ready for parts and billing)`);
    }
  }

  console.log('\nDemo logins:');
  console.log(`  Admin           ${process.env.ADMIN_EMAIL || 'admin@svms.local'} / (ADMIN_PASSWORD in .env)`);
  console.log('  Customer        customer@svms.local / Customer@123');
  console.log('  Service center  center@svms.local / Center@123');
  console.log('  Service center  center2@svms.local / Center@123');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
