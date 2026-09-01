const mongoose = require('mongoose');

const ChannelPreferenceSchema = new mongoose.Schema(
  {
    inApp: {
      type: Boolean,
      default: true,
    },
    push: {
      type: Boolean,
      default: true,
    },
    scope: {
      type: String,
      enum: ['everyone', 'profiles', 'off'],
      default: 'everyone',
    },
  },
  { _id: false }
);

const NotificationPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    pauseAll: {
      type: Boolean,
      default: false,
    },
    pauseUntil: {
      type: Date,
    },
    follows: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    likes: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    comments: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    replies: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    shares: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    contentUpdates: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    safetyUpdates: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    messages: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    calls: {
      type: ChannelPreferenceSchema,
      default: () => ({ inApp: true, push: true, scope: 'everyone' }),
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationPreference', NotificationPreferenceSchema);
