const mongoose = require('mongoose');

const NotInterestedSchema = new mongoose.Schema(
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
  },
  { timestamps: true }
);

NotInterestedSchema.index({ userId: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model('NotInterested', NotInterestedSchema);
