import Vehicle from '../models/Vehicle.js';
import { DOCUMENTS } from '../constants/vehicles.js';
import { nowIST } from '../utils/time.js';
import { notify } from './notifications.js';
import { serviceStatus, daysBetween, SERVICE_EVERY_MONTHS, SERVICE_EVERY_KM } from './maintenance.js';

// Reminders go out when a document is this many days (or fewer) from expiring.
const DOC_STEPS = [30, 7, 1, 0];

const plate = (v) => v.regNumber;
const label = (v) => `${v.brand} ${v.model} (${plate(v)})`;

// Which reminder step a document is at today: 30, 7, 1, 0 (expires today), 'expired', or null (nothing to say).
export function docStep(days) {
  if (days < 0) return days >= -30 ? 'expired' : null; // stop nagging a month after expiry
  return DOC_STEPS.find((s) => days <= s && days >= 0 && !DOC_STEPS.some((t) => t < s && days <= t)) ?? null;
}

// Looks at every active vehicle and creates the reminders that are due today.
// Safe to run any number of times a day: each reminder has a unique key, so it is sent only once.
export async function runReminders() {
  const today = nowIST().date;
  const made = { documents: 0, service: 0, vehicles: 0 };

  for await (const v of Vehicle.find({ isActive: true }).lean().cursor()) {
    made.vehicles += 1;

    for (const [field, name] of Object.entries(DOCUMENTS)) {
      const exp = v.documents?.[field];
      if (!exp) continue;
      const expiry = new Date(exp).toISOString().slice(0, 10);
      const days = daysBetween(today, expiry);
      const step = docStep(days);
      if (step == null) continue;
      const when = step === 'expired' ? `expired on ${expiry}` : days === 0 ? 'expires today' : `expires in ${days} day${days === 1 ? '' : 's'} (${expiry})`;
      const n = await notify(v.owner, {
        type: 'reminder',
        title: `${name} ${step === 'expired' ? 'has expired' : 'is expiring'}: ${plate(v)}`,
        body: `The ${name.toLowerCase()} of your ${label(v)} ${when}. Renew it and update the date on the vehicle page.`,
        link: `/customer/vehicles/${v._id}`,
        dedupeKey: `doc:${v._id}:${field}:${expiry}:${step}`,
        email: step === 7 || step === 1 || step === 0 || step === 'expired'
      });
      if (n) made.documents += 1;
    }

    const s = serviceStatus(v, today);
    if (s && s.state !== 'ok') {
      const why = [];
      if (s.daysLeft < 0) why.push(`${-s.daysLeft} days past the ${SERVICE_EVERY_MONTHS}-month mark`);
      else if (s.daysLeft <= 14) why.push(`due by ${s.dueDate}`);
      if (s.kmLeft != null && s.kmLeft <= 500) why.push(s.kmLeft <= 0 ? `${-s.kmLeft} km past the ${SERVICE_EVERY_KM.toLocaleString('en-IN')} km mark` : `${s.kmLeft} km to go`);
      const n = await notify(v.owner, {
        type: 'reminder',
        title: s.overdue ? `Service overdue: ${plate(v)}` : `Service due soon: ${plate(v)}`,
        body: `Your ${label(v)} (${why.join(', ')}). Book a service to keep it healthy.`,
        link: '/customer/book',
        // one reminder per last-service and state, so a new service starts a fresh cycle
        dedupeKey: `svc:${v._id}:${v.lastService.booking || v.lastService.date}:${s.state}`,
        email: true
      });
      if (n) made.service += 1;
    }
  }
  return made;
}

// Runs the reminders once a day, at 9 AM India time or later (and once right after a late start).
// An hourly check is enough; the unique keys above make an extra run harmless.
let lastRun = null;
export function startReminderScheduler() {
  if (process.env.REMINDERS === 'off') return;
  const tick = async () => {
    const { date, minutes } = nowIST();
    if (lastRun === date || minutes < 9 * 60) return;
    lastRun = date;
    try {
      const r = await runReminders();
      console.log(`Reminders ${date}: ${r.documents} document, ${r.service} service (${r.vehicles} vehicles checked)`);
    } catch (err) {
      lastRun = null; // try again next hour
      console.warn(`Reminder job failed: ${err.message}`);
    }
  };
  setTimeout(tick, 15000); // shortly after start-up
  setInterval(tick, 60 * 60 * 1000).unref();
}
