import SlotSeat from '../models/SlotSeat.js';
import { slotsForDate, toMinutes } from '../utils/slots.js';
import { nowIST, addDaysStr } from '../utils/time.js';
import { emitSlotsChanged } from '../realtime.js';

// Slots for one center and date, with how many places are left in each.
export async function availability(center, date) {
  const base = slotsForDate(center, date);
  const now = nowIST();
  const window = center.slotSettings?.bookingWindowDays || 30;

  if (date < now.date) return { date, open: false, reason: 'This date has passed', slots: [] };
  if (date > addDaysStr(now.date, window)) return { date, open: false, reason: `Bookings open ${window} days ahead`, slots: [] };
  if (!base.open) return { date, ...base };

  const used = await seatsUsed(center._id, date);
  const slots = base.slots.map((s) => {
    const booked = used[s.start] || 0;
    const past = date === now.date && toMinutes(s.start) <= now.minutes;
    return { ...s, booked, remaining: past ? 0 : Math.max(0, s.capacity - booked), past };
  });
  const free = slots.filter((s) => s.remaining > 0).length;
  return { date, open: true, reason: free ? '' : 'All slots are full on this date', slots };
}

// How many seats are taken in each slot of a day: { '10:00': 2, ... }
export async function seatsUsed(centerId, date) {
  const seats = await SlotSeat.find({ center: centerId, date }).select('slot').lean();
  const used = {};
  for (const s of seats) used[s.slot] = (used[s.slot] || 0) + 1;
  return used;
}

// Takes one place in a slot. Returns the new seat's id, or null if every seat is taken.
// It simply tries to insert seat 0, then 1, ... up to capacity - 1. The unique index guarantees
// that each seat can be inserted only once, whatever else is happening at the same moment.
export async function reserveSlot(centerId, date, slot, capacity) {
  for (let seat = 0; seat < capacity; seat += 1) {
    try {
      const doc = await SlotSeat.create({ center: centerId, date, slot, seat });
      emitSlotsChanged(centerId, date);
      return doc._id;
    } catch (err) {
      if (err.code !== 11000) throw err; // 11000 = seat already taken: try the next one
    }
  }
  return null;
}

// Links a reserved seat to the booking that uses it.
export async function attachSeat(seatId, bookingId) {
  await SlotSeat.updateOne({ _id: seatId }, { $set: { booking: bookingId } });
}

// Gives a seat back. Pass { seatId } for a seat not yet linked, or { bookingId } for a booking's seat.
export async function releaseSlot(centerId, date, { seatId, bookingId }) {
  if (seatId) await SlotSeat.deleteOne({ _id: seatId });
  else if (bookingId) await SlotSeat.deleteOne({ booking: bookingId, center: centerId, date });
  emitSlotsChanged(centerId, date);
}
