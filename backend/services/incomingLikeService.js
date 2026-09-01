const crypto = require('crypto');
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const DatingInteraction = require('../models/DatingInteraction');
const UserLocation = require('../models/UserLocation');
const Block = require('../models/Block');
const Match = require('../models/Match');
const OutboxEvent = require('../models/OutboxEvent');
const { formatDistanceLabel, calculateHaversineDistance } = require('./locationService');
const datingConfig = require('../config/datingConfig');

class IncomingLikeServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'IncomingLikeServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Sign an opaque cursor for Incoming Likes pagination
 */
function createLikesCursor(payload) {
  const secret = process.env.JWT_SECRET || 'rubaru_likes_cursor_secret_2026';
  const dataString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  return `cur_${dataString}.${signature}`;
}

/**
 * Verify and decode an opaque cursor
 */
function verifyLikesCursor(cursorString, currentRecipientId) {
  if (!cursorString || typeof cursorString !== 'string' || !cursorString.startsWith('cur_')) {
    throw new IncomingLikeServiceError('INVALID_LIKES_CURSOR', 'Cursor format is invalid', 400);
  }

  const raw = cursorString.substring(4);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new IncomingLikeServiceError('INVALID_LIKES_CURSOR', 'Cursor structure is malformed', 400);
  }

  const [dataString, signature] = parts;
  const secret = process.env.JWT_SECRET || 'rubaru_likes_cursor_secret_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');

  if (signature !== expectedSig) {
    throw new IncomingLikeServiceError('INVALID_LIKES_CURSOR', 'Cursor signature verification failed', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
  } catch (err) {
    throw new IncomingLikeServiceError('INVALID_LIKES_CURSOR', 'Cursor payload cannot be decoded', 400);
  }

  if (payload.recipientId !== currentRecipientId.toString()) {
    throw new IncomingLikeServiceError('INVALID_LIKES_CURSOR', 'Cursor does not belong to authenticated user', 403);
  }

  if (payload.exp && Date.now() > payload.exp) {
    throw new IncomingLikeServiceError('LIKES_CURSOR_EXPIRED', 'Cursor has expired', 410);
  }

  return payload;
}

/**
 * Hydrate a safe Sender Public DTO
 */
function hydrateSenderDto(senderProfile, senderUser, distanceMeters) {
  if (!senderProfile) return null;

  const distanceKm = distanceMeters !== null && distanceMeters !== undefined ? Math.round(distanceMeters / 1000) : null;
  const distanceLabel = formatDistanceLabel(distanceKm);

  return {
    userId: senderProfile.user ? senderProfile.user.toString() : '',
    displayName: senderProfile.displayName || 'Rubaru User',
    age: senderProfile.age || 24,
    distanceLabel,
    bio: senderProfile.bio || '',
    avatarUri: senderProfile.avatarUri || '',
    photos: Array.isArray(senderProfile.photos) ? senderProfile.photos : [],
    prompts: Array.isArray(senderProfile.prompts) ? senderProfile.prompts : [],
    interests: Array.isArray(senderProfile.interests) ? senderProfile.interests : [],
    datingIntention: senderProfile.datingIntention || 'NOT_SURE',
    relationshipType: senderProfile.relationshipType || 'MONOGAMOUS',
    heightCm: senderProfile.heightCm || null,
    work: senderProfile.work || '',
    education: senderProfile.education || '',
    completenessScore: senderProfile.completenessScore || 80,
    isVerified: senderUser ? Boolean(senderUser.isAgeVerified) : false,
  };
}

/**
 * Query incoming pending likes with priority sorting and cursor pagination
 */
