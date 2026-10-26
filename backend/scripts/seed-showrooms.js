// Authorised brand service centers in Mangaluru and Udupi (Kia, Jaguar Land Rover, BMW, Mercedes-Benz, Toyota, Hyundai, Tata, Royal Enfield,
// Honda, Suzuki, TVS, KTM, Yamaha and Hero two-wheelers),
// for testing with real-world listings.
// Name, address, PIN code and phone are from public listings (advaithkia.com, cardekho.com), checked October 2026.
// Map positions, and A.R.M Kia timings and phones, are from each location's own listing (Google / kiaindia-dealers.com).
// Service prices, slot settings and lunch breaks are sample values — correct them from each center's login.
// These are real businesses: use this on a local/test database only, never on a live site.
// Safe to run more than once: anything that already exists is left unchanged.
// Run:  npm run seed:showrooms
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import ServiceCenter from '../src/models/ServiceCenter.js';

const PASSWORD = 'Center@123';

const week = (fn) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, ...fn(day) }));
// Published by Advaith Kia: Mon–Sat 9 AM–7 PM, Sunday 10 AM–7 PM.
const ADVAITH_HOURS = week((d) => ({ isOpen: true, open: d === 0 ? '10:00' : '09:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' }));
// A.R.M Kia, as listed by each location (checked October 2026). The 1–2 PM lunch break is a sample, as for Advaith.
// Kadri (kiaindia-dealers.com): 9:30 AM–6 PM, Tuesday closed.
const KADRI_HOURS = week((d) => ({ isOpen: d !== 2, open: '09:30', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));
// Padil (Google listing of the workshop): every day 9 AM–6 PM.
const PADIL_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));
// Udyavara (Google listing): every day 9 AM–7:30 PM.
const UDYAVARA_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '19:30', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Kia cars; each center can change them on its Services page.
const KIA_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 5500, durationMins: 240, notes: 'Periodic maintenance as per Kia schedule' },
  { key: 'oil_change', vehicleType: 'Car', price: 3200, durationMins: 60, notes: 'Genuine Kia engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Car', price: 2200, durationMins: 120, notes: 'Labour only; pads extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 1100, durationMins: 60 },
  { key: 'tyre_service', vehicleType: 'Car', price: 700, durationMins: 60 },
  { key: 'battery_service', vehicleType: 'Car', price: 900, durationMins: 45 },
  { key: 'ac_service', vehicleType: 'Car', price: 2000, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 1500, durationMins: 90 },
  { key: 'washing', vehicleType: 'Car', price: 900, durationMins: 60 }
];

// Marqland (Google listing of the Mangaluru workshop): Mon–Sat 9:30 AM–6:30 PM, Sunday closed.
const MARQLAND_HOURS = week((d) => ({ isOpen: d !== 0, open: '09:30', close: '18:30', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Jaguar and Land Rover cars.
const JLR_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 28000, durationMins: 360, notes: 'Scheduled maintenance as per JLR service plan' },
  { key: 'oil_change', vehicleType: 'Car', price: 15000, durationMins: 90, notes: 'Genuine JLR engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Car', price: 6500, durationMins: 150, notes: 'Labour only; pads and discs extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 3500, durationMins: 90 },
  { key: 'tyre_service', vehicleType: 'Car', price: 2500, durationMins: 60 },
  { key: 'battery_service', vehicleType: 'Car', price: 2500, durationMins: 60 },
  { key: 'ac_service', vehicleType: 'Car', price: 6000, durationMins: 120 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 5000, durationMins: 120, notes: 'Diagnostics with JLR SDD tools' },
  { key: 'washing', vehicleType: 'Car', price: 3000, durationMins: 90, notes: 'Premium wash and interior detailing' }
];

// BMW Varsha Autohaus (Google listing): every day 9 AM–6 PM. Workshop has 8 bays, about 20 cars a day.
const VARSHA_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for BMW cars.
const BMW_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 25000, durationMins: 360, notes: 'Condition Based Service (CBS) as shown on the car' },
  { key: 'oil_change', vehicleType: 'Car', price: 14000, durationMins: 90, notes: 'BMW Longlife engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Car', price: 6000, durationMins: 150, notes: 'Labour only; pads, discs and sensors extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 3200, durationMins: 90 },
  { key: 'tyre_service', vehicleType: 'Car', price: 2500, durationMins: 60, notes: 'Run-flat tyre handling' },
  { key: 'battery_service', vehicleType: 'Car', price: 3000, durationMins: 60, notes: 'Includes battery registration with ISTA' },
  { key: 'ac_service', vehicleType: 'Car', price: 5500, durationMins: 120 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 4500, durationMins: 120, notes: 'Diagnostics with BMW ISTA' },
  { key: 'washing', vehicleType: 'Car', price: 2500, durationMins: 90, notes: 'Premium wash and interior detailing' }
];

// United Toyota (Google listings): every day 9 AM–6 PM.
const UNITED_TOYOTA_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Toyota cars.
const TOYOTA_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 6500, durationMins: 240, notes: 'Periodic maintenance as per Toyota schedule' },
  { key: 'oil_change', vehicleType: 'Car', price: 3800, durationMins: 60, notes: 'Toyota Genuine Motor Oil and filter' },
  { key: 'brake_repair', vehicleType: 'Car', price: 2500, durationMins: 120, notes: 'Labour only; pads extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 1200, durationMins: 60 },
  { key: 'tyre_service', vehicleType: 'Car', price: 800, durationMins: 60 },
  { key: 'battery_service', vehicleType: 'Car', price: 1000, durationMins: 45, notes: 'Includes hybrid battery health check' },
  { key: 'ac_service', vehicleType: 'Car', price: 2200, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 1800, durationMins: 90 },
  { key: 'washing', vehicleType: 'Car', price: 1000, durationMins: 60 }
];

