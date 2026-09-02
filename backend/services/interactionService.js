const Content = require('../models/Content');
const ContentLike = require('../models/ContentLike');
const Comment = require('../models/Comment');
const CommentLike = require('../models/CommentLike');
const Save = require('../models/Save');
const ShareEvent = require('../models/ShareEvent');
const NotInterested = require('../models/NotInterested');
const Profile = require('../models/Profile');
const OutboxEvent = require('../models/OutboxEvent');
const Block = require('../models/Block');
const socialPolicyService = require('./socialPolicyService');
const { serializeAuthorSummary, serializeContentForViewer } = require('../utils/contentSerializers');

class InteractionService {
  /**
   * Dating Core: Pass candidate
   */
  async passCandidate(viewerId, data) {
    const { recommendationId, idempotencyKey } = data || {};
    if (!idempotencyKey) {
      const err = new Error('Missing idempotencyKey');
      err.code = 'INVALID_DISCOVERY_ACTION';
      err.statusCode = 400;
      throw err;
    }

    const parts = (recommendationId || '').split('_');
    if (parts.length < 3) {
      const err = new Error('Invalid recommendation ID format');
      err.code = 'INVALID_RECOMMENDATION_ID';
      err.statusCode = 400;
      throw err;
    }

    const candidateId = parts[parts.length - 1];
    const batchId = parts.slice(1, parts.length - 1).join('_');

    const RecommendationBatch = require('../models/RecommendationBatch');
    const batch = await RecommendationBatch.findOne({ batchId });
    if (!batch || batch.viewer.toString() !== viewerId.toString()) {
      const err = new Error('Recommendation batch does not belong to viewer');
      err.code = 'RECOMMENDATION_OWNERSHIP_INVALID';
      err.statusCode = 403;
      throw err;
    }

    const DatingInteraction = require('../models/DatingInteraction');
    let interaction = await DatingInteraction.findOne({
      actor: viewerId,
      target: candidateId,
      type: 'PASS',
    });

    if (!interaction) {
      interaction = await DatingInteraction.create({
        actor: viewerId,
        target: candidateId,
        type: 'PASS',
        status: 'PENDING',
        suppressedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        idempotencyKey,
      });
    } else {
      interaction.status = 'PENDING';
      interaction.undoneAt = null;
      interaction.suppressedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await interaction.save();
    }

    const ProfileImpression = require('../models/ProfileImpression');
    await ProfileImpression.findOneAndUpdate(
      { viewer: viewerId, candidate: candidateId, recommendationBatchId: batchId },
      { viewer: viewerId, candidate: candidateId, recommendationBatchId: batchId },
      { upsert: true, new: true }
    );

    try {
      await OutboxEvent.create({
        eventType: 'profile.passed',
        aggregateType: 'USER',
        aggregateId: viewerId.toString(),
        payload: {
          viewerId: viewerId.toString(),
          candidateId: candidateId.toString(),
          batchId,
        },
        deduplicationKey: `pass_${batchId}_${candidateId}`,
      });
    } catch (e) {}

    const undoToken =
      'undo_' +
      Buffer.from(
        JSON.stringify({
          batchId,
          candidateId,
          viewerId: viewerId.toString(),
          ts: Date.now(),
        })
      ).toString('base64');

    return { passed: true, undoToken };
  }

  /**
   * Dating Core: Remove candidate
   */
  async removeCandidate(viewerId, data) {
    const { recommendationId, idempotencyKey } = data || {};
    if (!idempotencyKey) {
      const err = new Error('Missing idempotencyKey');
      err.code = 'INVALID_DISCOVERY_ACTION';
      err.statusCode = 400;
      throw err;
    }

    const parts = (recommendationId || '').split('_');
    const candidateId = parts[parts.length - 1];
    const batchId = parts.slice(1, parts.length - 1).join('_');

    const DatingInteraction = require('../models/DatingInteraction');
    await DatingInteraction.findOneAndUpdate(
      { actor: viewerId, target: candidateId, type: 'REMOVE' },
      { actor: viewerId, target: candidateId, type: 'REMOVE', status: 'PENDING', idempotencyKey },
      { upsert: true }
    );

    try {
      await OutboxEvent.create({
        eventType: 'profile.removed',
        aggregateType: 'USER',
        aggregateId: viewerId.toString(),
        payload: {
          viewerId: viewerId.toString(),
          candidateId: candidateId.toString(),
          batchId,
        },
        deduplicationKey: `remove_${batchId}_${candidateId}`,
      });
    } catch (e) {}

    return { removed: true };
  }

