const mongoose = require('mongoose');

const ModerationAuditLogSchema = new mongoose.Schema(
  {
    moderatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ModerationCase',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    subjectType: {
      type: String,
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    previousState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reasonCode: {
      type: String,
      default: null,
    },
    internalNotes: {
      type: String,
      default: null,
    },
    correlationId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

ModerationAuditLogSchema.index({ caseId: 1, createdAt: -1 });
ModerationAuditLogSchema.index({ moderatorId: 1, createdAt: -1 });
ModerationAuditLogSchema.index({ subjectId: 1, createdAt: -1 });

module.exports = mongoose.model('ModerationAuditLog', ModerationAuditLogSchema);
