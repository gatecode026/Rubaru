const mongoose = require('mongoose');

const RecommendationBatchSchema = new mongoose.Schema(
  {
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    preferenceVersion: {
      type: Number,
      required: true,
    },
    rankingConfigVersion: {
      type: String,
      required: true,
      default: 'v1.0-mvp',
    },
    locationVersion: {
      type: Number,
      default: 1,
    },
    cursorHash: {
      type: String,
      default: '',
      trim: true,
    },
    candidates: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    candidateIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    surface: {
      type: String,
      enum: ['DISCOVERY_FEED', 'MAP_EXPLORE'],
      default: 'DISCOVERY_FEED',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'INVALIDATED', 'COMPLETED'],
      default: 'ACTIVE',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatic TTL cleanup at expiresAt timestamp
    },
  },
  { timestamps: true }
);

RecommendationBatchSchema.index({ viewer: 1, expiresAt: 1 });

module.exports = mongoose.model('RecommendationBatch', RecommendationBatchSchema);
