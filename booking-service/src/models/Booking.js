const mongoose = require('mongoose');

// Collection: bookings (database: fitcore_booking)
// classTitle and classStartTime are copied from class-service when the booking is made.
const bookingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, required: true },
    classTitle: { type: String, required: true },
    classStartTime: { type: Date, required: true },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    cancelledAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 300 }
  },
  { timestamps: true, versionKey: false }
);

// A member can hold only one confirmed booking per class.
bookingSchema.index(
  { userId: 1, classId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'confirmed' },
    name: 'one_confirmed_booking_per_member_and_class'
  }
);
bookingSchema.index({ classId: 1, status: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);
