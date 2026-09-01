const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingInteraction = require('../models/DatingInteraction');
const RecommendationBatch = require('../models/RecommendationBatch');
const ProfileImpression = require('../models/ProfileImpression');
const UserEntitlement = require('../models/UserEntitlement');
const OutboxEvent = require('../models/OutboxEvent');
const Match = require('../models/Match');
const Block = require('../models/Block');
const { evaluateCandidate, HardExclusionReasons } = require('./eligibilityPolicy');
const datingConfig = require('../config/datingConfig');

class LikeServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'LikeServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validate Recommendation and resolve Candidate ID
 */
async function validateRecommendation(viewerId, recommendationId) {
  if (!recommendationId || typeof recommendationId !== 'string') {
    throw new LikeServiceError('INVALID_LIKE_REQUEST', 'recommendationId is required', 400);
  }

  const lastUnderscoreIndex = recommendationId.lastIndexOf('_');
  const candidateId = lastUnderscoreIndex !== -1 ? recommendationId.substring(lastUnderscoreIndex + 1) : null;

  const prefixRemoved = recommendationId.startsWith('rec_') ? recommendationId.substring(4) : recommendationId;
  const batchId = prefixRemoved.substring(0, prefixRemoved.lastIndexOf('_'));

  if (!candidateId || !batchId) {
    throw new LikeServiceError('RECOMMENDATION_NOT_FOUND', 'Recommendation ID format is invalid', 400);
  }

  const batch = await RecommendationBatch.findOne({ batchId });
  if (!batch) {
    throw new LikeServiceError('RECOMMENDATION_NOT_FOUND', 'Recommendation batch was not found', 404);
  }

  if (batch.viewer.toString() !== viewerId.toString()) {
    throw new LikeServiceError('RECOMMENDATION_OWNERSHIP_INVALID', 'Recommendation does not belong to user', 403);
  }

  const batchCandidates = (batch.candidates && batch.candidates.length > 0 ? batch.candidates : batch.candidateIds || []).map(
    (c) => c.toString()
  );

  if (!batchCandidates.includes(candidateId)) {
    throw new LikeServiceError('RECOMMENDATION_NOT_FOUND', 'Candidate is not part of this recommendation batch', 404);
  }

  return { batchId, candidateId };
}

/**
 * Reconcile Profile Impression if not already recorded
 */
async function reconcileImpression(viewerId, candidateId, batchId, recommendationId) {
  try {
    const existing = await ProfileImpression.findOne({ viewer: viewerId, candidate: candidateId, recommendationBatchId: batchId });
    if (!existing) {
      await ProfileImpression.create({
        viewer: viewerId,
        candidate: candidateId,
        recommendationId,
        recommendationBatchId: batchId,
        position: 0,
        visibleAt: new Date(),
        visibleDurationMs: 500,
      });
    }
  } catch (err) {
    // Ignore duplicate key race condition safely
  }
}

/**
 * Send Like, Comment, Rose or Priority Like to a Candidate
 */
