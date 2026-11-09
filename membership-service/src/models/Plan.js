const mongoose = require('mongoose');

// Collection: plans (database: fitcore_membership)
const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      max: 730,
      validate: { validator: Number.isInteger, message: 'durationDays must be a whole number' }
    },
    features: [{ type: String, trim: true, maxlength: 100 }],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, versionKey: false }
);

planSchema.index({ isActive: 1, price: 1 });

module.exports = mongoose.model('Plan', planSchema);
