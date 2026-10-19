// Standard services a center can offer. Customers search by these keys in Phase 4,
// so every center uses the same names (no "oil chnage" typos breaking search).
export const SERVICE_CATALOG = [
  { key: 'general_service', name: 'General Service', types: ['Car', 'Bike'] },
  { key: 'oil_change', name: 'Oil Change', types: ['Car', 'Bike'] },
  { key: 'brake_repair', name: 'Brake Repair', types: ['Car', 'Bike'] },
  { key: 'tyre_service', name: 'Tyre Service', types: ['Car', 'Bike'] },
  { key: 'battery_service', name: 'Battery Service', types: ['Car', 'Bike'] },
  { key: 'wheel_alignment', name: 'Wheel Alignment & Balancing', types: ['Car'] },
  { key: 'ac_service', name: 'AC Service', types: ['Car'] },
  { key: 'clutch_repair', name: 'Clutch Repair', types: ['Car', 'Bike'] },
  { key: 'electrical_repair', name: 'Electrical Repair', types: ['Car', 'Bike'] },
  { key: 'chain_sprocket', name: 'Chain & Sprocket', types: ['Bike'] },
  { key: 'washing', name: 'Washing & Detailing', types: ['Car', 'Bike'] }
];

export const serviceByKey = (key) => SERVICE_CATALOG.find((s) => s.key === key);

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Monday–Saturday 9:00–18:00 with a 13:00–14:00 lunch break; Sunday closed.
export const defaultWorkingHours = () =>
  DAYS.map((_, day) => ({ day, isOpen: day !== 0, open: '09:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' }));
