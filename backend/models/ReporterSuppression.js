const mongoose = require('mongoose');
const { ReportSubjectTypes } = require('./enums');

const ReporterSuppressionSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    reasonCode: {
      type: String,
      default: 'REPORTED',
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index to guarantee uniqueness and fast lookups
ReporterSuppressionSchema.index({ reporterId: 1, subjectType: 1, subjectId: 1 }, { unique: true });
ReporterSuppressionSchema.index({ reporterId: 1, subjectType: 1 });

module.exports = mongoose.model('ReporterSuppression', ReporterSuppressionSchema);
