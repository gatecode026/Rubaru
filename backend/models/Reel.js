const mongoose = require('mongoose');

const ReelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    videoUri: {
      type: String,
      required: true,
    },
    thumbnailUri: {
      type: String,
      default: '',
    },
    caption: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'General',
    },
    location: {
      type: String,
      default: '',
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    sharesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Reel', ReelSchema);
