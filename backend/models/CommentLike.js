const mongoose = require('mongoose');

const CommentLikeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
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

CommentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true });
CommentLikeSchema.index({ commentId: 1, status: 1 });

module.exports = mongoose.model('CommentLike', CommentLikeSchema);
