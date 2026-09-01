const mongoose = require('mongoose');

const ContentImpressionSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    surface: {
      type: String,
      enum: ['HOME_CONNECTED', 'REELS', 'EXPLORE'],
      default: 'HOME_CONNECTED',
      required: true,
    },
    source: {
      type: String,
      default: 'CONNECTED',
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    orderingVersion: {
      type: String,
      required: true,
      default: 'connected_feed_chronological_v1',
    },
    visiblePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    qualifiedAt: {
      type: Date,
      required: true,
    },
    clientOccurredAt: {
      type: Date,
      default: Date.now,
    },
    serverReceivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dwellTimeMs: {
      type: Number,
      required: true,
      min: 0,
      max: 300000, // 5 min max clamp
    },
    sessionId: {
      type: String,
      default: '',
    },
    appState: {
      type: String,
      default: 'active',
    },
    networkState: {
      type: String,
      default: 'unknown',
    },
    clientVersion: {
      type: String,
      default: '1.0.0',
    },
    eventSchemaVersion: {
      type: String,
      default: '1.0',
    },
  },
  { timestamps: true }
);

// Indexes
ContentImpressionSchema.index({ viewerId: 1, serverReceivedAt: -1 });
ContentImpressionSchema.index({ contentId: 1, serverReceivedAt: -1 });
ContentImpressionSchema.index({ batchId: 1, position: 1 });
ContentImpressionSchema.index({ authorId: 1, serverReceivedAt: -1 });

module.exports = mongoose.model('ContentImpression', ContentImpressionSchema);
