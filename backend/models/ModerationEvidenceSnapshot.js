const mongoose = require('mongoose');
const crypto = require('crypto');
const { ReportSubjectTypes } = require('./enums');

const ModerationEvidenceSnapshotSchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      enum: Object.values(ReportSubjectTypes),
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    subjectOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    contentSnapshot: {
      text: { type: String, default: '' },
      caption: { type: String, default: '' },
      mediaItems: [
        {
          mediaAssetId: { type: mongoose.Schema.Types.ObjectId },
          mediaType: { type: String },
          variants: [{ type: mongoose.Schema.Types.Mixed }],
          thumbnail: { type: mongoose.Schema.Types.Mixed },
          url: { type: String },
        },
      ],
      mediaAssetIds: [{ type: mongoose.Schema.Types.ObjectId }],
      publishedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      originalStatus: { type: String, default: 'PUBLISHED' },
      originalModerationStatus: { type: String, default: 'APPROVED' },
    },
    sourceSurface: {
      type: String,
      default: 'GENERAL',
    },
    originBatchId: {
      type: String,
      default: null,
    },
    checksum: {
      type: String,
      default: function () {
        const payload = `${this.subjectType}_${this.subjectId}_${this.subjectOwnerId}_${this.contentSnapshot?.caption || this.contentSnapshot?.text || ''}`;
        return crypto.createHash('sha256').update(payload).digest('hex');
      },
    },
    retentionExpiresAt: {
      type: Date,
      default: function () {
        // Default 365 days retention
        return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      },
    },
    schemaVersion: {
      type: String,
      default: '1.0',
    },
  },
  { timestamps: true }
);

// Indexes
ModerationEvidenceSnapshotSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });
ModerationEvidenceSnapshotSchema.index({ subjectOwnerId: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationEvidenceSnapshot', ModerationEvidenceSnapshotSchema);
