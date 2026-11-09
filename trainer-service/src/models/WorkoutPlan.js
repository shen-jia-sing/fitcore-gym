const mongoose = require('mongoose');
const { WEEK_DAYS } = require('./constants');

const exerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    day: { type: String, required: true, enum: WEEK_DAYS },
    sets: { type: Number, required: true, min: 1, max: 20 },
    reps: { type: Number, required: true, min: 1, max: 100 },
    restSeconds: { type: Number, min: 0, max: 600 }
  },
  { _id: false }
);

// Collection: workoutplans (database: fitcore_trainer)
// A trainer writes a plan for one member. trainerId and memberId are user ids.
const workoutPlanSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    goal: {
      type: String,
      required: true,
      enum: ['weight_loss', 'muscle_gain', 'endurance', 'flexibility', 'general_fitness']
    },
    level: { type: String, required: true, enum: ['beginner', 'intermediate', 'advanced'] },
    durationWeeks: { type: Number, required: true, min: 1, max: 52 },
    exercises: {
      type: [exerciseSchema],
      validate: { validator: (list) => list.length > 0, message: 'add at least one exercise' }
    },
    notes: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['active', 'completed', 'archived'], default: 'active' }
  },
  { timestamps: true, versionKey: false }
);

workoutPlanSchema.index({ memberId: 1, status: 1 });
workoutPlanSchema.index({ trainerId: 1, createdAt: -1 });

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);
