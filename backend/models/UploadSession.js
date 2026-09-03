const mongoose = require('mongoose');

const UploadSessionSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    declaredMimeType: {
      type: String,
      required: true,
      trim: true,
    },
    declaredFileSize: {
      type: Number,
      required: true,
      min: 1,
    },
    declaredChecksum: {
      type: String,
      default: '',
      trim: true,
    },
    objectKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    provider: {
      type: String,
      default: 'local',
    },
    bucket: {
      type: String,
      default: 'rubaru-media-private',
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'AUTHORIZED',
        'UPLOADED',
        'FINALIZING',
        'FINALIZED',
        'EXPIRED',
        'CANCELLED',
        'FAILED',
      ],
      default: 'AUTHORIZED',
      index: true,
    },
    mediaAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    finalizedAt: {
      type: Date,
    },
    failureCode: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
UploadSessionSchema.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true });
UploadSessionSchema.index({ ownerId: 1, createdAt: -1 });
UploadSessionSchema.index({ status: 1, expiresAt: 1 });
UploadSessionSchema.index({ conversationId: 1, status: 1 });

module.exports = mongoose.model('UploadSession', UploadSessionSchema);
