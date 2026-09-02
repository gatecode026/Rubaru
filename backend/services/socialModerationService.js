const mongoose = require('mongoose');
const Report = require('../models/Report');
const ModerationCase = require('../models/ModerationCase');
const ModerationEvidenceSnapshot = require('../models/ModerationEvidenceSnapshot');
const ModerationAuditLog = require('../models/ModerationAuditLog');
const ReporterSuppression = require('../models/ReporterSuppression');
const Content = require('../models/Content');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Profile = require('../models/Profile');
const OutboxEvent = require('../models/OutboxEvent');
const safetyService = require('./safetyService');
const moderationProviderAdapter = require('./moderationProviderAdapter');
const {
  ReportSubjectTypes,
  ReportCategories,
  ReportStatuses,
  ModerationPriorities,
  ModerationCaseStatuses,
  ModerationDecisions,
} = require('../models/enums');

class SocialModerationService {
  /**
   * Determine priority level from report reason
   */
  _calculatePriority(reasonCode) {
    switch (reasonCode) {
      case 'UNDERAGE_CONCERN':
      case 'UNDERAGE':
      case 'SELF_HARM_OR_SUICIDE':
      case 'VIOLENCE_OR_THREATS':
        return ModerationPriorities.CRITICAL;
      case 'NUDITY_OR_SEXUAL_CONTENT':
      case 'INAPPROPRIATE_CONTENT':
      case 'HATE_OR_DISCRIMINATION':
      case 'HARASSMENT_OR_BULLYING':
      case 'HARASSMENT':
        return ModerationPriorities.HIGH;
      case 'SCAM_OR_FRAUD':
      case 'SCAM_OR_SPAM':
      case 'IMPERSONATION':
      case 'FAKE_PROFILE':
        return ModerationPriorities.MEDIUM;
      default:
        return ModerationPriorities.LOW;
    }
  }

  /**
   * Priority comparison helper
   */
  _isHigherPriority(p1, p2) {
    const weights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return (weights[p1] || 1) > (weights[p2] || 1);
  }

