const mongoose = require('mongoose');

const ShareEventSchema = new mongoose.Schema(
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
    destinationType: {
      type: String,
      enum: ['COPY_LINK', 'EXTERNAL', 'INTERNAL_CONVERSATION', 'STORY'],
      required: true,
    },
    destinationId: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  { timestamps: true }
);

ShareEventSchema.index({ contentId: 1, createdAt: -1 });
ShareEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ShareEvent', ShareEventSchema);