// Hyundai service centers (Google listings). Sunday hours differ from weekdays.
const hyundaiHours = (open, close, sunOpen, sunClose) =>
  week((d) => ({ isOpen: true, open: d === 0 ? sunOpen : open, close: d === 0 ? sunClose : close, breakStart: '13:00', breakEnd: '14:00' }));
const ADVAITH_HYUNDAI_HOURS = hyundaiHours('08:00', '19:00', '09:00', '17:00');
const KANCHANA_PADIL_HOURS = hyundaiHours('09:00', '18:00', '09:30', '17:30');
const KANCHANA_KADRI_HOURS = hyundaiHours('09:00', '18:00', '10:00', '18:00');
const KANCHANA_SURATHKAL_HOURS = hyundaiHours('08:30', '18:15', '09:30', '17:15');

// Sample starting prices (₹) for Hyundai cars.
const HYUNDAI_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 4500, durationMins: 240, notes: 'Periodic maintenance as per Hyundai schedule' },
  { key: 'oil_change', vehicleType: 'Car', price: 2600, durationMins: 60, notes: 'Hyundai genuine engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Car', price: 1800, durationMins: 120, notes: 'Labour only; pads extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 900, durationMins: 60 },
  { key: 'tyre_service', vehicleType: 'Car', price: 600, durationMins: 60 },
  { key: 'battery_service', vehicleType: 'Car', price: 800, durationMins: 45 },
  { key: 'ac_service', vehicleType: 'Car', price: 1600, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 1300, durationMins: 90 },
  { key: 'washing', vehicleType: 'Car', price: 700, durationMins: 60 }
];

// Tata car service centres (Google listings): every day 9 AM–8 PM.
const TATA_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '20:00', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Tata cars (petrol, diesel, CNG and EV).
const TATA_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 4800, durationMins: 240, notes: 'Periodic maintenance as per Tata schedule' },
  { key: 'oil_change', vehicleType: 'Car', price: 2800, durationMins: 60, notes: 'Tata genuine engine oil and filter (not for EVs)' },
  { key: 'brake_repair', vehicleType: 'Car', price: 1800, durationMins: 120, notes: 'Labour only; pads extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 900, durationMins: 60 },
  { key: 'tyre_service', vehicleType: 'Car', price: 600, durationMins: 60 },
  { key: 'battery_service', vehicleType: 'Car', price: 900, durationMins: 45, notes: 'Includes EV high-voltage battery health check' },
  { key: 'ac_service', vehicleType: 'Car', price: 1700, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 1400, durationMins: 90 },
  { key: 'washing', vehicleType: 'Car', price: 700, durationMins: 60 }
];

// Niran Motors (Google listings of each Royal Enfield service center).
// Bendoorwell: Mon–Sat 9 AM–6 PM, Sunday closed. Kuloor: every day 9 AM–7 PM.
const NIRAN_BENDOORWELL_HOURS = week((d) => ({ isOpen: d !== 0, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));
const NIRAN_KULOOR_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Royal Enfield motorcycles.
const ROYAL_ENFIELD_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 1800, durationMins: 180, notes: 'Periodic service as per Royal Enfield schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 900, durationMins: 45, notes: 'Royal Enfield genuine engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 600, durationMins: 60, notes: 'Labour only; pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 300, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 400, durationMins: 30 },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 1500, durationMins: 120 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 800, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 2200, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 300, durationMins: 30 }
];

// Honda two-wheeler dealers (Google listings). Kankanady is the Kanchana Honda service center's timings.
// Matrix Kodialbail's listing shows "9 AM – 7 AM", taken as 9 AM–7 PM.
const KANCHANA_KANKANADY_HOURS = week((d) => ({ isOpen: d !== 0, open: '08:30', close: '18:30', breakStart: '13:00', breakEnd: '14:00' }));
const MATRIX_KODIALBAIL_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' }));
const KANCHANA_THOKKOTTU_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '18:30', breakStart: '13:00', breakEnd: '14:00' }));
const MATRIX_SURATHKAL_HOURS = week((d) => ({ isOpen: d !== 0, open: '09:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' }));

// Two-wheeler dealer timings (Google listings): Mon–Sat open–close; Sunday closed unless [open, close] is given.
const dealerHours = (open, close, sunday) => week((d) => (d === 0
  ? (sunday ? { isOpen: true, open: sunday[0], close: sunday[1], breakStart: '13:00', breakEnd: '14:00' } : { isOpen: false, open: open, close: close })
  : { isOpen: true, open, close, breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Suzuki motorcycles and scooters.
const SUZUKI_BIKE_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 1050, durationMins: 120, notes: 'Periodic service as per Suzuki schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 480, durationMins: 30, notes: 'Suzuki genuine engine oil (Ecstar)' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 350, durationMins: 45, notes: 'Labour only; shoes and pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 200, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 300, durationMins: 30 },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 950, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 500, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 1500, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 200, durationMins: 30 }
];

// Sample starting prices (₹) for TVS motorcycles, scooters and iQube EVs.
const TVS_BIKE_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 950, durationMins: 120, notes: 'Periodic service as per TVS schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 420, durationMins: 30, notes: 'TVS genuine engine oil (not for iQube)' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 330, durationMins: 45, notes: 'Labour only; shoes and pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 200, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 300, durationMins: 30, notes: 'Includes iQube battery health check' },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 850, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 500, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 1300, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 200, durationMins: 30 }
];