async function createLike(viewerId, data = {}) {
  if (!viewerId) {
    throw new LikeServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(viewerId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
    throw new LikeServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active or is suspended', 403);
  }

  const { recommendationId, type = 'LIKE', targetElement, comment, idempotencyKey } = data;

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new LikeServiceError('INVALID_LIKE_REQUEST', 'idempotencyKey is required', 400);
  }

  const validTypes = ['LIKE', 'ROSE', 'PRIORITY_LIKE'];
  if (!validTypes.includes(type)) {
    throw new LikeServiceError('INVALID_LIKE_REQUEST', `Invalid type: ${type}. Must be one of ${validTypes.join(', ')}`, 400);
  }

  // 1. Idempotency Check
  const existingInteraction = await DatingInteraction.findOne({ idempotencyKey });
  if (existingInteraction) {
    const entitlement = await UserEntitlement.findOne({ user: viewerId });
    const remainingLikes = entitlement
      ? entitlement.hasUnlimitedLikes
        ? 999
        : Math.max(0, (entitlement.dailyFreeLikesLimit || 25) - (entitlement.likesUsedToday || 0))
      : 25;

    return {
      like: {
        id: existingInteraction._id.toString(),
        type: existingInteraction.type,
        status: existingInteraction.status,
        createdAt: existingInteraction.createdAt,
      },
      allowance: {
        remainingLikes,
        remainingRoses: entitlement ? entitlement.rosesBalance : 0,
        resetsAt: entitlement ? entitlement.likesResetsAt : new Date(),
      },
      mutualInterestPending: false,
    };
  }

  // 2. Validate Recommendation & Candidate
  const { batchId, candidateId } = await validateRecommendation(viewerId, recommendationId);

  if (candidateId === viewerId.toString()) {
    throw new LikeServiceError('INVALID_LIKE_REQUEST', 'Cannot like yourself', 400);
  }

  // 3. Write-Time Candidate Eligibility Revalidation
  const eligibility = await evaluateCandidate(viewerId, candidateId);
  const criticalExclusions = eligibility.hardExclusions.filter(
    (e) => e !== HardExclusionReasons.RECENTLY_SHOWN && e !== HardExclusionReasons.PENDING_OUTGOING_LIKE
  );
  if (criticalExclusions.length > 0) {
    throw new LikeServiceError('CANDIDATE_NOT_AVAILABLE', 'Candidate is no longer available', 409, {
      exclusions: criticalExclusions,
    });
  }

  // 4. Check Existing Conflict Interactions
  const existingOutgoing = await DatingInteraction.findOne({
    actor: viewerId,
    target: candidateId,
    status: { $in: ['PENDING', 'ACCEPTED'] },
  });

  if (existingOutgoing) {
    if (existingOutgoing.type === 'PASS') {
      throw new LikeServiceError('INTERACTION_CONFLICT', 'You previously passed on this candidate. Undo the pass first.', 409);
    }
    if (existingOutgoing.type === 'REMOVE') {
      throw new LikeServiceError('INTERACTION_CONFLICT', 'You previously removed this candidate from discovery.', 409);
    }
    if (existingOutgoing.type === 'LIKE' || existingOutgoing.type === 'ROSE' || existingOutgoing.type === 'PRIORITY_LIKE') {
      throw new LikeServiceError('LIKE_ALREADY_EXISTS', 'You have already sent a like to this candidate', 409);
    }
  }

  // 5. Validate Target Element if specified
  let elementPayload = {
    elementType: 'PROFILE',
    elementId: '',
    contentSnapshot: '',
  };

  if (targetElement && typeof targetElement === 'object') {
    const { type: elType, id: elId } = targetElement;
    if (elType && ['PHOTO', 'PROMPT', 'BIO', 'PROFILE'].includes(elType)) {
      elementPayload.elementType = elType;
      elementPayload.elementId = elId ? String(elId) : '';
    }
  }

  // 6. Validate & Sanitize Comment
  let sanitizedComment = '';
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      throw new LikeServiceError('LIKE_COMMENT_INVALID', 'Comment must be a text string', 400);
    }
    const maxLen = datingConfig.limits.maxLikeCommentLength || 280;
    const trimmed = comment.trim();
    if (trimmed.length > maxLen) {
      throw new LikeServiceError('LIKE_COMMENT_INVALID', `Comment exceeds maximum length of ${maxLen} characters`, 400);
    }
    // Disallow control characters
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(trimmed)) {
      throw new LikeServiceError('LIKE_COMMENT_INVALID', 'Comment contains invalid control characters', 400);
    }
    sanitizedComment = trimmed;
  }

  // 7. Check & Consume Entitlement / Daily Quota
  let entitlement = await UserEntitlement.findOne({ user: viewerId });
  if (!entitlement) {
    entitlement = await UserEntitlement.create({
      user: viewerId,
      dailyFreeLikesLimit: 25,
      likesUsedToday: 0,
      rosesBalance: 1,
      priorityLikesBalance: 0,
    });
  }

  const now = Date.now();
  if (new Date(entitlement.likesResetsAt).getTime() < now) {
    entitlement.likesUsedToday = 0;
    entitlement.likesResetsAt = new Date(now + 24 * 60 * 60 * 1000);
  }

  const isUnlimited = entitlement.hasUnlimitedLikes || (entitlement.premiumTier && entitlement.premiumTier !== 'FREE');

  if (type === 'LIKE') {
    if (!isUnlimited && entitlement.likesUsedToday >= entitlement.dailyFreeLikesLimit) {
      throw new LikeServiceError('LIKE_LIMIT_REACHED', 'Daily free like limit reached', 403, {
        resetsAt: entitlement.likesResetsAt,
      });
    }
    if (!isUnlimited) {
      entitlement.likesUsedToday += 1;
    }
  } else if (type === 'ROSE') {
    if (entitlement.rosesBalance <= 0) {
      throw new LikeServiceError('ROSE_NOT_AVAILABLE', 'You do not have any roses remaining', 403);
    }
    entitlement.rosesBalance -= 1;
  } else if (type === 'PRIORITY_LIKE') {
    if (entitlement.priorityLikesBalance <= 0 && !isUnlimited) {
      throw new LikeServiceError('PRIORITY_LIKE_ENTITLEMENT_REQUIRED', 'Priority Like requires active premium entitlement', 403);
    }
    if (entitlement.priorityLikesBalance > 0) {
      entitlement.priorityLikesBalance -= 1;
    }
  }

  await entitlement.save();

  // 8. Check for Reciprocal Pending Like (CRITICAL LIMITATION: DO NOT CREATE MATCH YET)
  const reciprocalLike = await DatingInteraction.findOne({
    actor: candidateId,
    target: viewerId,
    type: { $in: ['LIKE', 'ROSE', 'PRIORITY_LIKE'] },
    status: 'PENDING',
  });

  const mutualInterestPending = !!reciprocalLike;

  // 9. Persist DatingInteraction
  const expirationDays = datingConfig.limits.likeExpirationDays || 14;
  const expiredAt = new Date(now + expirationDays * 24 * 60 * 60 * 1000);

  const likeDoc = await DatingInteraction.create({
    actor: viewerId,
    target: candidateId,
    type,
    status: 'PENDING',
    targetElement: elementPayload,
    comment: sanitizedComment,
    recommendationId,
    batchId,
    idempotencyKey,
    expiredAt,
  });

  // 10. Reconcile Impression
  await reconcileImpression(viewerId, candidateId, batchId, recommendationId);

  // 11. If reciprocal like exists, atomically create Match and Conversation (Prompt 11)
  let matchData = null;
  let conversationData = null;

  if (reciprocalLike) {
    const matchService = require('./matchService');
    const matchResult = await matchService.createReciprocalMatch(viewerId, candidateId, likeDoc, reciprocalLike);
    matchData = matchResult.match;
    conversationData = matchResult.conversation;
  } else {
    // Record regular like.created Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'like.created',
        aggregateType: 'INTERACTION',
        aggregateId: likeDoc._id.toString(),
        payload: {
          likeId: likeDoc._id.toString(),
          senderId: viewerId.toString(),
          recipientId: candidateId,
          type,
          recommendationId,
          targetElementType: elementPayload.elementType,
          createdAt: likeDoc.createdAt,
        },
        deduplicationKey: `like_${viewerId}_${candidateId}_${likeDoc._id}`,
      });
    } catch (err) {
      console.warn('[LIKE SERVICE] Outbox recording warning:', err.message);
    }
  }

  const remainingLikes = isUnlimited ? 999 : Math.max(0, entitlement.dailyFreeLikesLimit - entitlement.likesUsedToday);

  return {
    like: {
      id: likeDoc._id.toString(),
      type: likeDoc.type,
      status: likeDoc.status,
      createdAt: likeDoc.createdAt,
    },
    allowance: {
      remainingLikes,
      remainingRoses: entitlement.rosesBalance,
      resetsAt: entitlement.likesResetsAt,
    },
    mutualInterestPending,
    match: matchData,
    conversation: conversationData,
  };
}

