const mongoose = require('mongoose');

const StoryViewSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
      index: true,
    },
    storyAuthorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    viewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    firstViewedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastViewedAt: {
      type: Date,
      default: Date.now,
    },
    viewCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    source: {
      type: String,
      default: 'TRAY',
    },
  },
  { timestamps: true }
);

// Uniqueness per (storyId, viewerId) to record unique views idempotently
StoryViewSchema.index({ storyId: 1, viewerId: 1 }, { unique: true });
StoryViewSchema.index({ storyId: 1, firstViewedAt: -1, _id: -1 });
StoryViewSchema.index({ viewerId: 1, firstViewedAt: -1 });
StoryViewSchema.index({ storyAuthorId: 1, firstViewedAt: -1 });

module.exports = mongoose.model('StoryView', StoryViewSchema);
