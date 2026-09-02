const mongoose = require('mongoose');
const { Genders, DatingIntentions } = require('./enums');

const DatingPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      required: true,
    },
    genderPreference: {
      type: [String],
      enum: Object.values(Genders),
      default: Object.values(Genders),
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one preferred gender must be specified',
      },
    },
    ageRange: {
      min: {
        type: Number,
        default: 18,
        min: 18,
        max: 120,
        required: true,
      },
      max: {
        type: Number,
        default: 99,
        min: 18,
        max: 120,
        required: true,
      },
      isDealbreaker: {
        type: Boolean,
        default: true,
      },
    },
    maxDistanceKm: {
      type: Number,
      default: 50,
      min: 1,
      max: 500,
      required: true,
    },
    distanceDealbreaker: {
      type: Boolean,
      default: true,
    },
    intentions: {
      type: [String],
      enum: Object.values(DatingIntentions),
      default: [DatingIntentions.NOT_SURE],
    },
    intentionDealbreaker: {
      type: Boolean,
      default: false,
    },
    dealbreakerInterests: {
      type: [String],
      default: [],
    },
    showOnlyVerified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Schema validation for age range min <= max
DatingPreferenceSchema.pre('validate', function () {
  if (this.ageRange && typeof this.ageRange.min === 'number' && typeof this.ageRange.max === 'number') {
    if (this.ageRange.min > this.ageRange.max) {
      this.invalidate('ageRange.min', 'Minimum age cannot be greater than maximum age');
    }
  }
});

module.exports = mongoose.model('DatingPreference', DatingPreferenceSchema);
