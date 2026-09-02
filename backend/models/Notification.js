const mongoose = require('mongoose');
const { SocialNotificationTypes, NotificationCategories } = require('./enums');

const NotificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Sender / Actor (null for system notifications)
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(SocialNotificationTypes),
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(NotificationCategories),
      default: NotificationCategories.CONTENT_UPDATES,
      index: true,
    },
    subjectType: {
      type: String,
      enum: ['USER', 'POST', 'REEL', 'STORY', 'COMMENT', 'CHAT', 'CALL', 'SAFETY', 'MATCH', 'SYSTEM'],
      default: 'POST',
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    sourceEventId: {
      type: String,
      index: true,
    },
    deduplicationKey: {
      type: String,
      index: true,
      sparse: true,
    },
    titleKey: {
      type: String,
      default: '',
    },
    bodyKey: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: true,
    },
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    deepLink: {
      type: String,
      default: '',
    },
    previewMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
    },
    previewThumbnailUri: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUPPRESSED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    groupCount: {
      type: Number,
      default: 1,
    },
    groupActors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Backwards compatibility references
    relatedReel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
    },
    relatedChat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
    },
  },
  { timestamps: true }
);

// High-efficiency compound query indexes
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1, subjectId: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
