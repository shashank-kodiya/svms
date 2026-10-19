import mongoose from 'mongoose';

// A customer's rating of a finished job. One review per booking (enforced by the unique index).
const reviewSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceName: { type: String, trim: true },                       // copied from the booking, for display
    rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'Rating must be a whole number from 1 to 5.' } },
    comment: { type: String, trim: true, maxlength: 500 },
    reply: {
      text: { type: String, trim: true, maxlength: 500 },
      at: Date
    }
  },
  { timestamps: true }
);

reviewSchema.index({ center: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
