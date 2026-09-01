const mongoose = require('mongoose');

const IssuedFeedItemSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      default: 'CONNECTED',
    },
  },
  { _id: false }
);

const FeedBatchSchema = new mongoose.Schema(
  {
    batchId: {
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
    surface: {
      type: String,
      enum: ['HOME_CONNECTED', 'REELS_CONNECTED', 'REELS', 'EXPLORE', 'PROFILE_REEL', 'SHARED_REEL', 'NOTIFICATION_REEL'],
      default: 'HOME_CONNECTED',
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: 'CONNECTED',
      required: true,
    },
    orderingVersion: {
      type: String,
      required: true,
      default: 'connected_feed_chronological_v1',
    },
    requestId: {
      type: String,
      default: '',
    },
    cursorContextHash: {
      type: String,
      default: '',
    },
    issuedItems: {
      type: [IssuedFeedItemSchema],
      default: [],
    },
    issuedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound indexes
FeedBatchSchema.index({ viewerId: 1, issuedAt: -1 });
FeedBatchSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Automatic TTL cleanup after expiry

module.exports = mongoose.model('FeedBatch', FeedBatchSchema);
