const mongoose = require('mongoose');
const {
  ReportSubjectTypes,
  ModerationCaseStatuses,
  ModerationPriorities,
  ModerationDecisions,
} = require('./enums');

const ModerationCaseSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
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
    status: {
      type: String,
      enum: Object.values(ModerationCaseStatuses),
      default: ModerationCaseStatuses.OPEN,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(ModerationPriorities),
      default: ModerationPriorities.LOW,
      index: true,
    },
    reasonCategories: [
      {
        type: String,
      },
    ],
    reportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Report',
      },
    ],
    evidenceSnapshotIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModerationEvidenceSnapshot',
      },
    ],
    automatedAssessments: [
      {
        provider: { type: String, default: 'TEST_ADAPTER' },
        providerRequestId: { type: String },
        recommendedAction: { type: String },
        categoryScores: { type: mongoose.Schema.Types.Mixed },
        assessedAt: { type: Date, default: Date.now },
      },
    ],
    assignedModeratorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignmentVersion: {
      type: Number,
      default: 0,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    decision: {
      type: String,
      enum: Object.values(ModerationDecisions).concat([null]),
      default: null,
    },
    decisionReasonCode: {
      type: String,
      default: null,
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
    internalNotes: [
      {
        note: { type: String, required: true },
        moderatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    schemaVersion: {
      type: String,
      default: '1.0',
    },
  },
  { timestamps: true }
);

// Indexes
ModerationCaseSchema.index({ status: 1, priority: 1, createdAt: -1 });
ModerationCaseSchema.index({ subjectType: 1, subjectId: 1, status: 1 });
ModerationCaseSchema.index({ assignedModeratorId: 1, status: 1 });

module.exports = mongoose.model('ModerationCase', ModerationCaseSchema);
