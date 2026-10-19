// "KA09MB4821" -> "KA 09 MB 4821", "22BH1234AB" -> "22 BH 1234 AB"
export function formatReg(reg = '') {
  const r = String(reg).toUpperCase();
  const bh = r.match(/^(\d{2})(BH)(\d{4})([A-Z]{1,2})$/);
  if (bh) return bh.slice(1).join(' ');
  const std = r.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{4})$/);
  return std ? std.slice(1).filter(Boolean).join(' ') : r;
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtKm = (n) => (n == null ? '—' : `${Math.round(n).toLocaleString('en-IN')} km`);

// Value for <input type="date">
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function daysUntil(d) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - start) / 86400000);
}

// Status of an insurance / PUC / RC expiry date.
export function docStatus(date) {
  if (!date) return { tone: '', text: 'Not added', level: 'missing' };
  const n = daysUntil(date);
  if (n < 0) return { tone: 'bad', text: `Expired ${fmtDate(date)}`, level: 'expired', days: n };
  if (n <= 30) return { tone: 'warn', text: n === 0 ? 'Expires today' : `Expires in ${n} day${n === 1 ? '' : 's'}`, level: 'soon', days: n };
  return { tone: 'good', text: `Valid till ${fmtDate(date)}`, level: 'ok', days: n };
}

export const DOC_LABELS = { insuranceExpiry: 'Insurance', pucExpiry: 'PUC', rcExpiry: 'RC' };

// Average km per day from the odometer history (null if not enough data).
export function kmPerDay(odometer = []) {
  const o = [...odometer].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (o.length < 2) return null;
  const days = (new Date(o.at(-1).date) - new Date(o[0].date)) / 86400000;
  if (days < 1) return null;
  return (o.at(-1).km - o[0].km) / days;
}
