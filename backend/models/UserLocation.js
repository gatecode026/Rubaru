const mongoose = require('mongoose');

const UserLocationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: function (coords) {
            if (!Array.isArray(coords) || coords.length !== 2) return false;
            const [lng, lat] = coords;
            return typeof lng === 'number' && typeof lat === 'number' &&
                   lng >= -180 && lng <= 180 &&
                   lat >= -90 && lat <= 90;
          },
          message: 'Invalid GeoJSON coordinates. Longitude must be between -180 and 180, Latitude between -90 and 90.',
        },
      },
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    state: {
      type: String,
      default: '',
      trim: true,
    },
    country: {
      type: String,
      default: 'India',
      trim: true,
    },
    accuracy: {
      type: Number,
      default: null,
    },
    source: {
      type: String,
      enum: ['GPS', 'NETWORK', 'IP', 'MANUAL'],
      default: 'GPS',
    },
    isLocationHidden: {
      type: Boolean,
      default: false,
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now,
    },
    suspiciousVelocityFlag: {
      type: Boolean,
      default: false,
    },
    locationVersion: {
      type: Number,
      default: 1,
    },
    lastRequestId: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

UserLocationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('UserLocation', UserLocationSchema);