/**
 * Withdraw a pending sent like
 */
async function withdrawLike(viewerId, likeId) {
  if (!viewerId) {
    throw new LikeServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const likeDoc = await DatingInteraction.findOne({
    _id: likeId,
    actor: viewerId,
    type: { $in: ['LIKE', 'ROSE', 'PRIORITY_LIKE'] },
    status: 'PENDING',
  });

  if (!likeDoc) {
    throw new LikeServiceError('LIKE_NOT_FOUND', 'Pending like was not found or is no longer pending', 404);
  }

  likeDoc.status = 'WITHDRAWN';
  likeDoc.withdrawnAt = new Date();
  await likeDoc.save();

  try {
    await OutboxEvent.create({
      eventType: 'like.withdrawn',
      aggregateType: 'INTERACTION',
      aggregateId: likeDoc._id.toString(),
      payload: {
        likeId: likeDoc._id.toString(),
        senderId: viewerId.toString(),
        recipientId: likeDoc.target.toString(),
        withdrawnAt: likeDoc.withdrawnAt,
      },
      deduplicationKey: `withdrawn_${viewerId}_${likeDoc._id}`,
    });
  } catch (err) {
    console.warn('[LIKE SERVICE] Outbox warning:', err.message);
  }

  return {
    withdrawn: true,
  };
}

module.exports = {
  createLike,
  withdrawLike,
  LikeServiceError,
};
