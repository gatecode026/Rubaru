const mongoose = require('mongoose');

const ReelPlaybackEventSchema = new mongoose.Schema(
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
    reelId: {
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
      enum: ['REELS_CONNECTED', 'PROFILE_REEL', 'SHARED_REEL', 'NOTIFICATION_REEL', 'REELS'],
      default: 'REELS_CONNECTED',
      required: true,
    },
    position: {
      type: Number,
      default: 0,
      min: 0,
    },
    playbackSessionId: {
      type: String,
      default: '',
    },
    eventType: {
      type: String,
      enum: ['PLAY_STARTED', 'PLAY_SUMMARY', 'PLAY_COMPLETED', 'REPLAYED', 'SKIPPED'],
      default: 'PLAY_SUMMARY',
      required: true,
    },
    watchedMs: {
      type: Number,
      required: true,
      min: 0,
      max: 600000, // 10 min max clamp
    },
    maxPositionMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    replayed: {
      type: Boolean,
      default: false,
    },
    skipped: {
      type: Boolean,
      default: false,
    },
    muted: {
      type: Boolean,
      default: false,
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

// Compound Indexes
ReelPlaybackEventSchema.index({ viewerId: 1, serverReceivedAt: -1 });
ReelPlaybackEventSchema.index({ reelId: 1, serverReceivedAt: -1 });
ReelPlaybackEventSchema.index({ authorId: 1, serverReceivedAt: -1 });
ReelPlaybackEventSchema.index({ batchId: 1, position: 1 });

module.exports = mongoose.model('ReelPlaybackEvent', ReelPlaybackEventSchema);
