const mongoose = require('mongoose');

// Collection: memberships (database: fitcore_membership)
// planName, price and durationDays are copied from the plan when the membership is created,
// so later plan edits do not change what the member signed up for.
const membershipSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
    planName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled'],
      default: 'pending'
    },
    startDate: { type: Date },
    endDate: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

membershipSchema.index({ userId: 1, status: 1 });
membershipSchema.index({ planId: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
