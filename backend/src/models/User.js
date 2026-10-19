import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['customer', 'service_center', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 15 },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'customer', index: true },
    isActive: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true }   // Phase 8: also send important updates by email
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);
