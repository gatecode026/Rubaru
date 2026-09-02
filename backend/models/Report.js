const mongoose = require('mongoose');
const { ReportCategories, ReportStatuses, ReportSubjectTypes, ModerationPriorities } = require('./enums');

const ReportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Backwards compatibility alias
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: function () {
        return this.subjectOwnerId || null;
      },
      index: true,
      validate: {
        validator: function (reportedId) {
          if (!this.reporter || !reportedId) return true;
          return this.reporter.toString() !== reportedId.toString();
        },
        message: 'Users cannot report themselves',
      },
    },
    subjectType: {
      type: String,
      enum: Object.values(ReportSubjectTypes),
      default: ReportSubjectTypes.USER,
      required: true,
      index: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      default: function () {
        return this.reportedUser || null;
      },
      required: true,
      index: true,
    },
    subjectOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: function () {
        return this.reportedUser || null;
      },
      required: true,
      index: true,
      validate: {
        validator: function (ownerId) {
          if (!this.reporter || !ownerId) return true;
          return this.reporter.toString() !== ownerId.toString();
        },
        message: 'Users cannot report themselves',
      },
    },
    category: {
      type: String,
      enum: Object.values(ReportCategories),
      required: true,
      index: true,
    },
    reasonCode: {
      type: String,
      default: function () {
        return this.category;
      },
    },
    description: {
      type: String,
      maxLength: [1000, 'Report description cannot exceed 1000 characters'],
      trim: true,
      default: '',
    },
    evidenceUrls: [
      {
        type: String,
        trim: true,
      },
    ],
    evidenceSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ModerationEvidenceSnapshot',
      default: null,
      index: true,
    },
    moderationCaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ModerationCase',
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(ModerationPriorities),
      default: ModerationPriorities.LOW,
      index: true,
    },
    sourceSurface: {
      type: String,
      default: 'GENERAL',
    },
    originBatchId: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatuses),
      default: ReportStatuses.PENDING,
      index: true,
    },
    moderatorNotes: {
      type: String,
      default: '',
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    schemaVersion: {
      type: String,
      default: '2.0',
    },
  },
  { timestamps: true }
);

// Compound Indexes for Duplicate Report Protection and Moderation Queueing
ReportSchema.index({ reporter: 1, subjectType: 1, subjectId: 1, category: 1 });
ReportSchema.index({ subjectType: 1, subjectId: 1, status: 1 });
ReportSchema.index({ status: 1, priority: 1, createdAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);
