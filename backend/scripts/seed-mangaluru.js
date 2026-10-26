// Demo data for Mangaluru: 50 verified service centers (car, bike and both) spread across the city,
// each with its own login, brands, services, timings, holidays, mechanics and map position,
// plus 3 demo customers with vehicles registered in Mangaluru.
// Safe to run more than once: anything that already exists is left unchanged.
// Never run this on a live database (the demo passwords below are public).
// Run:  npm run seed:mangaluru
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import ServiceCenter from '../src/models/ServiceCenter.js';
import Vehicle from '../src/models/Vehicle.js';
import Mechanic from '../src/models/Mechanic.js';
import { addDaysStr, nowIST } from '../src/utils/time.js';

const CENTER_PASSWORD = 'Center@123';
const CUSTOMER_PASSWORD = 'Customer@123';

// [locality, PIN code, lat, lng]
const AREAS = [
  ['Hampankatta', '575001', 12.8698, 74.8430], ['Kodialbail', '575003', 12.8790, 74.8440],
  ['Kadri', '575002', 12.8885, 74.8560], ['Bejai', '575004', 12.8853, 74.8399],
  ['Kankanady', '575002', 12.8700, 74.8620], ['Falnir', '575001', 12.8640, 74.8470],
  ['Pumpwell', '575002', 12.8620, 74.8580], ['Kottara', '575006', 12.9100, 74.8380],
  ['Urwa', '575006', 12.8970, 74.8330], ['Lalbagh', '575003', 12.8850, 74.8360],
  ['Kulshekar', '575005', 12.8870, 74.8790], ['Nanthoor', '575005', 12.8880, 74.8650],
  ['Bikarnakatte', '575005', 12.8890, 74.8720], ['Padil', '575007', 12.8730, 74.8870],
  ['Jeppu', '575002', 12.8520, 74.8540], ['Attavar', '575001', 12.8650, 74.8520],
  ['Mangaladevi', '575001', 12.8490, 74.8480], ['Ullal', '575020', 12.8070, 74.8550],
  ['Thokkottu', '575017', 12.8230, 74.8650], ['Deralakatte', '575018', 12.8090, 74.8870],
  ['Surathkal', '575014', 13.0000, 74.7950], ['Kulai', '575019', 12.9580, 74.8040],
  ['Panambur', '575010', 12.9350, 74.8090], ['Kavoor', '575015', 12.9300, 74.8580],
  ['Kuloor', '575013', 12.9300, 74.8300], ['Vamanjoor', '575028', 12.8920, 74.9050],
  ['Shaktinagar', '575016', 12.8970, 74.8800], ['Derebail', '575006', 12.9150, 74.8510],
  ['Bondel', '575008', 12.9220, 74.8690], ['Ashok Nagar', '575006', 12.9060, 74.8290]
];
const ROADS = ['Main Road', 'NH 66 Service Road', '1st Cross', '2nd Cross', 'Temple Road', 'Market Road', 'Bypass Road', 'Church Road', 'Junction'];
const PREFIXES = [
  'Karavali', 'Netravati', 'Phalguni', 'Tulunadu', 'Kudla', 'Sea Breeze', 'Harbour', 'Lighthouse', 'Arabian', 'Sahyadri',
  'Coastline', 'Bay View', 'Mangala', 'Sharavathi', 'Gurupura', 'Kadri Hills', 'Pilikula', 'Tannirbhavi', 'Sultan Battery', 'Someshwara'
];
const SUFFIXES = {
  Car: ['Car Care', 'Auto Works', 'Motors', 'Car Clinic', 'Auto Garage'],
  Bike: ['Bike Point', 'Two Wheeler Works', 'Moto Care', 'Bike Garage', 'Scooter Clinic'],
  Both: ['Auto Service', 'Vehicle Care', 'Garage', 'Service Station', 'Auto Hub']
};
const CAR_BRANDS = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Toyota', 'Honda', 'Kia', 'Renault', 'Skoda', 'Volkswagen', 'MG', 'Nissan'];
const BIKE_BRANDS = ['Hero', 'Honda', 'Bajaj', 'TVS', 'Royal Enfield', 'Yamaha', 'Suzuki', 'KTM', 'Ather', 'Ola Electric', 'Jawa'];

