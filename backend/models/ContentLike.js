const mongoose = require('mongoose');

const ContentLikeSchema = new mongoose.Schema(
  {
    userId: {
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
    reactionType: {
      type: String,
      enum: ['LIKE'],
      default: 'LIKE',
      required: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'REMOVED'],
      default: 'ACTIVE',
      index: true,
    },
    removedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Constraints & Compound Indexes
ContentLikeSchema.index({ userId: 1, contentId: 1, reactionType: 1 }, { unique: true });
ContentLikeSchema.index({ contentId: 1, status: 1 });

module.exports = mongoose.model('ContentLike', ContentLikeSchema);
