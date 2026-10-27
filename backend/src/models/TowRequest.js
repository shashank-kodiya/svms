import mongoose from 'mongoose';

// A customer stuck on the road asks a service center to tow their vehicle.
// The center sees the customer's location and phone, and updates the status as the truck comes.
export const TOW_STATUSES = ['requested', 'accepted', 'on_the_way', 'completed', 'declined', 'cancelled'];
export const TOW_OPEN = ['requested', 'accepted', 'on_the_way'];

const towRequestSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },   // when stuck on the way to a booking
    vehicle: {                                                                       // copied, so later edits don't change it
      brand: String, model: String, regNumber: String, type: { type: String }
    },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 }
    },
    distanceKm: Number,                                   // straight line from the center when requested
    phone: { type: String, required: true, trim: true, maxlength: 15 },
    note: { type: String, trim: true, maxlength: 300 },   // e.g. "Flat tyre near Pumpwell flyover"
    status: { type: String, enum: TOW_STATUSES, default: 'requested', index: true },
    centerNote: { type: String, trim: true, maxlength: 300 },   // e.g. "Truck coming, ETA 20 min" or why declined
    history: [{ status: String, at: { type: Date, default: Date.now }, _id: false }]
  },
  { timestamps: true }
);

towRequestSchema.index({ center: 1, createdAt: -1 });

export default mongoose.model('TowRequest', towRequestSchema);