  /**
   * Dating Core: Undo latest pass
   */
  async undoLatestPass(viewerId, data) {
    const { undoToken, idempotencyKey } = data || {};
    if (!undoToken || !undoToken.startsWith('undo_')) {
      const err = new Error('Invalid undo token');
      err.code = 'UNDO_TOKEN_INVALID';
      err.statusCode = 400;
      throw err;
    }

    let payload;
    try {
      const raw = Buffer.from(undoToken.slice(5), 'base64').toString('utf8');
      payload = JSON.parse(raw);
    } catch (e) {
      const err = new Error('Invalid undo token');
      err.code = 'UNDO_TOKEN_INVALID';
      err.statusCode = 400;
      throw err;
    }

    if (!payload || !payload.candidateId || !payload.batchId) {
      const err = new Error('Invalid undo token structure');
      err.code = 'UNDO_TOKEN_INVALID';
      err.statusCode = 400;
      throw err;
    }

    if (payload.viewerId && payload.viewerId !== viewerId.toString()) {
      const err = new Error('Undo token does not belong to viewer');
      err.code = 'RECOMMENDATION_OWNERSHIP_INVALID';
      err.statusCode = 403;
      throw err;
    }

    const { candidateId, batchId } = payload;

    const RecommendationBatch = require('../models/RecommendationBatch');
    const batch = await RecommendationBatch.findOne({ batchId });
    if (!batch || batch.viewer.toString() !== viewerId.toString()) {
      const err = new Error('Undo token does not belong to viewer');
      err.code = 'RECOMMENDATION_OWNERSHIP_INVALID';
      err.statusCode = 403;
      throw err;
    }

    const DatingInteraction = require('../models/DatingInteraction');
    const passRecord = await DatingInteraction.findOne({
      actor: viewerId,
      target: candidateId,
      type: 'PASS',
      status: { $ne: 'WITHDRAWN' },
    });

    if (!passRecord) {
      const err = new Error('Undo is no longer available');
      err.code = 'UNDO_NOT_AVAILABLE';
      err.statusCode = 400;
      throw err;
    }

    const UserEntitlement = require('../models/UserEntitlement');
    const entitlement = await UserEntitlement.findOne({ user: viewerId });
    const remaining = Math.max(0, (entitlement?.dailyUndoAllowance || 3) - (entitlement?.undoUsedToday || 0) - 1);
    if (entitlement) {
      entitlement.undoUsedToday += 1;
      await entitlement.save();
    }

    passRecord.status = 'WITHDRAWN';
    passRecord.undoneAt = new Date();
    passRecord.suppressedUntil = null;
    await passRecord.save();

    try {
      await OutboxEvent.create({
        eventType: 'profile.pass_undone',
        aggregateType: 'USER',
        aggregateId: viewerId.toString(),
        payload: {
          viewerId: viewerId.toString(),
          candidateId: candidateId.toString(),
          batchId,
        },
        deduplicationKey: `undo_${batchId}_${candidateId}_${Date.now()}`,
      });
    } catch (e) {}

    const DatingProfile = require('../models/DatingProfile');
    const candidateProfile = await DatingProfile.findOne({ user: candidateId });

    return {
      restored: true,
      recommendation: {
        profile: {
          displayName: candidateProfile?.displayName || 'Restored User',
        },
      },
      undoAllowance: {
        remaining,
      },
    };
  }

