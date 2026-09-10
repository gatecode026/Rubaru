const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    installationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['ANDROID', 'IOS', 'android', 'ios', 'web'],
      required: true,
      set: (v) => (v ? v.toUpperCase() : v),
    },
    pushToken: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    voipPushToken: {
      type: String,
      trim: true,
      default: null,
      sparse: true,
    },
    provider: {
      type: String,
      enum: ['FCM', 'APNS', 'EXPO', 'MOCK'],
      default: 'FCM',
    },
    environment: {
      type: String,
      enum: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
      default: 'DEVELOPMENT',
    },
    appVersion: {
      type: String,
      default: '1.0.0',
    },
    deviceMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    invalidatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound indexes for fast lookups, multi-device queries and token safety
DeviceSchema.index({ user: 1, status: 1 });
DeviceSchema.index({ user: 1, installationId: 1 });
DeviceSchema.index({ pushToken: 1, status: 1 });
DeviceSchema.index({ user: 1, pushToken: 1 });

module.exports = mongoose.model('Device', DeviceSchema);
