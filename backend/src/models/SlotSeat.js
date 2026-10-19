import mongoose from 'mongoose';

// Every place in a slot is a numbered "seat". A slot with capacity 2 has seats 0 and 1.
// The unique index on (center, date, slot, seat) means the DATABASE refuses a second
// record for the same seat. Two customers clicking at the same moment can't both get it:
// one insert succeeds, the other fails with a duplicate-key error and tries the next seat.
const slotSeatSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
    date: { type: String, required: true },
    slot: { type: String, required: true },
    seat: { type: Number, required: true, min: 0 },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }
  },
  { timestamps: true }
);

slotSeatSchema.index({ center: 1, date: 1, slot: 1, seat: 1 }, { unique: true });
slotSeatSchema.index({ booking: 1 });

export default mongoose.model('SlotSeat', slotSeatSchema);
