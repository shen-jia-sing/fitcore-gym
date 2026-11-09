const mongoose = require('mongoose');

// Collection: users (database: fitcore_identity, shared with registration-service, which owns it)
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be a valid email address']
    },
    password: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ['admin', 'trainer', 'member'] },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9][0-9 -]{6,19}$/, 'must be a valid phone number']
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastLoginAt: { type: Date }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password;
        return ret;
      }
    }
  }
);

userSchema.index({ role: 1, createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
