import mongoose from 'mongoose';

// The condition of a vehicle's main parts at one inspection.
// Every inspection adds a record, so the customer can see how the condition changes over time.
export const HEALTH_PARTS = ['engine', 'brakes', 'tyres', 'battery', 'engineOil'];
export const HEALTH_VALUES = ['good', 'needs_attention', 'replace_soon', 'critical', 'replaced', 'changed'];

const vehicleHealthSchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
    date: { type: String, required: true },            // 'YYYY-MM-DD' of the inspection
    km: { type: Number, min: 0 },                       // odometer at inspection
    items: {
      engine: { type: String, enum: HEALTH_VALUES, default: 'good' },
      brakes: { type: String, enum: HEALTH_VALUES, default: 'good' },
      tyres: { type: String, enum: HEALTH_VALUES, default: 'good' },
      battery: { type: String, enum: HEALTH_VALUES, default: 'good' },
      engineOil: { type: String, enum: HEALTH_VALUES, default: 'good' }
    },
    notes: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true }
);

vehicleHealthSchema.index({ booking: 1 });

export default mongoose.model('VehicleHealth', vehicleHealthSchema);
