// Turns a center's working hours into bookable one-hour slots for a date.
// Phase 4 adds how many places in each slot are already booked.

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
export const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const isValidDateStr = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

// Day of week (0 = Sunday) for a 'YYYY-MM-DD' string, independent of server time zone.
export const dayOfWeek = (dateStr) => new Date(`${dateStr}T00:00:00Z`).getUTCDay();

// Returns { open, reason, slots: [{ start, end, capacity }] }
export function slotsForDate(center, dateStr) {
  const holiday = (center.holidays || []).find((h) => h.date === dateStr);
  if (holiday) return { open: false, reason: `Holiday${holiday.reason ? `: ${holiday.reason}` : ''}`, slots: [] };

  const hours = (center.workingHours || []).find((d) => d.day === dayOfWeek(dateStr));
  if (!hours || !hours.isOpen) return { open: false, reason: 'Closed on this day of the week', slots: [] };

  const len = center.slotSettings?.slotMinutes || 60;
  const capacity = center.slotSettings?.capacityPerSlot || 1;
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  const bStart = hours.breakStart ? toMinutes(hours.breakStart) : null;
  const bEnd = hours.breakEnd ? toMinutes(hours.breakEnd) : null;

  const slots = [];
  for (let t = open; t + len <= close; t += len) {
    const end = t + len;
    const overlapsBreak = bStart !== null && bEnd !== null && t < bEnd && end > bStart;
    if (overlapsBreak) {
      // Restart right after the break so slots line up with the reopening time.
      if (bEnd > t) t = bEnd - len;
      continue;
    }
    slots.push({ start: toHHMM(t), end: toHHMM(end), capacity });
  }
  return { open: slots.length > 0, reason: slots.length ? '' : 'No full slot fits in the working hours', slots };
}

// Checks one day's hours. Returns an error message or null.
export function checkDayHours(d) {
  if (!d.isOpen) return null;
  if (!isValidTime(d.open) || !isValidTime(d.close)) return 'Use times like 09:00.';
  if (toMinutes(d.close) - toMinutes(d.open) < 60) return 'Closing time must be at least one hour after opening.';
  const hasBreak = d.breakStart || d.breakEnd;
  if (hasBreak) {
    if (!isValidTime(d.breakStart) || !isValidTime(d.breakEnd)) return 'Enter both break start and end, like 13:00.';
    if (toMinutes(d.breakEnd) <= toMinutes(d.breakStart)) return 'Break must end after it starts.';
    if (toMinutes(d.breakStart) < toMinutes(d.open) || toMinutes(d.breakEnd) > toMinutes(d.close)) return 'Break must be within working hours.';
  }
  return null;
}