  /**
   * Like a post
   */
  async likeContent(userId, contentId) {
    const content = await Content.findById(contentId);
    if (!content || content.status === 'DELETED') {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Authorize interaction through central policy
    const policy = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userId,
      contentDoc: content,
      context: 'FUTURE_INTERACTION',
    });

    if (!policy.allowed) {
      const err = new Error('You do not have permission to interact with this content.');
      err.code = policy.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = policy.safeErrorStatus || 404;
      throw err;
    }

    let existingLike = await ContentLike.findOne({ userId, contentId, reactionType: 'LIKE' });
    let isNewActivation = false;

    if (!existingLike) {
      existingLike = await ContentLike.create({
        userId,
        contentId,
        reactionType: 'LIKE',
        status: 'ACTIVE',
      });
      isNewActivation = true;
    } else if (existingLike.status === 'REMOVED') {
      existingLike.status = 'ACTIVE';
      existingLike.removedAt = null;
      await existingLike.save();
      isNewActivation = true;
    }

    if (isNewActivation) {
      const updatedContent = await Content.findByIdAndUpdate(
        contentId,
        { $inc: { likesCount: 1 } },
        { new: true }
      );

      // Emit Outbox Event (exclude self-like notifications)
      if (content.authorId.toString() !== userId.toString()) {
        try {
          await OutboxEvent.create({
            eventType: 'content.liked',
            aggregateType: 'USER',
            aggregateId: content.authorId.toString(),
            payload: {
              contentId: content._id.toString(),
              actorId: userId.toString(),
              likedAt: new Date(),
            },
            deduplicationKey: `like_${contentId}_${userId}`,
          });
        } catch (outboxErr) {
          console.warn('[INTERACTION SERVICE] Outbox warning:', outboxErr.message);
        }
      }

      return { liked: true, likesCount: updatedContent?.likesCount || 1 };
    }

