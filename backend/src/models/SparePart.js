import mongoose from 'mongoose';

// GST slabs allowed on parts in India.
export const GST_RATES = [0, 5, 12, 18, 28];

// A spare part a center keeps in stock. Each center has its own list and prices.
const sparePartSchema = new mongoose.Schema(
  {
    center: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceCenter', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    partNo: { type: String, trim: true, uppercase: true, maxlength: 40 },
    hsn: { type: String, trim: true, maxlength: 8 },            // HSN code printed on the invoice
    unitPrice: { type: Number, required: true, min: 0 },          // selling price in ₹ per unit, before GST
    gstRate: { type: Number, enum: GST_RATES, default: 18 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockAt: { type: Number, min: 0, default: 3 },             // warn when stock is at or below this
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

sparePartSchema.index({ center: 1, name: 1 });

export default mongoose.model('SparePart', sparePartSchema);
