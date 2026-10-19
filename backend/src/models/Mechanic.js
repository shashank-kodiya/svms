import mongoose from 'mongoose';

// Mechanics don't log in. The service center adds them and assigns them to jobs (Phase 5).
const mechanicSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 15 },
    skills: { type: [String], default: [] },       // e.g. ['Engine', 'Brakes']
    experienceYears: { type: Number, min: 0, max: 50 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model('Mechanic', mechanicSchema);