async function getIncomingLikes(recipientId, options = {}) {
  if (!recipientId) {
    throw new IncomingLikeServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(recipientId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
    throw new IncomingLikeServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active or is suspended', 403);
  }

  const { cursor, sort = 'RECENT' } = options;
  const limit = Math.min(20, Math.max(1, parseInt(options.limit, 10) || 10));

  let offset = 0;
  if (cursor) {
    const decoded = verifyLikesCursor(cursor, recipientId);
    offset = decoded.offset || 0;
  }

  // 1. Fetch active recipient location and profile for distance & target element preview
  const [recipientLoc, recipientProfile] = await Promise.all([
    UserLocation.findOne({ user: recipientId }),
    DatingProfile.findOne({ user: recipientId }),
  ]);

  // 2. Fetch pending incoming likes (Query indexed target: recipientId, status: PENDING)
  const now = new Date();
  const rawLikes = await DatingInteraction.find({
    target: recipientId,
    type: { $in: ['LIKE', 'ROSE', 'PRIORITY_LIKE'] },
    status: 'PENDING',
    $or: [{ expiredAt: { $exists: false } }, { expiredAt: { $gt: now } }],
  })
    .sort({ createdAt: -1 })
    .lean();

  if (rawLikes.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  const senderIds = rawLikes.map((l) => l.actor.toString());

  // 3. Batch load senders, profiles, locations, blocks, and matches (2-3 roundtrips, zero N+1)
  const [senders, senderProfiles, senderLocs, blocks, matches] = await Promise.all([
    User.find({ _id: { $in: senderIds }, accountStatus: 'ACTIVE' }).lean(),
    DatingProfile.find({ user: { $in: senderIds }, isDiscoverable: true }).lean(),
    UserLocation.find({ user: { $in: senderIds } }).lean(),
    Block.find({
      $or: [
        { blocker: recipientId, blocked: { $in: senderIds } },
        { blocker: { $in: senderIds }, blocked: recipientId },
      ],
    }).lean(),
    Match.find({
      users: recipientId,
      $or: senderIds.map((sid) => ({ users: sid })),
    }).lean(),
  ]);

  const activeUserSet = new Set(senders.map((u) => u._id.toString()));
  const profileMap = new Map(senderProfiles.map((p) => [p.user.toString(), p]));
  const locMap = new Map(senderLocs.map((l) => [l.user.toString(), l]));

  const blockedSet = new Set();
  for (const b of blocks) {
    blockedSet.add(b.blocker.toString() === recipientId.toString() ? b.blocked.toString() : b.blocker.toString());
  }

  const matchedSet = new Set();
  for (const m of matches) {
    for (const u of m.users) {
      if (u.toString() !== recipientId.toString()) {
        matchedSet.add(u.toString());
      }
    }
  }

  // 4. Filter out ineligible senders (blocked, matched, deleted, hidden)
  const validLikes = rawLikes.filter((like) => {
    const sId = like.actor.toString();
    return activeUserSet.has(sId) && profileMap.has(sId) && !blockedSet.has(sId) && !matchedSet.has(sId);
  });

  // 5. Sort Likes: Rose & Priority Like first, then sorting mode
  validLikes.sort((a, b) => {
    const priorityWeight = (item) => {
      if (item.type === 'ROSE') return 3;
      if (item.type === 'PRIORITY_LIKE') return 2;
      return 1;
    };

    const pA = priorityWeight(a);
    const pB = priorityWeight(b);
    if (pA !== pB) {
      return pB - pA; // Higher priority first
    }

    // Secondary: Creation time DESC
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // 6. Slice page
  const pageItems = validLikes.slice(offset, offset + limit);
  const hasMore = offset + limit < validLikes.length;

  const nextCursor = hasMore
    ? createLikesCursor({
        recipientId: recipientId.toString(),
        sort,
        offset: offset + limit,
        exp: Date.now() + 3600000,
      })
    : null;

  // 7. Format public DTOs
  const items = pageItems.map((like) => {
    const sId = like.actor.toString();
    const sProfile = profileMap.get(sId);
    const sUser = senders.find((u) => u._id.toString() === sId);
    const sLoc = locMap.get(sId);

    let distanceMeters = null;
    if (
      recipientLoc &&
      recipientLoc.location &&
      sLoc &&
      sLoc.location &&
      !sLoc.isLocationHidden
    ) {
      distanceMeters = calculateHaversineDistance(
        recipientLoc.location.coordinates[1],
        recipientLoc.location.coordinates[0],
        sLoc.location.coordinates[1],
        sLoc.location.coordinates[0]
      );
    }

    const senderDto = hydrateSenderDto(sProfile, sUser, distanceMeters);

    // Build targetElement preview safely
    const targetEl = like.targetElement || { elementType: 'PROFILE', elementId: '' };
    let previewData = null;

    if (targetEl.elementType === 'PROMPT' && targetEl.elementId && recipientProfile && recipientProfile.prompts) {
      const foundPrompt = recipientProfile.prompts.find((p) => p.questionId === targetEl.elementId);
      if (foundPrompt) {
        previewData = { question: foundPrompt.question, answer: foundPrompt.answer };
      }
    }

    return {
      likeId: like._id.toString(),
      type: like.type,
      createdAt: like.createdAt,
      sender: senderDto,
      likedElement: {
        type: targetEl.elementType,
        id: targetEl.elementId,
        preview: previewData,
      },
      comment: like.comment || '',
      availableActions: ['DECLINE'], // ACCEPT deferred to Prompt 11
    };
  });

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Decline an incoming like
 */
async function declineIncomingLike(recipientId, likeId, data = {}) {
  if (!recipientId) {
    throw new IncomingLikeServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const { idempotencyKey } = data;

  const likeDoc = await DatingInteraction.findOne({
    _id: likeId,
    target: recipientId,
    type: { $in: ['LIKE', 'ROSE', 'PRIORITY_LIKE'] },
  });

  if (!likeDoc) {
    throw new IncomingLikeServiceError('LIKE_NOT_FOUND', 'Incoming like was not found', 404);
  }

  // Idempotency: if already declined, return current state safely
  if (likeDoc.status === 'DECLINED') {
    return {
      declined: true,
      suppressedUntil: likeDoc.suppressedUntil,
    };
  }

  if (likeDoc.status === 'ACCEPTED') {
    throw new IncomingLikeServiceError('LIKE_DECISION_CONFLICT', 'Cannot decline an already accepted like', 409);
  }

  // Set 30-day rediscovery suppression
  const suppressionDays = datingConfig.limits.passSuppressionDays || 30;
  const suppressedUntil = new Date(Date.now() + suppressionDays * 24 * 60 * 60 * 1000);

  likeDoc.status = 'DECLINED';
  likeDoc.declinedAt = new Date();
  likeDoc.suppressedUntil = suppressedUntil;
  await likeDoc.save();

  // Record outbox event
  try {
    await OutboxEvent.create({
      eventType: 'like.declined',
      aggregateType: 'INTERACTION',
      aggregateId: likeDoc._id.toString(),
      payload: {
        likeId: likeDoc._id.toString(),
        senderId: likeDoc.actor.toString(),
        recipientId: recipientId.toString(),
        type: likeDoc.type,
        declinedAt: likeDoc.declinedAt,
      },
      deduplicationKey: `declined_${recipientId}_${likeDoc._id}`,
    });
  } catch (err) {
    console.warn('[INCOMING LIKE SERVICE] Outbox recording warning:', err.message);
  }

  return {
    declined: true,
    suppressedUntil,
  };
}

/**
 * Reusable helper prepared for Prompt 11 (Atomic Mutual Matching)
 */
async function getPendingIncomingLikeForDecision(recipientId, likeId) {
  const likeDoc = await DatingInteraction.findOne({
    _id: likeId,
    target: recipientId,
    type: { $in: ['LIKE', 'ROSE', 'PRIORITY_LIKE'] },
    status: 'PENDING',
  });

  if (!likeDoc) {
    throw new IncomingLikeServiceError('LIKE_NOT_FOUND', 'Pending incoming like was not found or is no longer pending', 404);
  }

  return likeDoc;
}

module.exports = {
  getIncomingLikes,
  declineIncomingLike,
  getPendingIncomingLikeForDecision,
  createLikesCursor,
  verifyLikesCursor,
  IncomingLikeServiceError,
};
