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

const WaveformSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      default: 1,
    },
    samples: [
      {
        type: Number,
      },
    ],
    peaks: [
      {
        type: Number,
      },
    ],
    sampleCount: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
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
    attachmentCategory: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'AUDIO', 'VOICE_NOTE'],
      default: 'IMAGE',
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      index: true,
      default: null,
    },
    isConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    consumedByMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
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
    waveform: {
      type: WaveformSchema,
      default: null,
    },
    aspectRatio: {
      type: Number,
      default: 1.0,
    },
    processingStatus: {
      type: String,
      enum: [
        'INITIATED',
        'AUTHORIZED',
        'PENDING_UPLOAD',
        'UPLOADED',
        'VERIFYING',
        'QUEUED',
        'PROCESSING',
        'READY',
        'FAILED',
        'FAILED_RETRYABLE',
        'FAILED_PERMANENT',
        'REJECTED',
        'QUARANTINED',
        'CANCELLED',
        'ORPHANED',
        'DELETING',
        'DELETED',
      ],
      default: 'PENDING_UPLOAD',
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ['NOT_STARTED', 'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'QUARANTINED'],
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
    quarantineReason: {
      type: String,
      default: null,
    },
    safetyHold: {
      type: Boolean,
      default: false,
      index: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    cancelledAt: {
      type: Date,
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
MediaAssetSchema.index({ conversationId: 1, processingStatus: 1 });

module.exports = mongoose.model('MediaAsset', MediaAssetSchema);