// Base price (₹) and duration (minutes) for each service; each center varies the price a little.
const CAR_SERVICES = [
  ['general_service', 4000, 240], ['oil_change', 2300, 60], ['brake_repair', 1700, 120], ['tyre_service', 600, 60],
  ['battery_service', 850, 45], ['wheel_alignment', 900, 60], ['ac_service', 1500, 90], ['clutch_repair', 3500, 180],
  ['electrical_repair', 1200, 90], ['washing', 700, 60]
];
const BIKE_SERVICES = [
  ['general_service', 900, 120], ['oil_change', 450, 30], ['brake_repair', 400, 60], ['tyre_service', 250, 30],
  ['battery_service', 350, 30], ['clutch_repair', 800, 90], ['electrical_repair', 500, 60], ['chain_sprocket', 1200, 60],
  ['washing', 250, 30]
];

// Weekly timings (day 0 = Sunday). Each center gets one of these patterns.
const week = (fn) => [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, ...fn(day) }));
const TIMINGS = [
  { label: 'Mon–Sat 9 AM–6 PM, Sunday closed', hours: week((d) => ({ isOpen: d !== 0, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' })) },
  { label: 'All days 8 AM–8 PM', hours: week(() => ({ isOpen: true, open: '08:00', close: '20:00', breakStart: '', breakEnd: '' })) },
  { label: 'Mon–Sat 8 AM–7 PM, Sunday 9 AM–1 PM', hours: week((d) => (d === 0
    ? { isOpen: true, open: '09:00', close: '13:00', breakStart: '', breakEnd: '' }
    : { isOpen: true, open: '08:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' })) },
  { label: 'Tue–Sun 9 AM–7 PM, Monday closed', hours: week((d) => ({ isOpen: d !== 1, open: '09:00', close: '19:00', breakStart: '13:00', breakEnd: '14:00' })) },
  { label: 'Mon–Sat 10 AM–7 PM, Sunday closed', hours: week((d) => ({ isOpen: d !== 0, open: '10:00', close: '19:00', breakStart: '14:00', breakEnd: '15:00' })) }
];

const MECHANIC_NAMES = ['Prakash Shetty', 'Ganesh Poojary', 'Abdul Rehman', 'Ravi Kotian', 'Sandeep Suvarna', 'Joseph D\'Souza', 'Naveen Bangera', 'Imran Ali', 'Sathish Salian', 'Kiran Amin', 'Mohammed Ashraf', 'Ronald Pinto'];
const SKILLS = ['Engine', 'Brakes', 'Electrical', 'AC', 'Tyres', 'Suspension', 'Clutch', 'Body work'];

// Small fixed-seed random generator, so every run produces the same 50 centers.
let seed = 575001;
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const pick = (list) => list[Math.floor(rand() * list.length)];
const pickSome = (list, min, max) => {
  const n = min + Math.floor(rand() * (max - min + 1));
  return [...list].sort(() => rand() - 0.5).slice(0, n);
};
const round50 = (n) => Math.round(n / 50) * 50;

function buildCenters() {
  const kinds = [...Array(18).fill('Car'), ...Array(16).fill('Bike'), ...Array(16).fill('Both')];
  const used = new Set();
  return kinds.map((kind, i) => {
    const no = String(i + 1).padStart(2, '0');
    const [area, pincode, lat, lng] = AREAS[i % AREAS.length];
    let name;
    do { name = `${pick(PREFIXES)} ${pick(SUFFIXES[kind])}`; } while (used.has(name));
    used.add(name);

    const types = kind === 'Both' ? ['Car', 'Bike'] : [kind];
    const brands = {
      Car: types.includes('Car') ? pickSome(CAR_BRANDS, 3, 8) : [],
      Bike: types.includes('Bike') ? pickSome(BIKE_BRANDS, 3, 8) : []
    };
    const priceFactor = 0.85 + rand() * 0.35;
    const services = types.flatMap((type) => {
      const all = type === 'Car' ? CAR_SERVICES : BIKE_SERVICES;
      const chosen = [all[0], ...pickSome(all.slice(1), 3, all.length - 1)];
      return chosen.map(([key, price, durationMins]) => ({ key, vehicleType: type, price: round50(price * priceFactor), durationMins }));
    });
    const timing = TIMINGS[i % TIMINGS.length];
    const today = nowIST().date;

    return {
      email: `center-mlr-${no}@svms.local`,
      phone: `90000020${no}`,
      mechanics: 2 + Math.floor(rand() * 3),
      data: {
        name,
        description: `Demo center in ${area}. ${kind === 'Both' ? 'Cars and two-wheelers' : kind === 'Car' ? 'Cars only' : 'Two-wheelers only'}. ${timing.label}.`,
        address: `${10 + Math.floor(rand() * 290)}, ${pick(ROADS)}, ${area}`,
        city: 'Mangaluru',
        pincode,
        phone: `90000020${no}`,
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        brands,
        services,
        workingHours: timing.hours,
        slotSettings: { slotMinutes: 60, capacityPerSlot: 1 + Math.floor(rand() * 4), bookingWindowDays: pick([14, 30, 45, 60]) },
        holidays: i % 4 === 0 ? [{ date: addDaysStr(today, 7 + (i % 20)), reason: 'Staff holiday (demo)' }] : [],
        // Spread centers in the same area apart by up to ~600 m.
        location: { lat: Number((lat + (rand() - 0.5) * 0.011).toFixed(6)), lng: Number((lng + (rand() - 0.5) * 0.011).toFixed(6)), source: 'seed' },
        paymentSettings: i % 3 === 0 ? { acceptsUpi: true, upiId: `demo.mlr${no}@okaxis`, payeeName: name } : { acceptsUpi: false }
      }
    };
  });
}

const CUSTOMERS = [
  {
    user: { name: 'Mangaluru Customer 1', email: 'customer-mlr-1@svms.local', phone: '9000003001' },
    vehicles: [
      { type: 'Car', brand: 'Maruti Suzuki', model: 'Baleno', variant: 'Zeta', year: 2022, regNumber: 'KA19MH4521', fuel: 'Petrol', km: 24300 },
      { type: 'Bike', brand: 'TVS', model: 'Jupiter', year: 2020, regNumber: 'KA19EK7781', fuel: 'Petrol', km: 31200 }
    ]
  },
  {
    user: { name: 'Mangaluru Customer 2', email: 'customer-mlr-2@svms.local', phone: '9000003002' },
    vehicles: [
      { type: 'Car', brand: 'Hyundai', model: 'i20', variant: 'Asta', year: 2021, regNumber: 'KA19MN1180', fuel: 'Petrol', km: 38900 },
      { type: 'Bike', brand: 'Royal Enfield', model: 'Classic 350', year: 2023, regNumber: 'KA19ER3409', fuel: 'Petrol', km: 9100 }
    ]
  },
  {
    user: { name: 'Mangaluru Customer 3', email: 'customer-mlr-3@svms.local', phone: '9000003003' },
    vehicles: [
      { type: 'Car', brand: 'Tata', model: 'Nexon EV', year: 2023, regNumber: 'KA19MP6612', fuel: 'Electric', km: 15600 },
      { type: 'Bike', brand: 'Ather', model: '450X', year: 2022, regNumber: 'KA19EV2290', fuel: 'Electric', km: 12750 }
    ]
  }
];

async function ensureUser(data) {
  const found = await User.findOne({ email: data.email });
  if (found) return { user: found, created: false };
  return { user: await User.create(data), created: true };
}

async function run() {
  await connectDB(process.env.MONGO_URI);
  let created = 0;

  for (const c of buildCenters()) {
    const { user } = await ensureUser({ name: c.data.name, email: c.email, phone: c.phone, password: CENTER_PASSWORD, role: 'service_center' });
    if (await ServiceCenter.exists({ owner: user._id })) {
      console.log(`exists   ${c.email}`);
      continue;
    }
    const center = await ServiceCenter.create({ owner: user._id, ...c.data });
    const names = pickSome(MECHANIC_NAMES, c.mechanics, c.mechanics);
    await Mechanic.create(names.map((name, k) => ({
      center: center._id, name, phone: `9000004${c.email.slice(11, 13)}${k}`, skills: pickSome(SKILLS, 1, 3), experienceYears: 2 + Math.floor(rand() * 15)
    })));
    created += 1;
    console.log(`created  ${c.email.padEnd(28)} ${center.name} (${c.data.address.split(', ').pop()})`);
  }

  for (const { user, vehicles } of CUSTOMERS) {
    const { user: u, created: isNew } = await ensureUser({ ...user, password: CUSTOMER_PASSWORD, role: 'customer' });
    console.log(`${isNew ? 'created ' : 'exists  '} ${user.email}`);
    if (!(await Vehicle.exists({ owner: u._id }))) {
      await Vehicle.create(vehicles.map((v) => ({ ...v, owner: u._id })));
    }
  }

  console.log(`\n${created} new Mangaluru centers created (50 in total).`);
  console.log('Logins:');
  console.log(`  Service centers  center-mlr-01@svms.local … center-mlr-50@svms.local / ${CENTER_PASSWORD}`);
  console.log(`  Customers        customer-mlr-1@svms.local … customer-mlr-3@svms.local / ${CUSTOMER_PASSWORD}`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
