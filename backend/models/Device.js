const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pushToken: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true,
    },
    deviceId: {
      type: String,
      trim: true,
      index: true,
    },
    appVersion: {
      type: String,
      default: '1.0.0',
    },
    locale: {
      type: String,
      default: 'en',
    },
    permissionState: {
      type: String,
      enum: ['GRANTED', 'DENIED', 'PROVISIONAL', 'NOT_DETERMINED'],
      default: 'GRANTED',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    provider: {
      type: String,
      enum: ['FCM', 'APNS', 'EXPO', 'MOCK'],
      default: 'FCM',
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for active user device lookups and deduplication
DeviceSchema.index({ user: 1, status: 1 });
DeviceSchema.index({ pushToken: 1, status: 1 });
DeviceSchema.index({ user: 1, pushToken: 1 }, { unique: true });

module.exports = mongoose.model('Device', DeviceSchema);
