const mongoose = require('mongoose');

// Collection: gymclasses (database: fitcore_class)
// availableSeats is decremented/incremented atomically by booking-service through the internal API.
const gymClassSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    category: {
      type: String,
      required: true,
      enum: ['yoga', 'hiit', 'strength', 'cardio', 'pilates', 'boxing', 'cycling', 'crossfit']
    },
    trainerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    trainerName: { type: String, required: true },
    room: { type: String, required: true, trim: true, maxlength: 40 },
    startTime: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 240 },
    capacity: { type: Number, required: true, min: 1, max: 100 },
    availableSeats: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' }
  },
  { timestamps: true, versionKey: false }
);

gymClassSchema.index({ startTime: 1, status: 1 });
gymClassSchema.index({ trainerId: 1, startTime: 1 });
gymClassSchema.index({ category: 1, startTime: 1 });

module.exports = mongoose.model('GymClass', gymClassSchema);