// Mercedes-Benz, Sundaram Motors (Google listings): every day 9 AM–6 PM.
const SUNDARAM_HOURS = week(() => ({ isOpen: true, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));

// Sample starting prices (₹) for Mercedes-Benz cars.
const MERCEDES_SERVICES = [
  { key: 'general_service', vehicleType: 'Car', price: 30000, durationMins: 360, notes: 'Service A / Service B as per Mercedes-Benz ASSYST schedule' },
  { key: 'oil_change', vehicleType: 'Car', price: 16000, durationMins: 90, notes: 'Mercedes-Benz approved engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Car', price: 7000, durationMins: 150, notes: 'Labour only; pads, discs and sensors extra' },
  { key: 'wheel_alignment', vehicleType: 'Car', price: 3500, durationMins: 90 },
  { key: 'tyre_service', vehicleType: 'Car', price: 2500, durationMins: 60 },
  { key: 'battery_service', vehicleType: 'Car', price: 3000, durationMins: 60 },
  { key: 'ac_service', vehicleType: 'Car', price: 6500, durationMins: 120 },
  { key: 'electrical_repair', vehicleType: 'Car', price: 5500, durationMins: 120, notes: 'Diagnostics with Mercedes-Benz XENTRY' },
  { key: 'washing', vehicleType: 'Car', price: 3000, durationMins: 90, notes: 'Premium wash and interior detailing' }
];

// Sample starting prices (₹) for Yamaha motorcycles and scooters.
const YAMAHA_BIKE_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 1150, durationMins: 120, notes: 'Periodic service as per Yamaha schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 550, durationMins: 30, notes: 'Yamalube engine oil' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 400, durationMins: 45, notes: 'Labour only; shoes and pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 250, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 350, durationMins: 30 },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 1000, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 600, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 1700, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 250, durationMins: 30 }
];

// Sample starting prices (₹) for Hero motorcycles and scooters.
const HERO_BIKE_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 850, durationMins: 120, notes: 'Periodic service as per Hero schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 380, durationMins: 30, notes: 'Hero 4T Plus engine oil' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 300, durationMins: 45, notes: 'Labour only; shoes and pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 180, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 280, durationMins: 30 },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 750, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 450, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 1200, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 180, durationMins: 30 }
];

// Sample starting prices (₹) for KTM and Husqvarna motorcycles.
const KTM_BIKE_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 2200, durationMins: 180, notes: 'Periodic service as per KTM schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 1100, durationMins: 45, notes: 'Motorex engine oil and filter' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 700, durationMins: 60, notes: 'Labour only; pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 350, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 500, durationMins: 30 },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 1800, durationMins: 120 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 900, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 2800, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 350, durationMins: 30 }
];

// Sample starting prices (₹) for Honda motorcycles and scooters.
const HONDA_BIKE_SERVICES = [
  { key: 'general_service', vehicleType: 'Bike', price: 1000, durationMins: 120, notes: 'Periodic service as per Honda schedule' },
  { key: 'oil_change', vehicleType: 'Bike', price: 450, durationMins: 30, notes: 'Honda genuine engine oil' },
  { key: 'brake_repair', vehicleType: 'Bike', price: 350, durationMins: 45, notes: 'Labour only; shoes and pads extra' },
  { key: 'tyre_service', vehicleType: 'Bike', price: 200, durationMins: 30 },
  { key: 'battery_service', vehicleType: 'Bike', price: 300, durationMins: 30 },
  { key: 'clutch_repair', vehicleType: 'Bike', price: 900, durationMins: 90 },
  { key: 'electrical_repair', vehicleType: 'Bike', price: 500, durationMins: 60 },
  { key: 'chain_sprocket', vehicleType: 'Bike', price: 1400, durationMins: 60, notes: 'Chain and sprocket kit extra' },
  { key: 'washing', vehicleType: 'Bike', price: 200, durationMins: 30 }
];

