const mongoose = require('mongoose');

const SaveSchema = new mongoose.Schema(
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

SaveSchema.index({ userId: 1, contentId: 1 }, { unique: true });
SaveSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Save', SaveSchema);
