const mongoose = require('mongoose');

const ProfileImpressionSchema = new mongoose.Schema(
  {
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      validate: {
        validator: function (candidateId) {
          if (!this.viewer || !candidateId) return true;
          return this.viewer.toString() !== candidateId.toString();
        },
        message: 'Viewer and candidate cannot be the same user',
      },
    },
    recommendationId: {
      type: String,
      required: true,
    },
    recommendationBatchId: {
      type: String,
      required: true,
      index: true,
    },
    position: {
      type: Number,
      required: true,
      min: 0,
    },
    surface: {
      type: String,
      enum: ['DISCOVERY_FEED', 'MAP_EXPLORE'],
      default: 'DISCOVERY_FEED',
    },
    configVersion: {
      type: String,
      required: true,
      default: 'v1.0-mvp',
    },
    visibleAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    visibleDurationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDelayedSubmission: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Prevent duplicate logging of the same recommendation in a batch
ProfileImpressionSchema.index(
  { viewer: 1, candidate: 1, recommendationBatchId: 1 },
  { unique: true }
);

// Indexes for analytics and history
ProfileImpressionSchema.index({ viewer: 1, visibleAt: -1 });
ProfileImpressionSchema.index({ candidate: 1, visibleAt: -1 });

module.exports = mongoose.model('ProfileImpression', ProfileImpressionSchema);
