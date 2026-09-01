const mongoose = require('mongoose');
const { OutboxStatuses } = require('./enums');

const OutboxEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    aggregateType: {
      type: String,
      enum: ['MATCH', 'LIKE', 'INTERACTION', 'IMPRESSION', 'USER', 'SAFETY', 'LOCATION', 'PREFERENCE', 'MEDIA_ASSET', 'CONTENT'],
      required: true,
    },
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    payloadSchemaVersion: {
      type: String,
      required: true,
      default: '1.0',
    },
    deduplicationKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(OutboxStatuses),
      default: OutboxStatuses.PENDING,
      index: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    processedAt: {
      type: Date,
    },
    lastError: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Worker polling index
OutboxEventSchema.index({ status: 1, availableAt: 1 });

module.exports = mongoose.model('OutboxEvent', OutboxEventSchema);
