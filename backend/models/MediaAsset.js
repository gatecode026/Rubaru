const mongoose = require('mongoose');

const MediaVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    objectKey: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    bitrateKbps: {
      type: Number,
      default: 0,
    },
    url: {
      type: String,
      default: '',
    },
    processingState: {
      type: String,
      enum: ['READY', 'FAILED'],
      default: 'READY',
    },
  },
  { _id: false }
);

const MediaAssetSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    uploadSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadSession',
      required: true,
      unique: true,
    },
    purpose: {
      type: String,
      enum: ['PROFILE_PHOTO', 'POST_MEDIA', 'REEL_VIDEO', 'STORY_MEDIA', 'CHAT_ATTACHMENT'],
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'AUDIO'],
      required: true,
    },
    originalObjectKey: {
      type: String,
      required: true,
    },
    originalMimeType: {
      type: String,
      required: true,
    },
    verifiedMimeType: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    checksum: {
      type: String,
      default: '',
    },
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    aspectRatio: {
      type: Number,
      default: 1.0,
    },
    processingStatus: {
      type: String,
      enum: [
        'PENDING_UPLOAD',
        'UPLOADED',
        'VERIFYING',
        'QUEUED',
        'PROCESSING',
        'READY',
        'FAILED',
        'DELETING',
        'DELETED',
      ],
      default: 'PENDING_UPLOAD',
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'],
      default: 'NOT_STARTED',
      index: true,
    },
    variants: {
      type: [MediaVariantSchema],
      default: [],
    },
    thumbnail: {
      objectKey: { type: String, default: '' },
      url: { type: String, default: '' },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    failureCode: {
      type: String,
      default: null,
    },
    failureMessageSafe: {
      type: String,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes
MediaAssetSchema.index({ ownerId: 1, createdAt: -1 });
MediaAssetSchema.index({ processingStatus: 1, updatedAt: 1 });
MediaAssetSchema.index({ purpose: 1, processingStatus: 1 });

module.exports = mongoose.model('MediaAsset', MediaAssetSchema);