const CENTERS = [
  {
    email: 'kia-advaith-mlr@svms.local',
    name: 'Advaith Kia Service - Kottara Chowki',
    address: 'NH 66 Bangra, Kodikal, Opp. Winman Software, Kottara Chowki, Kuloor',
    city: 'Mangaluru', pincode: '575006', phone: '6364871026',
    location: { lat: 12.91449, lng: 74.8344 },
    hours: ADVAITH_HOURS,
    description: 'Kia authorised service (Advaith Kia). Timings and phone from advaithkia.com; prices are sample values.'
  },
  {
    email: 'kia-arm-kadri@svms.local',
    name: 'A.R.M Kia - Kadri Road',
    address: 'Praveen Plaza, Door No. 3-W-30-2386/2, Next to City Hospital, Kadri Road',
    city: 'Mangaluru', pincode: '575002', phone: '9606013170',
    location: { lat: 12.87988, lng: 74.85333 },
    hours: KADRI_HOURS,
    description: 'Kia authorised sales and service (A.R.M Kia). Open 9:30 AM–6 PM, closed Tuesdays. Prices are sample values.'
  },
  {
    email: 'kia-arm-padil@svms.local',
    name: 'A.R.M Kia - Padil',
    address: 'NH 73, Kannur Village, beside Sundaram Benz, Dayambu, Padil',
    city: 'Mangaluru', pincode: '575007', phone: '9606013152',
    location: { lat: 12.86696, lng: 74.90486 },
    hours: PADIL_HOURS,
    description: 'Kia authorised service workshop (A.R.M Kia). Open every day 9 AM–6 PM. Prices are sample values.'
  },
  {
    email: 'kia-arm-udupi@svms.local',
    name: 'A.R.M Kia - Udyavara',
    address: 'NH 66, Sy. No. 31/46, Udyavara Main Road, Near Sode Matta, Udyavara',
    city: 'Udupi', pincode: '574118', phone: '9606818973',
    location: { lat: 13.30105, lng: 74.74506 },
    hours: UDYAVARA_HOURS,
    description: 'Kia authorised sales and service (A.R.M Kia). Open every day 9 AM–7:30 PM. Prices are sample values.'
  },
  {
    email: 'jlr-marqland-mlr@svms.local',
    name: 'Jaguar Land Rover, Marqland Mangalore',
    address: '1-N-6-460/2, NH 66, Derebail, Ashok Nagar Post, Kottara',
    city: 'Mangaluru', pincode: '575006', phone: '9686662000',
    location: { lat: 12.90427, lng: 74.83947 },
    hours: MARQLAND_HOURS,
    brands: ['Jaguar', 'Land Rover'],
    services: JLR_SERVICES,
    capacityPerSlot: 3,
    description: 'Jaguar and Land Rover authorised sales and service (Marqland). Open Mon–Sat 9:30 AM–6:30 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'bmw-varsha-mlr@svms.local',
    name: 'BMW Varsha Autohaus Karnataka',
    address: 'D.No. 3-25/1, Sy. No. 27/-16P4, Near Kannur Old Check Post, Mangaluru–Bengaluru Highway, Kannur',
    city: 'Mangaluru', pincode: '575007', phone: '8951008666',
    location: { lat: 12.86753, lng: 74.90362 },
    hours: VARSHA_HOURS,
    brands: ['BMW'],
    services: BMW_SERVICES,
    capacityPerSlot: 3,
    description: 'BMW authorised sales and service (Varsha Autohaus). 8-bay workshop. Open every day 9 AM–6 PM. Prices are sample values.'
  },
  {
    email: 'toyota-united-padil@svms.local',
    name: 'United Toyota - Padil',
    address: 'NH 75, Padiwal Saw Mill Compound, near Padil Junction, Padil',
    city: 'Mangaluru', pincode: '575007', phone: '9686687581',
    location: { lat: 12.87046, lng: 74.88493 },
    hours: UNITED_TOYOTA_HOURS,
    brands: ['Toyota'],
    services: TOYOTA_SERVICES,
    capacityPerSlot: 4,
    description: 'Toyota authorised sales and service workshop (United Toyota). Open every day 9 AM–6 PM. Prices are sample values.'
  },
  {
    email: 'toyota-united-city@svms.local',
    name: 'United Toyota - Bunts Hostel',
    address: 'Ground Floor, N. J. Lotus Enclave, near Bunts Hostel Circle, Balmatta',
    city: 'Mangaluru', pincode: '575003', phone: '9686687581',
    location: { lat: 12.87736, lng: 74.84979 },
    hours: UNITED_TOYOTA_HOURS,
    brands: ['Toyota'],
    services: TOYOTA_SERVICES,
    capacityPerSlot: 2,
    description: 'Toyota authorised city showroom (United Toyota). Open every day 9 AM–6 PM. The main service workshop is at Padil; confirm service bookings with the dealer. Prices are sample values.'
  },
  {
    email: 'hyundai-advaith-kuntikan@svms.local',
    name: 'Advaith Hyundai - Kuntikan',
    address: '3-68/1, NH 66, Lohith Nagar, Kuntikan, Derebail',
    city: 'Mangaluru', pincode: '575006', phone: '7760962829',
    location: { lat: 12.90129, lng: 74.8421 },
    hours: ADVAITH_HYUNDAI_HOURS,
    brands: ['Hyundai'],
    services: HYUNDAI_SERVICES,
    capacityPerSlot: 5,
    description: 'Hyundai authorised showroom and service center (Advaith Hyundai). Service open Mon–Sat 8 AM–7 PM, Sunday 9 AM–5 PM. Prices are sample values.'
  },
  {
    email: 'hyundai-advaith-baikampady@svms.local',
    name: 'Advaith Hyundai - Baikampady',
    address: '137/1, opp. Achal Industry, Baikampady Industrial Area, New Mangalore',
    city: 'Mangaluru', pincode: '575011', phone: '7619578062',
    location: { lat: 12.95403, lng: 74.82136 },
    hours: ADVAITH_HYUNDAI_HOURS,
    brands: ['Hyundai'],
    services: HYUNDAI_SERVICES,
    capacityPerSlot: 4,
    description: 'Hyundai authorised service center (Advaith Hyundai). Open Mon–Sat 8 AM–7 PM, Sunday 9 AM–5 PM. Prices are sample values.'
  },
  {
    email: 'hyundai-kanchana-padil@svms.local',
    name: 'Kanchana Hyundai - Padil',
    address: 'NH 48 (NH 75), Alape, Shanthi Nagar, Padil',
    city: 'Mangaluru', pincode: '575007', phone: '9686185333',
    location: { lat: 12.8713, lng: 74.88197 },
    hours: KANCHANA_PADIL_HOURS,
    brands: ['Hyundai'],
    services: HYUNDAI_SERVICES,
    capacityPerSlot: 4,
    description: 'Hyundai authorised sales and service (Kanchana Hyundai). Service open Mon–Sat 9 AM–6 PM, Sunday 9:30 AM–5:30 PM. Prices are sample values.'
  },
  {
    email: 'hyundai-kanchana-kadri@svms.local',
    name: 'Kanchana Hyundai - Kadri',
    address: '16-5-446/1, Mallikatte, Kadri',
    city: 'Mangaluru', pincode: '575003', phone: '7353506111',
    location: { lat: 12.87876, lng: 74.85309 },
    hours: KANCHANA_KADRI_HOURS,
    brands: ['Hyundai'],
    services: HYUNDAI_SERVICES,
    capacityPerSlot: 3,
    description: 'Hyundai authorised sales and service (Kanchana Hyundai). Open Mon–Sat 9 AM–6 PM, Sunday 10 AM–6 PM. Prices are sample values.'
  },
  {
    email: 'hyundai-kanchana-surathkal@svms.local',
    name: 'Kanchana Hyundai - Surathkal',
    address: 'NH 66, near Durgamba Temple, Thadambail, Surathkal',
    city: 'Mangaluru', pincode: '575014', phone: '9482574530',
    location: { lat: 13.00132, lng: 74.79628 },
    hours: KANCHANA_SURATHKAL_HOURS,
    brands: ['Hyundai'],
    services: HYUNDAI_SERVICES,
    capacityPerSlot: 3,
    description: 'Hyundai authorised sales and service (Kanchana Hyundai). Open Mon–Sat 8:30 AM–6:15 PM, Sunday 9:30 AM–5:15 PM. Prices are sample values.'
  },
  {
    email: 'tata-automatrix-bejai@svms.local',
    name: 'Tata Motors Auto Matrix - Bejai',
    address: 'Manjusha Building, Bejai',
    city: 'Mangaluru', pincode: '575004', phone: '7045208638',
    location: { lat: 12.88554, lng: 74.84339 },
    hours: TATA_HOURS,
    brands: ['Tata'],
    services: TATA_SERVICES,
    capacityPerSlot: 5,
    description: 'Tata Motors cars authorised showroom and service centre (Auto Matrix). Open every day 9 AM–8 PM. Prices are sample values.'
  },
  {
    email: 'tata-cauvery-alape@svms.local',
    name: 'Tata Motors Cauvery Motors - Alape',
    address: 'Ground Floor, NH 73, near Railway Bridge, Alape, Padil',
    city: 'Mangaluru', pincode: '575007', phone: '8879480559',
    location: { lat: 12.87209, lng: 74.89074 },
    hours: TATA_HOURS,
    brands: ['Tata'],
    services: TATA_SERVICES,
    capacityPerSlot: 4,
    description: 'Tata Motors cars authorised showroom and service centre (Cauvery Motors). Open every day 9 AM–8 PM. Prices are sample values.'
  },
  {
    email: 'tata-cauvery-kannur@svms.local',
    name: 'Tata Motors Cauvery Motors - Kannur',
    address: 'KSM Tower, Survey No. 23, Krisnis Heritage Village, behind Kannur Check Post, Mangaluru–Bengaluru Highway, Kannur',
    city: 'Mangaluru', pincode: '575007', phone: '8291027150',
    location: { lat: 12.86673, lng: 74.90442 },
    hours: TATA_HOURS,
    brands: ['Tata'],
    services: TATA_SERVICES,
    capacityPerSlot: 4,
    description: 'Tata Motors cars authorised service centre (Cauvery Motors). Open every day 9 AM–8 PM. Prices are sample values.'
  },
  {
    email: 'tata-automatrix-surathkal@svms.local',
    name: 'Tata Motors Auto Matrix - Surathkal',
    address: 'NH 66, Surathkal',
    city: 'Mangaluru', pincode: '575014', phone: '8879236096',
    location: { lat: 12.99325, lng: 74.79914 },
    hours: TATA_HOURS,
    brands: ['Tata'],
    services: TATA_SERVICES,
    capacityPerSlot: 3,
    description: 'Tata Motors cars authorised showroom and service centre (Auto Matrix). Open every day 9 AM–8 PM. Prices are sample values.'
  },
  {
    email: 're-niran-bendoorwell@svms.local',
    name: 'Niran Motors Royal Enfield - Bendoorwell',
    address: '15/4/191, Upper Bendoor 2nd Cross Road, opposite SCS Hospital, Bendoorwell, Kadri',
    city: 'Mangaluru', pincode: '575002', phone: '8879157841',
    location: { lat: 12.87346, lng: 74.85557 },
    hours: NIRAN_BENDOORWELL_HOURS,
    vehicleType: 'Bike',
    brands: ['Royal Enfield'],
    services: ROYAL_ENFIELD_SERVICES,
    capacityPerSlot: 4,
    description: 'Royal Enfield authorised showroom and service center (Niran Motors Pvt Ltd). Service open Mon–Sat 9 AM–6 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 're-niran-kuloor@svms.local',
    name: 'Niran Motors Royal Enfield - Kuloor',
    address: 'No. 1/16/9, Bangra Kuloor, NH 66 (Panvel–Kochi–Kanyakumari Highway), Kuloor',
    city: 'Mangaluru', pincode: '575013', phone: '8879467856',
    location: { lat: 12.91696, lng: 74.83327 },
    hours: NIRAN_KULOOR_HOURS,
    vehicleType: 'Bike',
    brands: ['Royal Enfield'],
    services: ROYAL_ENFIELD_SERVICES,
    capacityPerSlot: 4,
    description: 'Royal Enfield authorised showroom and service center (Niran Motors Pvt Ltd). Open every day 9 AM–7 PM. Prices are sample values.'
  },
  {
    email: 'honda-kanchana-kankanady@svms.local',
    name: 'Kanchana Honda - Kankanady',
    address: 'Near Kankanady Flower Market, Kankanady (showroom: D No. 25-2, 90/9, Kankanady Bypass Road)',
    city: 'Mangaluru', pincode: '575002', phone: '9945012679',
    location: { lat: 12.86763, lng: 74.85706 },
    hours: KANCHANA_KANKANADY_HOURS,
    vehicleType: 'Bike',
    brands: ['Honda'],
    services: HONDA_BIKE_SERVICES,
    capacityPerSlot: 6,
    description: 'Honda motorcycles and scooters, authorised main dealership and service center (Kanchana Honda). Service open Mon–Sat 8:30 AM–6:30 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'honda-matrix-kodialbail@svms.local',
    name: 'Matrix Honda - Kodialbail',
    address: 'Matrix Auto Corporation, Dongerkery, Kodialbail',
    city: 'Mangaluru', pincode: '575003', phone: '9740333008',
    location: { lat: 12.87484, lng: 74.83944 },
    hours: MATRIX_KODIALBAIL_HOURS,
    vehicleType: 'Bike',
    brands: ['Honda'],
    services: HONDA_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'Honda motorcycles and scooters, authorised dealer and service (Matrix Auto Corporation). Open every day 9 AM–7 PM. Prices are sample values.'
  },
  {
    email: 'honda-kanchana-thokkottu@svms.local',
    name: 'Kanchana Honda - Thokkottu',
    address: 'NH 66 (Panvel–Kochi–Kanyakumari Highway), Permannur, Thokkottu, Ullal',
    city: 'Mangaluru', pincode: '575020', phone: '8071879166',
    location: { lat: 12.8144, lng: 74.8582 },
    hours: KANCHANA_THOKKOTTU_HOURS,
    vehicleType: 'Bike',
    brands: ['Honda'],
    services: HONDA_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'Honda motorcycles and scooters, authorised dealer and service (Kanchana Honda). Open every day 9 AM–6:30 PM. Prices are sample values.'
  },
  {
    email: 'honda-matrix-surathkal@svms.local',
    name: 'Honda Matrix - Surathkal',
    address: 'Shreya Towers, NH 66, opp. Vidyadayini School, Iddya, Surathkal',
    city: 'Mangaluru', pincode: '575014', phone: '9606967379',
    location: { lat: 12.98226, lng: 74.80164 },
    hours: MATRIX_SURATHKAL_HOURS,
    vehicleType: 'Bike',
    brands: ['Honda'],
    services: HONDA_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'Honda motorcycles and scooters, authorised dealer and service (Matrix Honda). Open Mon–Sat 9 AM–7 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'suzuki-pai-chilimbi@svms.local',
    name: 'Suzuki Pai Sales - Chilimbi',
    address: 'V Square Building, Kulur Ferry Road, near Bank of Baroda Ladyhill Branch, Chilimbi, Urwa',
    city: 'Mangaluru', pincode: '575006', phone: '8291573683',
    location: { lat: 12.89425, lng: 74.83568 },
    hours: dealerHours('09:00', '19:00'),
    vehicleType: 'Bike',
    brands: ['Suzuki'],
    services: SUZUKI_BIKE_SERVICES,
    capacityPerSlot: 5,
    description: 'Suzuki motorcycles and scooters, authorised showroom and service (Pai Sales). Open Mon–Sat 9 AM–7 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'suzuki-pai-pandeshwar@svms.local',
    name: 'Suzuki Pai Sales - Pandeshwar',
    address: 'Mangaladevi Temple Road, Pandeshwar',
    city: 'Mangaluru', pincode: '575001', phone: '8291707651',
    location: { lat: 12.85463, lng: 74.84034 },
    hours: dealerHours('09:00', '18:00'),
    vehicleType: 'Bike',
    brands: ['Suzuki'],
    services: SUZUKI_BIKE_SERVICES,
    capacityPerSlot: 5,
    description: 'Suzuki motorcycles and scooters, authorised showroom and service (Pai Sales). Open Mon–Sat 9 AM–6 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'suzuki-anagha-kpt@svms.local',
    name: 'Sri Anagha Suzuki - KPT Junction',
    address: 'Rajsons Complex, Sharbathkatte, Airport Road, near KPT, Yeyyadi',
    city: 'Mangaluru', pincode: '575008', phone: '8291927717',
    location: { lat: 12.89471, lng: 74.85892 },
    hours: dealerHours('08:30', '19:00'),
    vehicleType: 'Bike',
    brands: ['Suzuki'],
    services: SUZUKI_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'Suzuki motorcycles and scooters, authorised showroom and service centre (Sri Anagha Suzuki). Open Mon–Sat 8:30 AM–7 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'suzuki-taniya-ullal@svms.local',
    name: 'Suzuki Taniya Motors - Ullal',
    address: 'AKS Complex, Ullal Bail, Ullal',
    city: 'Mangaluru', pincode: '575020', phone: '7619193888',
    location: { lat: 12.8149, lng: 74.85319 },
    hours: dealerHours('09:00', '18:30', ['09:00', '17:00']),
    vehicleType: 'Bike',
    brands: ['Suzuki'],
    services: SUZUKI_BIKE_SERVICES,
    capacityPerSlot: 3,
    description: 'Suzuki motorcycles and scooters, authorised showroom and service (Taniya Motors). Open Mon–Sat 9 AM–6:30 PM, Sunday 9 AM–5 PM. Prices are sample values.'
  },
  {
    email: 'suzuki-synergy-surathkal@svms.local',
    name: 'Suzuki Synergy Automotive - Surathkal',
    address: 'Tadambail Road, near Kanchana Hyundai, Dodda Kopla, Surathkal',
    city: 'Mangaluru', pincode: '575014', phone: '9880741300',
    location: { lat: 13.00104, lng: 74.79624 },
    hours: dealerHours('09:00', '18:00'),
    vehicleType: 'Bike',
    brands: ['Suzuki'],
    services: SUZUKI_BIKE_SERVICES,
    capacityPerSlot: 3,
    description: 'Suzuki motorcycles and scooters, authorised showroom and service (Synergy Automotive). Open Mon–Sat 9 AM–6 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'tvs-sairadha-kadri@svms.local',
    name: 'Sai Radha Motors TVS - Kadri',
    address: 'Mahaveer Building, Kadri–Balmatta Road, Mallikatte, near St Agnes College, Kadri',
    city: 'Mangaluru', pincode: '575002', phone: '8071406304',
    location: { lat: 12.87819, lng: 74.85727 },
    hours: dealerHours('09:00', '19:00', ['09:00', '19:00']),
    vehicleType: 'Bike',
    brands: ['TVS'],
    services: TVS_BIKE_SERVICES,
    capacityPerSlot: 6,
    description: 'TVS motorcycles, scooters and EVs, authorised showroom and service (Sai Radha Motors). Open every day 9 AM–7 PM. Prices are sample values.'
  },
  {
    email: 'tvs-sona-thokkottu@svms.local',
    name: 'Sona TVS - Thokkottu',
    address: 'Near Netaji Hospital, Bhat Nagar, Thokkottu Road, Permannur, Ullal',
    city: 'Mangaluru', pincode: '575020', phone: '9606903065',
    location: { lat: 12.81587, lng: 74.85902 },
    hours: dealerHours('09:00', '18:30'),
    vehicleType: 'Bike',
    brands: ['TVS'],
    services: TVS_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'TVS motorcycles and scooters, authorised showroom and service (Sona TVS). Open Mon–Sat 9 AM–6:30 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'tvs-sairadha-bejai@svms.local',
    name: 'Sai Radha TVS - Bejai',
    address: 'Ground Floor, Aditi Enclave, Bejai–Kapikad Road, Bejai',
    city: 'Mangaluru', pincode: '575004', phone: '9071399866',
    location: { lat: 12.88953, lng: 74.84163 },
    hours: dealerHours('09:00', '19:00'),
    vehicleType: 'Bike',
    brands: ['TVS'],
    services: TVS_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'TVS motorcycles and scooters, authorised showroom and service (Sai Radha TVS). Open Mon–Sat 9 AM–7 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'tvs-navadurga-kottara@svms.local',
    name: 'Navadurga Motors TVS - Kottara',
    address: 'Door No. 6-146/14-2, Pratham Complex, Ferry Road, near Ginger Hotel, Derebail, Kottara',
    city: 'Mangaluru', pincode: '575006', phone: '8071406614',
    location: { lat: 12.90954, lng: 74.8359 },
    hours: dealerHours('09:00', '19:00', ['10:00', '16:00']),
    vehicleType: 'Bike',
    brands: ['TVS'],
    services: TVS_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'TVS motorcycles, scooters and EVs, authorised showroom and service (Navadurga Motors LLP). Open Mon–Sat 9 AM–7 PM, Sunday 10 AM–4 PM. Prices are sample values.'
  },
  {
    email: 'tvs-motrax-gandhinagar@svms.local',
    name: 'Motrax TVS - Gandhinagar',
    address: 'Barke Road, Mannagudda Road, Gandhinagar',
    city: 'Mangaluru', pincode: '575003', phone: '9141335454',
    location: { lat: 12.88103, lng: 74.8335 },
    hours: dealerHours('09:00', '18:00'),
    vehicleType: 'Bike',
    brands: ['TVS'],
    services: TVS_BIKE_SERVICES,
    capacityPerSlot: 3,
    description: 'TVS motorcycles and scooters, authorised dealer and service (Motrax). Open Mon–Sat 9 AM–6 PM (lunch 1–2 PM), closed Sundays. Prices are sample values.'
  },
  {
    email: 'ktm-husqvarna-bendoor@svms.local',
    name: 'KTM Husqvarna - Bendoor',
    address: 'Lotus Paradise Plaza, Bendoor',
    city: 'Mangaluru', pincode: '575002', phone: '9355834432',
    location: { lat: 12.87469, lng: 74.85619 },
    hours: dealerHours('09:30', '18:30'),
    vehicleType: 'Bike',
    brands: ['KTM', 'Husqvarna'],
    services: KTM_BIKE_SERVICES,
    capacityPerSlot: 3,
    description: 'KTM and Husqvarna motorcycles, authorised showroom (KTM Husqvarna Mangalore). Open Mon–Sat 9:30 AM–6:30 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'ktm-service-hampankatta@svms.local',
    name: 'KTM Service - Hampankatta',
    address: '36, Balmatta Road, Hampankatta',
    city: 'Mangaluru', pincode: '575001', phone: '08242443779',
    location: { lat: 12.87027, lng: 74.84486 },
    hours: dealerHours('09:00', '17:00'),
    vehicleType: 'Bike',
    brands: ['KTM', 'Husqvarna'],
    services: KTM_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'KTM and Husqvarna motorcycles, authorised service centre (KTM Service Mangalore). Open Mon–Sat 9 AM–5 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'mercedes-sundaram-maryhill@svms.local',
    name: 'Mercedes-Benz Sundaram Motors - Mary Hill',
    address: 'Summit, Mary Hill, Airport Road, Konchady',
    city: 'Mangaluru', pincode: '575008', phone: '9791189999',
    location: { lat: 12.90551, lng: 74.86431 },
    hours: SUNDARAM_HOURS,
    brands: ['Mercedes-Benz'],
    services: MERCEDES_SERVICES,
    capacityPerSlot: 2,
    description: 'Mercedes-Benz authorised showroom (Sundaram Motors). Open every day 9 AM–6 PM. Service work is done at the Kannur service centre; confirm with the dealer. Prices are sample values.'
  },
  {
    email: 'mercedes-sundaram-kannur@svms.local',
    name: 'Mercedes-Benz Sundaram Motors - Kannur',
    address: 'No. 23-1B, NH 75, Kannur Check Post, Kannur',
    city: 'Mangaluru', pincode: '575007', phone: '7349249572',
    location: { lat: 12.86683, lng: 74.90523 },
    hours: SUNDARAM_HOURS,
    brands: ['Mercedes-Benz'],
    services: MERCEDES_SERVICES,
    capacityPerSlot: 3,
    description: 'Mercedes-Benz authorised service centre (Sundaram Motors). Open every day 9 AM–6 PM. Prices are sample values.'
  },
  {
    email: 'yamaha-motoworld-thokkottu@svms.local',
    name: 'Yamaha MoTo World - Thokkottu',
    address: 'Opp. Bangera Lane, Ullal Bail, Thokkottu, Ullal',
    city: 'Mangaluru', pincode: '575020', phone: '7625049153',
    location: { lat: 12.81511, lng: 74.8543 },
    hours: dealerHours('08:30', '19:00'),
    vehicleType: 'Bike',
    brands: ['Yamaha'],
    services: YAMAHA_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'Yamaha motorcycles and scooters, authorised showroom and service (MoTo World). Open Mon–Sat 8:30 AM–7 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'yamaha-sas-surathkal@svms.local',
    name: 'Yamaha SAS Motors - Surathkal',
    address: 'NH 66, near Durgamba Temple, Thadambail, Dodda Kopla, Surathkal',
    city: 'Mangaluru', pincode: '575014', phone: '8147599871',
    location: { lat: 13.0002, lng: 74.79684 },
    hours: dealerHours('09:00', '18:00'),
    vehicleType: 'Bike',
    brands: ['Yamaha'],
    services: YAMAHA_BIKE_SERVICES,
    capacityPerSlot: 3,
    description: 'Yamaha motorcycles and scooters, authorised showroom and service (SAS Motors). Open Mon–Sat 9 AM–6 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'hero-pitstop-thokkottu@svms.local',
    name: 'Pitstop Hero MotoCorp - Thokkottu',
    address: 'PMD Souza Complex, No. 23/70/7-9, First Cross Road, Kapikad, Permannur, Ullal',
    city: 'Mangaluru', pincode: '575020', phone: '9535619265',
    location: { lat: 12.81276, lng: 74.85888 },
    hours: dealerHours('08:30', '19:00'),
    vehicleType: 'Bike',
    brands: ['Hero'],
    services: HERO_BIKE_SERVICES,
    capacityPerSlot: 5,
    description: 'Hero motorcycles and scooters, authorised dealer and service (Pitstop). Open Mon–Sat 8:30 AM–7 PM, closed Sundays. Prices are sample values.'
  },
  {
    email: 'hero-westcoast-kankanady@svms.local',
    name: 'West Coast Motors Hero - Kankanady',
    address: 'Serrao Bhavan, Kankanady Old Road, opp. Cochin Bakery, Kankanady',
    city: 'Mangaluru', pincode: '575002', phone: '9289922606',
    location: { lat: 12.86729, lng: 74.85877 },
    hours: dealerHours('09:00', '20:00', ['09:00', '20:00']),
    vehicleType: 'Bike',
    brands: ['Hero'],
    services: HERO_BIKE_SERVICES,
    capacityPerSlot: 5,
    description: 'Hero motorcycles and scooters, authorised dealer and service (West Coast Motors). Open every day 9 AM–8 PM. Prices are sample values.'
  },
  {
    email: 'hero-tribhuvan-kottara@svms.local',
    name: 'Tribhuvan Motors Hero - Kottara',
    address: 'No. 146/17, Kulur Ferry Road, near Ashok Nagar, Kottara',
    city: 'Mangaluru', pincode: '575006', phone: '9289923203',
    location: { lat: 12.90319, lng: 74.83529 },
    hours: dealerHours('09:00', '18:00', ['09:00', '18:00']),
    vehicleType: 'Bike',
    brands: ['Hero'],
    services: HERO_BIKE_SERVICES,
    capacityPerSlot: 4,
    description: 'Hero motorcycles and scooters, authorised dealer and service (Tribhuvan Motors). Open every day 9 AM–6 PM. Prices are sample values.'
  },
  {
    email: 'hero-vikas-surathkal@svms.local',
    name: 'Hero Vikas Motors - Surathkal',
    address: 'Tadambail Road, Dodda Kopla, Surathkal',
    city: 'Mangaluru', pincode: '575014', phone: '9380398175',
    location: { lat: 13.00343, lng: 74.79452 },
    hours: dealerHours('09:00', '18:00'),
    vehicleType: 'Bike',
    brands: ['Hero'],
    services: HERO_BIKE_SERVICES,
    capacityPerSlot: 3,
    description: 'Hero motorcycles and scooters, dealer and service (Vikas Motors). Open Mon–Sat 9 AM–6 PM, closed Sundays. Prices are sample values.'
  }
];

