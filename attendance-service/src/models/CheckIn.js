const mongoose = require('mongoose');

// Collection: checkins (database: fitcore_attendance) - one document per gym visit.
const checkInSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, required: true },
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date },
    durationMinutes: { type: Number, min: 0 },
    status: { type: String, enum: ['checked_in', 'checked_out'], default: 'checked_in' },
    notes: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: true, versionKey: false }
);

// A member can have only one open visit at a time.
checkInSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'checked_in' },
    name: 'one_open_visit_per_member'
  }
);
checkInSchema.index({ userId: 1, checkInAt: -1 });
checkInSchema.index({ checkInAt: -1 });

module.exports = mongoose.model('CheckIn', checkInSchema);
