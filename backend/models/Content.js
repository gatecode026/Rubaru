const mongoose = require('mongoose');

const ContentMediaItemSchema = new mongoose.Schema(
  {
    mediaAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: () => new mongoose.Types.ObjectId(),
    },
    position: {
      type: Number,
      default: 0,
      min: 0,
    },
    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO'],
      default: 'IMAGE',
    },
    originalUrl: {
      type: String,
      default: '',
    },
    variants: [
      {
        name: { type: String, default: 'original' },
        objectKey: { type: String, default: '' },
        mimeType: { type: String, default: 'image/jpeg' },
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 },
        fileSize: { type: Number, default: 0 },
        url: { type: String, default: '' },
      },
    ],
    thumbnail: {
      objectKey: { type: String, default: '' },
      url: { type: String, default: '' },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    width: {
      type: Number,
      default: 1080,
    },
    height: {
      type: Number,
      default: 1350,
    },
    aspectRatio: {
      type: Number,
      default: 0.8,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    accessibilityDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
  },
  { _id: false }
);

const ContentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ['POST', 'REEL', 'STORY'],
      required: true,
      default: 'POST',
      index: true,
    },
    caption: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2200,
    },
    mediaItems: {
      type: [ContentMediaItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length >= 1 && items.length <= 10;
        },
        message: 'A post must contain between 1 and 10 media items.',
      },
    },
    audience: {
      type: String,
      enum: ['PUBLIC', 'FOLLOWERS'],
      required: true,
      default: 'PUBLIC',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PROCESSING',
        'MODERATION_PENDING',
        'PUBLISHED',
        'EXPIRED',
        'ARCHIVED',
        'FAILED',
        'REJECTED',
        'HIDDEN',
        'DELETED',
      ],
      required: true,
      default: 'PUBLISHED',
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'],
      default: 'APPROVED',
      index: true,
    },
    locationLabel: {
      type: String,
      default: '',
      trim: true,
      maxlength: 100,
    },
    sequenceGroupId: {
      type: String,
      default: '',
      index: true,
    },
    sequencePosition: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    playCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    videoMediaAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null,
      index: true,
    },
    coverMediaAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      default: null,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 1080,
    },
    height: {
      type: Number,
      default: 1920,
    },
    aspectRatio: {
      type: Number,
      default: 0.5625,
    },
    hasAudio: {
      type: Boolean,
      default: true,
    },
    audioType: {
      type: String,
      enum: ['ORIGINAL', 'NONE'],
      default: 'ORIGINAL',
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    savesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletionReason: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      sparse: true,
      index: true,
    },
    schemaVersion: {
      type: String,
      default: '1.0',
    },
  },
  { timestamps: true }
);

// Indexes
ContentSchema.index(
  { authorId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
ContentSchema.index({ authorId: 1, contentType: 1, status: 1, publishedAt: -1, _id: -1 });
ContentSchema.index({ contentType: 1, status: 1, moderationStatus: 1, authorId: 1, publishedAt: -1, _id: -1 });
ContentSchema.index({ contentType: 1, status: 1, expiresAt: 1, publishedAt: -1 });
ContentSchema.index({ authorId: 1, contentType: 1, status: 1, expiresAt: 1, publishedAt: -1 });
ContentSchema.index({ sequenceGroupId: 1, sequencePosition: 1 });
ContentSchema.index({ status: 1, publishedAt: -1 });
ContentSchema.index({ audience: 1, status: 1, publishedAt: -1 });

module.exports = mongoose.model('Content', ContentSchema);
