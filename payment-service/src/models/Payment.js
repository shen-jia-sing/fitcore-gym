const mongoose = require('mongoose');

// Collection: payments (database: fitcore_payment)
const paymentSchema = new mongoose.Schema(
  {
    receiptNo: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ['USD'], default: 'USD' },
    method: {
      type: String,
      required: true,
      enum: ['cash', 'card', 'aba_pay', 'bank_transfer']
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: { type: Date },
    note: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: true, versionKey: false }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ membershipId: 1 });
paymentSchema.index({ status: 1, method: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