async function run() {
  await connectDB(process.env.MONGO_URI);
  for (const c of CENTERS) {
    let user = await User.findOne({ email: c.email });
    if (!user) user = await User.create({ name: c.name, email: c.email, phone: c.phone, password: PASSWORD, role: 'service_center' });
    if (await ServiceCenter.exists({ owner: user._id })) {
      console.log(`exists   ${c.email}`);
      continue;
    }
    await ServiceCenter.create({
      owner: user._id,
      name: c.name,
      description: c.description,
      address: c.address,
      city: c.city,
      pincode: c.pincode,
      phone: c.phone,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      // `brands` lists car brands unless the center is for bikes (vehicleType: 'Bike').
      brands: c.vehicleType === 'Bike' ? { Car: [], Bike: c.brands } : { Car: c.brands || ['Kia'], Bike: [] },
      services: c.services || KIA_SERVICES,
      workingHours: c.hours,
      slotSettings: { slotMinutes: 60, capacityPerSlot: c.capacityPerSlot || 4, bookingWindowDays: 30 },
      location: { ...c.location, source: 'seed' }
    });
    console.log(`created  ${c.email.padEnd(28)} ${c.name} (${c.city})`);
  }
  console.log(`\nLogins: ${CENTERS.map((c) => c.email).join(', ')} / ${PASSWORD}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
