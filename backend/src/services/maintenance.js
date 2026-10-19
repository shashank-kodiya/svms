// Service is due at 6 months or 10,000 km after the last service, whichever comes first.
export const SERVICE_EVERY_MONTHS = 6;
export const SERVICE_EVERY_KM = 10000;
const SOON_DAYS = 14;
const SOON_KM = 500;

const dayNumber = (s) => Math.floor(new Date(`${s}T00:00:00Z`).getTime() / 86400000);
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);

function addMonths(dateStr, months) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Average km per day, worked out from the odometer history (needs two readings at least a week apart).
export function kmPerDay(vehicle) {
  const r = [...(vehicle.odometer || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  if (r.length < 2) return null;
  const days = (new Date(r.at(-1).date) - new Date(r[0].date)) / 86400000;
  const km = r.at(-1).km - r[0].km;
  return days >= 7 && km > 0 ? km / days : null;
}

// Where the vehicle is against its next service. null if it has never been serviced through the app.
export function serviceStatus(vehicle, today) {
  const last = vehicle.lastService;
  if (!last?.date) return null;
  const dueDate = addMonths(last.date, SERVICE_EVERY_MONTHS);
  const daysLeft = daysBetween(today, dueDate);
  const kmLeft = last.km != null ? last.km + SERVICE_EVERY_KM - vehicle.km : null;
  const overdue = daysLeft < 0 || (kmLeft != null && kmLeft <= 0);
  const soon = !overdue && (daysLeft <= SOON_DAYS || (kmLeft != null && kmLeft <= SOON_KM));
  return { dueDate, daysLeft, kmLeft, overdue, soon, state: overdue ? 'overdue' : soon ? 'soon' : 'ok' };
}

const HEALTH_LABEL = { engine: 'Engine', brakes: 'Brakes', tyres: 'Tyres', battery: 'Battery', engineOil: 'Engine oil' };
const HEALTH_WORDS = { needs_attention: 'needs attention', replace_soon: 'should be replaced soon', critical: 'is in critical condition' };

// Plain-language suggestions for one vehicle, most urgent first.
// `latestHealth` is the vehicle's most recent inspection (or null).
export function buildSuggestions(vehicle, latestHealth, today) {
  const out = [];

  const s = serviceStatus(vehicle, today);
  if (s && s.state !== 'ok') {
    const perDay = kmPerDay(vehicle);
    const bits = [];
    if (s.daysLeft < 0) bits.push(`${-s.daysLeft} day${s.daysLeft === -1 ? '' : 's'} past the ${SERVICE_EVERY_MONTHS}-month mark`);
    else bits.push(`${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} to the ${SERVICE_EVERY_MONTHS}-month mark`);
    if (s.kmLeft != null) bits.push(s.kmLeft <= 0 ? `${-s.kmLeft} km past the ${SERVICE_EVERY_KM.toLocaleString('en-IN')} km mark` : `${s.kmLeft} km to the ${SERVICE_EVERY_KM.toLocaleString('en-IN')} km mark`);
    out.push({
      kind: 'service', severity: s.overdue ? 'high' : 'medium',
      title: s.overdue ? 'Service is overdue' : 'Service is due soon',
      detail: `${bits.join(' and ')}.${perDay && s.kmLeft > 0 ? ` At about ${Math.round(perDay)} km a day, you reach it in around ${Math.ceil(s.kmLeft / perDay)} days.` : ''}`,
      action: 'book'
    });
  }

  if (latestHealth) {
    for (const [part, value] of Object.entries(latestHealth.items || {})) {
      if (!HEALTH_WORDS[value]) continue;
      out.push({
        kind: 'health', severity: value === 'critical' ? 'high' : 'medium',
        title: `${HEALTH_LABEL[part] || part}: check at your next service`,
        detail: `Inspection on ${latestHealth.date}: ${(HEALTH_LABEL[part] || part).toLowerCase()} ${HEALTH_WORDS[value]}. It has not been marked as replaced since.`,
        action: 'book'
      });
    }
  }

  const rank = { high: 0, medium: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
