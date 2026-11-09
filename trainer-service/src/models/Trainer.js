const mongoose = require('mongoose');
const { WEEK_DAYS } = require('./constants');

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

const availabilitySchema = new mongoose.Schema(
  {
    day: { type: String, required: true, enum: WEEK_DAYS },
    startTime: { type: String, required: true, match: [TIME_OF_DAY, 'must be HH:mm'] },
    endTime: { type: String, required: true, match: [TIME_OF_DAY, 'must be HH:mm'] }
  },
  { _id: false }
);

// Collection: trainers (database: fitcore_trainer)
// userId links the profile to a user with role 'trainer' in the identity database.
const trainerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    specialties: {
      type: [
        {
          type: String,
          enum: ['yoga', 'hiit', 'strength', 'cardio', 'pilates', 'boxing', 'cycling', 'crossfit', 'nutrition', 'rehab']
        }
      ],
      validate: { validator: (list) => list.length > 0, message: 'add at least one specialty' }
    },
    bio: { type: String, trim: true, maxlength: 500 },
    experienceYears: { type: Number, min: 0, max: 60 },
    certifications: [{ type: String, trim: true, maxlength: 100 }],
    hourlyRate: { type: Number, min: 0 },
    availability: [availabilitySchema],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, versionKey: false }
);

trainerSchema.index({ specialties: 1, isActive: 1 });

module.exports = mongoose.model('Trainer', trainerSchema);
