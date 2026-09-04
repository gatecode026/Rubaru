const mongoose = require('mongoose');

const AdminAuditLogSchema = new mongoose.Schema(
  {
    adminUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    permissionUsed: {
      type: String,
      default: null,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['RATE_CONFIG', 'WALLET', 'PAID_SESSION', 'USER', 'FEATURE_FLAGS', 'RECONCILIATION', 'RISK', 'SYSTEM', 'WORKER'],
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      default: '',
    },
    requestId: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    result: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'WARNING'],
      default: 'SUCCESS',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AdminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', AdminAuditLogSchema);
