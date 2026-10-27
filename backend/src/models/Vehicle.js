import mongoose from 'mongoose';
import { VEHICLE_TYPES, FUEL_TYPES } from '../constants/vehicles.js';

const odometerSchema = new mongoose.Schema(
  {
    km: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    source: { type: String, enum: ['customer', 'service'], default: 'customer' }
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true, maxlength: 60 },
    variant: { type: String, trim: true, maxlength: 60 },
    year: { type: Number, required: true },
    regNumber: { type: String, required: true, uppercase: true, trim: true },
    fuel: { type: String, enum: FUEL_TYPES, required: true },
    km: { type: Number, required: true, min: 0 },
    odometer: { type: [odometerSchema], default: [] },
    documents: {
      insuranceExpiry: Date,
      pucExpiry: Date,
      rcExpiry: Date
    },
    image: {
      url: String,
      publicId: String
    },
    // Phase 6: filled in when a service is completed and the vehicle collected.
    lastService: {
      date: String,            // 'YYYY-MM-DD'
      km: Number,
      serviceName: String,
      center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter' },
      booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
    },
    // Service history report: the link printed as a QR code on the PDF. The owner can switch it off.
    historyShare: {
      token: { type: String, index: { unique: true, sparse: true } },
      createdAt: Date
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// A registration number can belong to only one active vehicle on the platform.
vehicleSchema.index({ regNumber: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export default mongoose.model('Vehicle', vehicleSchema);