  /**
   * Report Social Content (Post, Reel, Story)
   */
  async reportContent(reporterId, contentId, payload = {}) {
    if (!reporterId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const {
      reasonCode = 'OTHER',
      description = '',
      sourceSurface = 'GENERAL',
      originBatchId = null,
      idempotencyKey = null,
      blockAuthor = false,
    } = payload;

    const content = await Content.findById(contentId);
    if (!content) {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (content.authorId.toString() === reporterId.toString()) {
      const err = new Error('Authors cannot report their own content.');
      err.code = 'SELF_REPORT_DISALLOWED';
      err.statusCode = 400;
      throw err;
    }

    const subjectType = ['POST', 'REEL', 'STORY'].includes(content.contentType)
      ? content.contentType
      : 'POST';

    // 1. Idempotency & Duplicate Check
    const existingReport = await Report.findOne({
      reporter: reporterId,
      subjectType,
      subjectId: content._id,
      category: reasonCode,
    });

    if (existingReport) {
      return {
        success: true,
        duplicate: true,
        reportId: existingReport._id.toString(),
        message: 'Report already received and is under review.',
      };
    }

    const priority = this._calculatePriority(reasonCode);

    // 2. Capture Immutable Evidence Snapshot
    const snapshot = await ModerationEvidenceSnapshot.create({
      subjectType,
      subjectId: content._id,
      subjectOwnerId: content.authorId,
      reporterId,
      contentSnapshot: {
        caption: content.caption || '',
        text: content.caption || '',
        mediaItems: content.mediaItems || [],
        mediaAssetIds: (content.mediaItems || []).map((m) => m.mediaAssetId).filter(Boolean),
        publishedAt: content.publishedAt,
        expiresAt: content.expiresAt,
        originalStatus: content.status,
        originalModerationStatus: content.moderationStatus,
      },
      sourceSurface,
      originBatchId,
    });

    // 3. Immediate Reporter Suppression
    await ReporterSuppression.updateOne(
      {
        reporterId,
        subjectType,
        subjectId: content._id,
      },
      {
        $set: {
          reasonCode,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    // 4. Create or Attach to Moderation Case
    let moderationCase = await ModerationCase.findOne({
      subjectType,
      subjectId: content._id,
      status: { $in: [ModerationCaseStatuses.OPEN, ModerationCaseStatuses.TRIAGED, ModerationCaseStatuses.IN_REVIEW, ModerationCaseStatuses.ACTION_REQUIRED] },
    });

    if (moderationCase) {
      moderationCase.evidenceSnapshotIds.push(snapshot._id);
      if (!moderationCase.reasonCategories.includes(reasonCode)) {
        moderationCase.reasonCategories.push(reasonCode);
      }
      if (this._isHigherPriority(priority, moderationCase.priority)) {
        moderationCase.priority = priority;
      }
      await moderationCase.save();
    } else {
      const caseNumber = `case_${new mongoose.Types.ObjectId().toString()}`;
      const assessment = await moderationProviderAdapter.analyzeText(content.caption || '');

      moderationCase = await ModerationCase.create({
        caseNumber,
        subjectType,
        subjectId: content._id,
        subjectOwnerId: content.authorId,
        status: ModerationCaseStatuses.OPEN,
        priority: assessment.recommendedAction === 'FLAG_CRITICAL' ? ModerationPriorities.CRITICAL : priority,
        reasonCategories: [reasonCode],
        reportIds: [],
        evidenceSnapshotIds: [snapshot._id],
        automatedAssessments: [assessment],
      });
    }

    // 5. Create Authoritative Report Record
    const reportDoc = await Report.create({
      reporter: reporterId,
      reportedUser: content.authorId,
      subjectType,
      subjectId: content._id,
      subjectOwnerId: content.authorId,
      category: reasonCode,
      reasonCode,
      description: (description || '').trim().slice(0, 1000),
      evidenceSnapshotId: snapshot._id,
      moderationCaseId: moderationCase._id,
      priority,
      sourceSurface,
      originBatchId,
      idempotencyKey,
      status: ReportStatuses.PENDING,
    });

    moderationCase.reportIds.push(reportDoc._id);
    await moderationCase.save();

    // 6. Optional "Report and Block" Integration
    if (blockAuthor) {
      try {
        await safetyService.blockUser(reporterId, content.authorId);
      } catch (blockErr) {
        console.warn('[REPORT AND BLOCK WARNING]', blockErr.message);
      }
    }

    // 7. Emit Durable Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'content.reported',
        aggregateType: 'CONTENT',
        aggregateId: content._id.toString(),
        payload: {
          reportId: reportDoc._id.toString(),
          caseId: moderationCase._id.toString(),
          subjectType,
          subjectId: content._id.toString(),
          reasonCode,
          priority,
        },
        deduplicationKey: `rep_${reportDoc._id}`,
      });
    } catch (outboxErr) {
      console.warn('[REPORT OUTBOX WARNING]', outboxErr.message);
    }

    return {
      success: true,
      reportId: reportDoc._id.toString(),
      caseNumber: moderationCase.caseNumber,
      status: 'RECEIVED',
    };
  }

  /**
   * Report Comment
   */
  async reportComment(reporterId, commentId, payload = {}) {
    if (!reporterId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const { reasonCode = 'OTHER', description = '', blockAuthor = false } = payload;
    const comment = await Comment.findById(commentId);
    if (!comment) {
      const err = new Error('Comment not found.');
      err.code = 'COMMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (comment.authorId.toString() === reporterId.toString()) {
      const err = new Error('Authors cannot report their own comments.');
      err.code = 'SELF_REPORT_DISALLOWED';
      err.statusCode = 400;
      throw err;
    }

    const existingReport = await Report.findOne({
      reporter: reporterId,
      subjectType: 'COMMENT',
      subjectId: comment._id,
      category: reasonCode,
    });

    if (existingReport) {
      return {
        success: true,
        duplicate: true,
        reportId: existingReport._id.toString(),
        message: 'Report already received.',
      };
    }

    const priority = this._calculatePriority(reasonCode);

    // Evidence Snapshot
    const snapshot = await ModerationEvidenceSnapshot.create({
      subjectType: 'COMMENT',
      subjectId: comment._id,
      subjectOwnerId: comment.authorId,
      reporterId,
      contentSnapshot: {
        text: comment.text || '',
        caption: comment.text || '',
        originalStatus: comment.status,
      },
    });

    // Immediate Suppression
    await ReporterSuppression.updateOne(
      { reporterId, subjectType: 'COMMENT', subjectId: comment._id },
      { $set: { reasonCode, updatedAt: new Date() } },
      { upsert: true }
    );

    // Moderation Case
    let moderationCase = await ModerationCase.findOne({
      subjectType: 'COMMENT',
      subjectId: comment._id,
      status: { $in: [ModerationCaseStatuses.OPEN, ModerationCaseStatuses.TRIAGED, ModerationCaseStatuses.IN_REVIEW, ModerationCaseStatuses.ACTION_REQUIRED] },
    });

    if (!moderationCase) {
      moderationCase = await ModerationCase.create({
        caseNumber: `case_${new mongoose.Types.ObjectId().toString()}`,
        subjectType: 'COMMENT',
        subjectId: comment._id,
        subjectOwnerId: comment.authorId,
        status: ModerationCaseStatuses.OPEN,
        priority,
        reasonCategories: [reasonCode],
        reportIds: [],
        evidenceSnapshotIds: [snapshot._id],
      });
    } else {
      moderationCase.evidenceSnapshotIds.push(snapshot._id);
      if (!moderationCase.reasonCategories.includes(reasonCode)) {
        moderationCase.reasonCategories.push(reasonCode);
      }
      await moderationCase.save();
    }

    const reportDoc = await Report.create({
      reporter: reporterId,
      reportedUser: comment.authorId,
      subjectType: 'COMMENT',
      subjectId: comment._id,
      subjectOwnerId: comment.authorId,
      category: reasonCode,
      reasonCode,
      description: (description || '').trim().slice(0, 1000),
      evidenceSnapshotId: snapshot._id,
      moderationCaseId: moderationCase._id,
      priority,
      status: ReportStatuses.PENDING,
    });

    moderationCase.reportIds.push(reportDoc._id);
    await moderationCase.save();

    if (blockAuthor) {
      try {
        await safetyService.blockUser(reporterId, comment.authorId);
      } catch (bErr) {}
    }

    return {
      success: true,
      reportId: reportDoc._id.toString(),
      caseNumber: moderationCase.caseNumber,
      status: 'RECEIVED',
    };
  }

  /**
   * Report User (Social Profile / Account)
   */
  async reportUser(reporterId, targetUserId, payload = {}) {
    if (!reporterId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const reasonCode = payload.reasonCode || payload.category || 'OTHER';
    const description = payload.description || '';
    const shouldBlock = Boolean(payload.blockUser || payload.alsoBlock);

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      const err = new Error('User not found.');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (targetUserId.toString() === reporterId.toString()) {
      const err = new Error('Users cannot report themselves.');
      err.code = 'SELF_REPORT_DISALLOWED';
      err.statusCode = 400;
      throw err;
    }

    const existingReport = await Report.findOne({
      reporter: reporterId,
      subjectType: 'USER',
      subjectId: targetUser._id,
      category: reasonCode,
    });

    if (existingReport) {
      return {
        success: true,
        reported: true,
        duplicate: true,
        reportId: existingReport._id.toString(),
        message: 'Report already received.',
      };
    }

    const priority = this._calculatePriority(reasonCode);
    const targetProfile = await Profile.findOne({ user: targetUserId });

    const snapshot = await ModerationEvidenceSnapshot.create({
      subjectType: 'USER',
      subjectId: targetUser._id,
      subjectOwnerId: targetUser._id,
      reporterId,
      contentSnapshot: {
        text: targetProfile?.bio || '',
        caption: targetProfile?.displayName || '',
      },
    });

    // Immediate Suppression for User
    await ReporterSuppression.updateOne(
      { reporterId, subjectType: 'USER', subjectId: targetUser._id },
      { $set: { reasonCode, updatedAt: new Date() } },
      { upsert: true }
    );

    let moderationCase = await ModerationCase.findOne({
      subjectType: 'USER',
      subjectId: targetUser._id,
      status: { $in: [ModerationCaseStatuses.OPEN, ModerationCaseStatuses.TRIAGED, ModerationCaseStatuses.IN_REVIEW, ModerationCaseStatuses.ACTION_REQUIRED] },
    });

    if (!moderationCase) {
      moderationCase = await ModerationCase.create({
        caseNumber: `case_${new mongoose.Types.ObjectId().toString()}`,
        subjectType: 'USER',
        subjectId: targetUser._id,
        subjectOwnerId: targetUser._id,
        status: ModerationCaseStatuses.OPEN,
        priority,
        reasonCategories: [reasonCode],
        reportIds: [],
        evidenceSnapshotIds: [snapshot._id],
      });
    }

    const reportDoc = await Report.create({
      reporter: reporterId,
      reportedUser: targetUser._id,
      subjectType: 'USER',
      subjectId: targetUser._id,
      subjectOwnerId: targetUser._id,
      category: reasonCode,
      reasonCode,
      description: (description || '').trim().slice(0, 1000),
      evidenceSnapshotId: snapshot._id,
      moderationCaseId: moderationCase._id,
      priority,
      status: ReportStatuses.PENDING,
    });

    moderationCase.reportIds.push(reportDoc._id);
    await moderationCase.save();

    if (shouldBlock) {
      try {
        await safetyService.blockUser(reporterId, targetUserId);
      } catch (bErr) {}
    }

    return {
      success: true,
      reported: true,
      reportId: reportDoc._id.toString(),
      caseNumber: moderationCase.caseNumber,
      status: 'RECEIVED',
    };
  }

  /**
   * Admin: List Moderation Cases
   */
  async getModerationCases(moderatorId, options = {}) {
    const { status, priority, subjectType, subjectId, limit = 50 } = options;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (subjectType) query.subjectType = subjectType;
    if (subjectId) query.subjectId = subjectId;

    const rawCases = await ModerationCase.find(query)
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .lean();

    const priorityWeights = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    rawCases.sort((a, b) => {
      const wA = priorityWeights[a.priority] || 1;
      const wB = priorityWeights[b.priority] || 1;
      if (wB !== wA) return wB - wA;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return rawCases.map((c) => ({
      caseId: c._id.toString(),
      caseNumber: c.caseNumber,
      subjectType: c.subjectType,
      subjectId: c.subjectId.toString(),
      subjectOwnerId: c.subjectOwnerId.toString(),
      status: c.status,
      priority: c.priority,
      reasonCategories: c.reasonCategories,
      reportsCount: (c.reportIds || []).length,
      assignedModeratorId: c.assignedModeratorId ? c.assignedModeratorId.toString() : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  /**
   * Admin: Get Moderation Case Detail with Evidence
   */
  async getModerationCaseDetail(moderatorId, caseId) {
    const moderationCase = await ModerationCase.findById(caseId).lean();
    if (!moderationCase) {
      const err = new Error('Moderation case not found.');
      err.code = 'CASE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Fetch Evidence Snapshots (exclude reporter ID from public evidence view)
    const snapshots = await ModerationEvidenceSnapshot.find({
      _id: { $in: moderationCase.evidenceSnapshotIds },
    }).lean();

    // Log Evidence Access in Audit Log
    try {
      await ModerationAuditLog.create({
        moderatorId,
        caseId: moderationCase._id,
        action: 'EVIDENCE_ACCESSED',
        subjectType: moderationCase.subjectType,
        subjectId: moderationCase.subjectId,
      });
    } catch (aErr) {}

    return {
      caseId: moderationCase._id.toString(),
      caseNumber: moderationCase.caseNumber,
      subjectType: moderationCase.subjectType,
      subjectId: moderationCase.subjectId.toString(),
      subjectOwnerId: moderationCase.subjectOwnerId.toString(),
      status: moderationCase.status,
      priority: moderationCase.priority,
      reasonCategories: moderationCase.reasonCategories,
      assignedModeratorId: moderationCase.assignedModeratorId ? moderationCase.assignedModeratorId.toString() : null,
      assignmentVersion: moderationCase.assignmentVersion,
      evidenceSnapshots: snapshots.map((s) => ({
        snapshotId: s._id.toString(),
        subjectType: s.subjectType,
        contentSnapshot: s.contentSnapshot,
        checksum: s.checksum,
        createdAt: s.createdAt,
      })),
      automatedAssessments: moderationCase.automatedAssessments || [],
      internalNotes: moderationCase.internalNotes || [],
      createdAt: moderationCase.createdAt,
    };
  }

  /**
   * Admin: Assign Moderation Case
   */
  async assignModerationCase(moderatorId, caseId) {
    const moderationCase = await ModerationCase.findById(caseId);
    if (!moderationCase) {
      const err = new Error('Moderation case not found.');
      err.code = 'CASE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const previousState = {
      assignedModeratorId: moderationCase.assignedModeratorId,
      status: moderationCase.status,
    };

    moderationCase.assignedModeratorId = moderatorId;
    moderationCase.status = ModerationCaseStatuses.IN_REVIEW;
    moderationCase.assignedAt = new Date();
    moderationCase.assignmentVersion = (moderationCase.assignmentVersion || 0) + 1;
    await moderationCase.save();

    await ModerationAuditLog.create({
      moderatorId,
      caseId: moderationCase._id,
      action: 'ASSIGNED',
      subjectType: moderationCase.subjectType,
      subjectId: moderationCase.subjectId,
      previousState,
      newState: { assignedModeratorId: moderatorId, status: moderationCase.status },
    });

    return {
      success: true,
      caseId: moderationCase._id.toString(),
      assignedModeratorId: moderatorId.toString(),
      status: moderationCase.status,
    };
  }

  /**
   * Admin: Apply Moderation Decision
   */
  async applyModerationDecision(moderatorId, caseId, payload = {}) {
    const { decision, decisionReasonCode = 'POLICY_VIOLATION', internalNotes = '' } = payload;

    if (!Object.values(ModerationDecisions).includes(decision)) {
      const err = new Error(`Invalid moderation decision: ${decision}`);
      err.code = 'INVALID_DECISION';
      err.statusCode = 400;
      throw err;
    }

    const moderationCase = await ModerationCase.findById(caseId);
    if (!moderationCase) {
      const err = new Error('Moderation case not found.');
      err.code = 'CASE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const previousState = {
      decision: moderationCase.decision,
      status: moderationCase.status,
    };

    // 1. Update Case
    const isEscalate = decision === 'ESCALATE';
    moderationCase.status = isEscalate ? ModerationCaseStatuses.ESCALATED : ModerationCaseStatuses.RESOLVED;
    moderationCase.decision = decision;
    moderationCase.decisionReasonCode = decisionReasonCode;
    moderationCase.resolvedAt = new Date();
    moderationCase.resolvedBy = moderatorId;

    if (internalNotes) {
      moderationCase.internalNotes.push({
        note: internalNotes,
        moderatorId,
        createdAt: new Date(),
      });
    }

    await moderationCase.save();

    // 2. Apply Subject State Mutation
    if (['POST', 'REEL', 'STORY'].includes(moderationCase.subjectType)) {
      if (['HIDE', 'REJECT', 'REMOVE'].includes(decision)) {
        await Content.updateOne(
          { _id: moderationCase.subjectId },
          {
            $set: {
              moderationStatus: 'REJECTED',
              status: decision === 'HIDE' ? 'HIDDEN' : 'DELETED',
              deletedAt: decision === 'REMOVE' ? new Date() : null,
            },
          }
        );
      } else if (['APPROVE', 'RESTORE'].includes(decision)) {
        await Content.updateOne(
          { _id: moderationCase.subjectId },
          {
            $set: {
              moderationStatus: 'APPROVED',
              status: 'PUBLISHED',
              deletedAt: null,
            },
          }
        );
      }
    } else if (moderationCase.subjectType === 'COMMENT') {
      if (['HIDE', 'REMOVE'].includes(decision)) {
        await Comment.updateOne(
          { _id: moderationCase.subjectId },
          { $set: { status: 'DELETED', deletedAt: new Date() } }
        );
      } else if (['APPROVE', 'RESTORE'].includes(decision)) {
        await Comment.updateOne(
          { _id: moderationCase.subjectId },
          { $set: { status: 'ACTIVE', deletedAt: null } }
        );
      }
    }

    // 3. Mark Attached Reports as RESOLVED
    await Report.updateMany(
      { _id: { $in: moderationCase.reportIds } },
      {
        $set: {
          status: isEscalate ? ReportStatuses.ESCALATED : ReportStatuses.RESOLVED,
          resolvedAt: new Date(),
          resolvedBy: moderatorId,
        },
      }
    );

    // 4. Audit Log
    await ModerationAuditLog.create({
      moderatorId,
      caseId: moderationCase._id,
      action: 'DECISION_APPLIED',
      subjectType: moderationCase.subjectType,
      subjectId: moderationCase.subjectId,
      previousState,
      newState: { decision, status: moderationCase.status },
      reasonCode: decisionReasonCode,
      internalNotes,
    });

    // 5. Emit Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'moderation.decision_applied',
        aggregateType: 'CONTENT',
        aggregateId: moderationCase.subjectId.toString(),
        payload: {
          caseId: moderationCase._id.toString(),
          subjectType: moderationCase.subjectType,
          subjectId: moderationCase.subjectId.toString(),
          decision,
          decisionReasonCode,
        },
        deduplicationKey: `dec_${moderationCase._id}_${Date.now()}`,
      });
    } catch (oErr) {}

    return {
      success: true,
      caseId: moderationCase._id.toString(),
      decision,
      status: moderationCase.status,
    };
  }
}

const socialModerationService = new SocialModerationService();
module.exports = socialModerationService;