    const currentContent = await Content.findById(contentId);
    return { liked: true, likesCount: currentContent?.likesCount || 0 };
  }

  /**
   * Unlike a post
   */
  async unlikeContent(userId, contentId) {
    const existingLike = await ContentLike.findOne({ userId, contentId, reactionType: 'LIKE' });
    if (!existingLike || existingLike.status === 'REMOVED') {
      const currentContent = await Content.findById(contentId);
      return { liked: false, likesCount: currentContent?.likesCount || 0 };
    }

    existingLike.status = 'REMOVED';
    existingLike.removedAt = new Date();
    await existingLike.save();

    const updatedContent = await Content.findByIdAndUpdate(
      contentId,
      [
        {
          $set: {
            likesCount: { $max: [0, { $subtract: ['$likesCount', 1] }] },
          },
        },
      ],
      { new: true }
    );

    try {
      await OutboxEvent.create({
        eventType: 'content.unliked',
        aggregateType: 'USER',
        aggregateId: userId.toString(),
        payload: {
          contentId: contentId.toString(),
          actorId: userId.toString(),
          unlikedAt: new Date(),
        },
        deduplicationKey: `unlike_${contentId}_${userId}_${Date.now()}`,
      });
    } catch (outboxErr) {
      console.warn('[INTERACTION SERVICE] Outbox warning:', outboxErr.message);
    }

    return { liked: false, likesCount: updatedContent?.likesCount || 0 };
  }

  /**
   * Create a comment or 1-level reply
   */
  async createComment(userId, contentId, data) {
    const { text, parentCommentId, idempotencyKey } = data;

    const sanitizedText = typeof text === 'string' ? text.trim() : '';
    if (!sanitizedText || sanitizedText.length === 0) {
      const err = new Error('Comment text cannot be empty.');
      err.code = 'EMPTY_COMMENT_TEXT';
      err.statusCode = 400;
      throw err;
    }

    if (sanitizedText.length > 1000) {
      const err = new Error('Comment text exceeds maximum permitted length of 1000 characters.');
      err.code = 'COMMENT_TOO_LONG';
      err.statusCode = 400;
      throw err;
    }

    // Check Idempotency
    if (idempotencyKey) {
      const existing = await Comment.findOne({ authorId: userId, idempotencyKey });
      if (existing) {
        const authorProfile = await Profile.findOne({ user: userId });
        return this._formatCommentProjection(existing, authorProfile);
      }
    }

    const content = await Content.findById(contentId);
    if (!content || content.status === 'DELETED') {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const policy = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userId,
      contentDoc: content,
      context: 'FUTURE_INTERACTION',
    });

    if (!policy.allowed) {
      const err = new Error('You do not have permission to comment on this content.');
      err.code = policy.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = policy.safeErrorStatus || 404;
      throw err;
    }

    let depth = 0;
    let rootCommentId = null;

    if (parentCommentId) {
      const parent = await Comment.findById(parentCommentId);
      if (!parent || parent.status === 'DELETED') {
        const err = new Error('Parent comment not found.');
        err.code = 'PARENT_COMMENT_NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      if (parent.contentId.toString() !== contentId.toString()) {
        const err = new Error('Parent comment does not belong to this content.');
        err.code = 'INVALID_PARENT_COMMENT';
        err.statusCode = 400;
        throw err;
      }

      if (parent.depth >= 1) {
        const err = new Error('Replies are limited to a maximum depth of 1 level.');
        err.code = 'MAX_REPLY_DEPTH_EXCEEDED';
        err.statusCode = 400;
        throw err;
      }

      depth = 1;
      rootCommentId = parent._id;

      // Increment replies count on parent
      await Comment.findByIdAndUpdate(parent._id, { $inc: { repliesCount: 1 } });
    }

    const comment = await Comment.create({
      contentId,
      authorId: userId,
      parentCommentId: parentCommentId || null,
      rootCommentId,
      depth,
      text: sanitizedText,
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      idempotencyKey,
    });

    // Increment commentsCount on Content
    await Content.findByIdAndUpdate(contentId, { $inc: { commentsCount: 1 } });

    // Emit Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'comment.created',
        aggregateType: 'USER',
        aggregateId: content.authorId.toString(),
        payload: {
          commentId: comment._id.toString(),
          contentId: content._id.toString(),
          authorId: userId.toString(),
          parentCommentId: parentCommentId ? parentCommentId.toString() : null,
          createdAt: comment.createdAt,
        },
        deduplicationKey: `comment_${comment._id}`,
      });
    } catch (outboxErr) {
      console.warn('[INTERACTION SERVICE] Outbox warning:', outboxErr.message);
    }

    const authorProfile = await Profile.findOne({ user: userId });
    return this._formatCommentProjection(comment, authorProfile);
  }

  /**
   * Get top-level comments for a post with cursor pagination
   */
  async getComments(viewerId, contentId, { cursor, limit = 20 } = {}) {
    const content = await Content.findById(contentId);
    if (!content || content.status === 'DELETED') {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const policy = await socialPolicyService.evaluateSocialContentAccess({
      viewerId,
      contentDoc: content,
      context: 'CONTENT_DETAIL',
    });

    if (!policy.allowed) {
      const err = new Error('You do not have permission to view comments on this content.');
      err.code = policy.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = policy.safeErrorStatus || 404;
      throw err;
    }

    // Collect blocks if viewer exists
    let blockedAuthorIds = [];
    if (viewerId) {
      const blocks = await Block.find({
        $or: [{ blocker: viewerId }, { blocked: viewerId }],
      });
      blockedAuthorIds = blocks.map((b) =>
        b.blocker.toString() === viewerId.toString() ? b.blocked : b.blocker
      );
    }

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const query = {
      contentId,
      parentCommentId: null,
      authorId: { $nin: blockedAuthorIds },
      status: { $in: ['ACTIVE', 'DELETED'] }, // Include tombstones if replies exist
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.createdAt = { $gt: cursorDate };
      }
    }

    const comments = await Comment.find(query)
      .sort({ createdAt: 1, _id: 1 })
      .limit(maxLimit + 1);

    const hasMore = comments.length > maxLimit;
    const pageItems = hasMore ? comments.slice(0, maxLimit) : comments;

    // Batch pre-fetch author profiles
    const authorIds = Array.from(new Set(pageItems.map((c) => c.authorId.toString())));
    const profiles = await Profile.find({ user: { $in: authorIds } });
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    const items = pageItems.map((c) => this._formatCommentProjection(c, profileMap.get(c.authorId.toString())));

    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(lastItem.createdAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * Get replies for a specific top-level comment
   */
  async getCommentReplies(viewerId, commentId, { cursor, limit = 20 } = {}) {
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      const err = new Error('Comment not found.');
      err.code = 'COMMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const content = await Content.findById(parentComment.contentId);
    if (!content || content.status === 'DELETED') {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const policy = await socialPolicyService.evaluateSocialContentAccess({
      viewerId,
      contentDoc: content,
      context: 'CONTENT_DETAIL',
    });

    if (!policy.allowed) {
      const err = new Error('You do not have permission to view replies on this content.');
      err.code = policy.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = policy.safeErrorStatus || 404;
      throw err;
    }

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const query = {
      parentCommentId: commentId,
      status: 'ACTIVE',
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.createdAt = { $gt: cursorDate };
      }
    }

    const replies = await Comment.find(query)
      .sort({ createdAt: 1, _id: 1 })
      .limit(maxLimit + 1);

    const hasMore = replies.length > maxLimit;
    const pageItems = hasMore ? replies.slice(0, maxLimit) : replies;

    const authorIds = Array.from(new Set(pageItems.map((r) => r.authorId.toString())));
    const profiles = await Profile.find({ user: { $in: authorIds } });
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    const items = pageItems.map((r) => this._formatCommentProjection(r, profileMap.get(r.authorId.toString())));

    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(lastItem.createdAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * Delete a comment (Author, Content Owner, or Moderator)
   */
  async deleteComment(userId, commentId) {
    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === 'DELETED') {
      return { deleted: true, commentId };
    }

    const content = await Content.findById(comment.contentId);
    const isCommentAuthor = comment.authorId.toString() === userId.toString();
    const isContentOwner = content && content.authorId.toString() === userId.toString();

    if (!isCommentAuthor && !isContentOwner) {
      const err = new Error('You do not have permission to delete this comment.');
      err.code = 'COMMENT_DELETE_FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    const now = new Date();

    // If comment has replies, keep as tombstone so reply thread remains intact
    if (comment.repliesCount > 0) {
      comment.status = 'DELETED';
      comment.text = '[deleted]';
      comment.deletedAt = now;
      await comment.save();
    } else {
      comment.status = 'DELETED';
      comment.deletedAt = now;
      await comment.save();
    }

    // Decrement Content.commentsCount
    await Content.findByIdAndUpdate(comment.contentId, [
      { $set: { commentsCount: { $max: [0, { $subtract: ['$commentsCount', 1] }] } } },
    ]);

    // If reply, decrement parent comment's repliesCount
    if (comment.parentCommentId) {
      await Comment.findByIdAndUpdate(comment.parentCommentId, [
        { $set: { repliesCount: { $max: [0, { $subtract: ['$repliesCount', 1] }] } } },
      ]);
    }

    try {
      await OutboxEvent.create({
        eventType: 'comment.deleted',
        aggregateType: 'USER',
        aggregateId: userId.toString(),
        payload: {
          commentId: comment._id.toString(),
          contentId: comment.contentId.toString(),
          deletedAt: now,
        },
        deduplicationKey: `del_comment_${comment._id}`,
      });
    } catch (outboxErr) {
      console.warn('[INTERACTION SERVICE] Outbox warning:', outboxErr.message);
    }

    return { deleted: true, commentId };
  }

  /**
   * Like a comment
   */
  async likeComment(userId, commentId) {
    const comment = await Comment.findById(commentId);
    if (!comment || comment.status === 'DELETED') {
      const err = new Error('Comment not found.');
      err.code = 'COMMENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    let existing = await CommentLike.findOne({ userId, commentId });
    let isNew = false;

    if (!existing) {
      existing = await CommentLike.create({ userId, commentId, status: 'ACTIVE' });
      isNew = true;
    } else if (existing.status === 'REMOVED') {
      existing.status = 'ACTIVE';
      existing.removedAt = null;
      await existing.save();
      isNew = true;
    }

    if (isNew) {
      const updated = await Comment.findByIdAndUpdate(commentId, { $inc: { likesCount: 1 } }, { new: true });
      return { liked: true, likesCount: updated?.likesCount || 1 };
    }

    const current = await Comment.findById(commentId);
    return { liked: true, likesCount: current?.likesCount || 0 };
  }

  /**
   * Unlike a comment
   */
  async unlikeComment(userId, commentId) {
    const existing = await CommentLike.findOne({ userId, commentId });
    if (!existing || existing.status === 'REMOVED') {
      const current = await Comment.findById(commentId);
      return { liked: false, likesCount: current?.likesCount || 0 };
    }

    existing.status = 'REMOVED';
    existing.removedAt = new Date();
    await existing.save();

    const updated = await Comment.findByIdAndUpdate(
      commentId,
      [{ $set: { likesCount: { $max: [0, { $subtract: ['$likesCount', 1] }] } } }],
      { new: true }
    );

    return { liked: false, likesCount: updated?.likesCount || 0 };
  }

  /**
   * Save a post privately
   */
  async saveContent(userId, contentId) {
    const content = await Content.findById(contentId);
    if (!content || content.status === 'DELETED') {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const policy = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userId,
      contentDoc: content,
      context: 'FUTURE_INTERACTION',
    });

    if (!policy.allowed) {
      const err = new Error('You do not have permission to save this content.');
      err.code = policy.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = policy.safeErrorStatus || 404;
      throw err;
    }

    let existingSave = await Save.findOne({ userId, contentId });
    let isNew = false;

    if (!existingSave) {
      existingSave = await Save.create({ userId, contentId, status: 'ACTIVE' });
      isNew = true;
    } else if (existingSave.status === 'REMOVED') {
      existingSave.status = 'ACTIVE';
      existingSave.removedAt = null;
      await existingSave.save();
      isNew = true;
    }

    if (isNew) {
      await Content.findByIdAndUpdate(contentId, { $inc: { savesCount: 1 } });
    }

    return { saved: true, contentId };
  }

  /**
   * Unsave a post
   */
  async unsaveContent(userId, contentId) {
    const existingSave = await Save.findOne({ userId, contentId });
    if (!existingSave || existingSave.status === 'REMOVED') {
      return { saved: false, contentId };
    }

    existingSave.status = 'REMOVED';
    existingSave.removedAt = new Date();
    await existingSave.save();

    await Content.findByIdAndUpdate(contentId, [
      { $set: { savesCount: { $max: [0, { $subtract: ['$savesCount', 1] }] } } },
    ]);

    return { saved: false, contentId };
  }

  /**
   * Get user's private saved content list with dynamic re-authorization
   */
  async getSavedContent(userId, { cursor, limit = 20 } = {}) {
    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const query = {
      userId,
      status: 'ACTIVE',
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.createdAt = { $lt: cursorDate };
      }
    }

    const saves = await Save.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(maxLimit + 1);

    const hasMore = saves.length > maxLimit;
    const pageSaves = hasMore ? saves.slice(0, maxLimit) : saves;

    const contentIds = pageSaves.map((s) => s.contentId);
    const contentDocs = await Content.find({ _id: { $in: contentIds } });
    const contentMap = new Map(contentDocs.map((c) => [c._id.toString(), c]));

    // Batch evaluate visibility for saved content at read time
    const evaluatedBatch = await socialPolicyService.batchEvaluateContentAccess({
      viewerId: userId,
      contentDocs: Array.from(contentMap.values()),
      context: 'CONTENT_DETAIL',
    });

    const allowedContentIds = new Set(
      evaluatedBatch.filter((ev) => ev.allowed).map((ev) => ev.contentDoc._id.toString())
    );

    // Pre-fetch author profiles for allowed contents
    const authorIds = Array.from(
      new Set(
        evaluatedBatch
          .filter((ev) => ev.allowed)
          .map((ev) => ev.contentDoc.authorId?.toString())
          .filter(Boolean)
      )
    );
    const profiles = await Profile.find({ user: { $in: authorIds } });
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    const items = pageSaves
      .filter((s) => allowedContentIds.has(s.contentId.toString()))
      .map((s) => {
        const doc = contentMap.get(s.contentId.toString());
        return serializeContentForViewer(doc, profileMap.get(doc.authorId.toString()), 'PUBLIC');
      });

    let nextCursor = null;
    if (hasMore && pageSaves.length > 0) {
      const lastSave = pageSaves[pageSaves.length - 1];
      nextCursor = Buffer.from(lastSave.createdAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * Record a share event
   */
  async recordShare(userId, contentId, data) {
    const { destinationType, destinationId, idempotencyKey } = data;

    const validDestinations = ['COPY_LINK', 'EXTERNAL', 'INTERNAL_CONVERSATION', 'STORY'];
    if (!destinationType || !validDestinations.includes(destinationType)) {
      const err = new Error('Invalid or missing destinationType.');
      err.code = 'INVALID_DESTINATION_TYPE';
      err.statusCode = 400;
      throw err;
    }

    const content = await Content.findById(contentId);
    if (!content || content.status === 'DELETED') {
      const err = new Error('Content not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const policy = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userId,
      contentDoc: content,
      context: 'FUTURE_INTERACTION',
    });

    if (!policy.allowed) {
      const err = new Error('You do not have permission to share this content.');
      err.code = policy.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = policy.safeErrorStatus || 404;
      throw err;
    }

    const share = await ShareEvent.create({
      userId,
      contentId,
      destinationType,
      destinationId: destinationId || null,
      idempotencyKey,
    });

    const updated = await Content.findByIdAndUpdate(
      contentId,
      { $inc: { sharesCount: 1 } },
      { new: true }
    );

    try {
      await OutboxEvent.create({
        eventType: 'content.shared',
        aggregateType: 'USER',
        aggregateId: content.authorId.toString(),
        payload: {
          shareId: share._id.toString(),
          contentId: content._id.toString(),
          userId: userId.toString(),
          destinationType,
        },
        deduplicationKey: `share_${share._id}`,
      });
    } catch (outboxErr) {
      console.warn('[INTERACTION SERVICE] Outbox warning:', outboxErr.message);
    }

    return { shared: true, sharesCount: updated?.sharesCount || 1 };
  }

  /**
   * Mark content as not interested
   */
  async markNotInterested(userId, contentId) {
    await NotInterested.findOneAndUpdate(
      { userId, contentId },
      { userId, contentId },
      { upsert: true, new: true }
    );
    return { notInterested: true, contentId };
  }

  /**
   * Unmark not interested
   */
  async unmarkNotInterested(userId, contentId) {
    await NotInterested.deleteOne({ userId, contentId });
    return { notInterested: false, contentId };
  }

  _formatCommentProjection(comment, authorProfile = null) {
    return {
      commentId: comment._id.toString(),
      contentId: comment.contentId.toString(),
      author: serializeAuthorSummary(authorProfile),
      parentCommentId: comment.parentCommentId ? comment.parentCommentId.toString() : null,
      depth: comment.depth,
      text: comment.status === 'DELETED' ? '[deleted]' : comment.text,
      status: comment.status,
      repliesCount: comment.repliesCount || 0,
      likesCount: comment.likesCount || 0,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
    };
  }
}

const interactionService = new InteractionService();

module.exports = interactionService;
