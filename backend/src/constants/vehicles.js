// Brands offered in the vehicle form. Service centers will pick from the same list in Phase 3,
// so a customer's brand and a center's supported brands always match exactly.
export const VEHICLE_TYPES = ['Car', 'Bike'];

export const BRANDS = {
  Car: ['Hyundai', 'Maruti Suzuki', 'Tata', 'Mahindra', 'Honda', 'Toyota', 'Kia', 'MG', 'Skoda', 'Volkswagen', 'Renault', 'Nissan'],
  Bike: ['Hero', 'Honda', 'Bajaj', 'TVS', 'Royal Enfield', 'Yamaha', 'Suzuki', 'KTM', 'Ather', 'Ola Electric']
};

export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'];

export const DOCUMENTS = {
  insuranceExpiry: 'Insurance',
  pucExpiry: 'PUC certificate',
  rcExpiry: 'Registration (RC)'
};

// Normalises "ka 09 mb-4821" to "KA09MB4821".
export const normaliseReg = (value = '') => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');

// Standard state series (KA09MB4821, DL3CAB1234) or Bharat series (22BH1234AB).
export const isValidReg = (reg) => /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(reg) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(reg);
