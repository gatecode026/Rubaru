const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Chat = require('../models/Chat');
const Block = require('../models/Block');
const OutboxEvent = require('../models/OutboxEvent');
const { formatDistanceLabel } = require('./locationService');

class MatchServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'MatchServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Format privacy-safe other-user card for Match DTO
 */
function formatOtherUserDto(otherProfile, otherUser) {
  return {
    userId: otherProfile.user ? otherProfile.user.toString() : '',
    displayName: otherProfile.displayName || 'Rubaru Match',
    age: otherProfile.age || 24,
    avatarUri: otherProfile.avatarUri || '',
    photos: Array.isArray(otherProfile.photos) ? otherProfile.photos : [],
    interests: Array.isArray(otherProfile.interests) ? otherProfile.interests : [],
    datingIntention: otherProfile.datingIntention || 'NOT_SURE',
    isVerified: otherUser ? Boolean(otherUser.isAgeVerified) : false,
  };
}

/**
 * Accept an incoming pending like and atomically create a canonical Match & Conversation
 */
async function acceptIncomingLike(recipientId, likeId, data = {}) {
  if (!recipientId) {
    throw new MatchServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const recipientUser = await User.findById(recipientId);
  if (!recipientUser || recipientUser.accountStatus === 'DELETED' || recipientUser.accountStatus === 'BANNED' || recipientUser.accountStatus === 'SUSPENDED') {
    throw new MatchServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active or is suspended', 403);
  }

  // 1. Resolve and validate incoming like
  const likeDoc = await DatingInteraction.findOne({
    _id: likeId,
    type: { $in: ['LIKE', 'ROSE', 'PRIORITY_LIKE'] },
  });

  if (!likeDoc) {
    throw new MatchServiceError('LIKE_NOT_FOUND', 'Incoming like was not found', 404);
  }

  if (likeDoc.target.toString() !== recipientId.toString()) {
    throw new MatchServiceError('LIKE_OWNERSHIP_INVALID', 'Like does not belong to authenticated user', 403);
  }

  const senderId = likeDoc.actor.toString();

  // 2. Canonical pair construction
  const [lowerId, higherId] = [recipientId.toString(), senderId].sort();
  const canonicalPair = `${lowerId}:${higherId}`;

  // Idempotency: if already accepted, return existing Match
  if (likeDoc.status === 'ACCEPTED') {
    const existingMatch = await Match.findOne({ canonicalPair }).populate('conversation');
    if (existingMatch) {
      const otherProfile = await DatingProfile.findOne({ user: senderId });
      const otherUser = await User.findById(senderId);
      return {
        matched: true,
        match: {
          id: existingMatch._id.toString(),
          matchedAt: existingMatch.matchedAt,
          otherUser: formatOtherUserDto(otherProfile, otherUser),
        },
        conversation: {
          id: existingMatch.conversation ? existingMatch.conversation._id.toString() : '',
        },
      };
    }
  }

  if (likeDoc.status !== 'PENDING') {
    throw new MatchServiceError('LIKE_NOT_PENDING', `Like is not pending (current status: ${likeDoc.status})`, 400);
  }

  // 3. Revalidate sender account and safety restrictions
  const senderUser = await User.findById(senderId);
  if (!senderUser || senderUser.accountStatus === 'DELETED' || senderUser.accountStatus === 'BANNED' || senderUser.accountStatus === 'SUSPENDED') {
    throw new MatchServiceError('CANDIDATE_NOT_AVAILABLE', 'Sender account is no longer active', 409);
  }

  const isBlocked = await Block.findOne({
    $or: [
      { blocker: recipientId, blocked: senderId },
      { blocker: senderId, blocked: recipientId },
    ],
  });
  if (isBlocked) {
    throw new MatchServiceError('MATCH_NOT_ALLOWED', 'Cannot match with this user', 403);
  }

  // 4. Check existing Match record
  let matchDoc = await Match.findOne({ canonicalPair });
  if (matchDoc) {
    if (matchDoc.status === 'UNMATCHED' || matchDoc.status === 'BLOCKED') {
      throw new MatchServiceError('REMATCH_NOT_ALLOWED', 'Rematching is not permitted for previously ended matches', 409);
    }
  }

  // 5. Create or update Match document
  if (!matchDoc) {
    try {
      matchDoc = await Match.create({
        canonicalPair,
        user1: lowerId,
        user2: higherId,
        users: [lowerId, higherId],
        status: 'ACTIVE',
        initiatorInteraction: likeDoc._id,
        matchedAt: new Date(),
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        matchDoc = await Match.findOne({ canonicalPair });
      } else {
        throw createErr;
      }
    }
  }

  // 6. Ensure authoritative direct match conversation & memberships exist
  const { ensureDirectMatchConversation } = require('./conversationService');
  const { conversation: chatDoc } = await ensureDirectMatchConversation({
    actorUserId: recipientId,
    matchId: matchDoc._id,
  });

  // 7. Update Like status to ACCEPTED
  likeDoc.status = 'ACCEPTED';
  likeDoc.acceptedAt = new Date();
  await likeDoc.save();

  // Also check if there was any reciprocal pending like from recipient to sender and mark it ACCEPTED
  await DatingInteraction.updateMany(
    {
      actor: recipientId,
      target: senderId,
      status: 'PENDING',
    },
    {
      $set: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    }
  );

  // 8. Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'match.created',
      aggregateType: 'MATCH',
      aggregateId: matchDoc._id.toString(),
      payload: {
        matchId: matchDoc._id.toString(),
        conversationId: chatDoc._id.toString(),
        userAId: lowerId,
        userBId: higherId,
        source: 'INCOMING_LIKE_ACCEPTED',
        sourceLikeIds: [likeDoc._id.toString()],
        matchedAt: matchDoc.matchedAt,
      },
      deduplicationKey: `match_${matchDoc._id}`,
    });
  } catch (err) {
    console.warn('[MATCH SERVICE] Outbox recording warning:', err.message);
  }

  // 9. Return Match Response DTO
  const senderProfile = await DatingProfile.findOne({ user: senderId });

  return {
    matched: true,
    match: {
      id: matchDoc._id.toString(),
      matchedAt: matchDoc.matchedAt,
      otherUser: formatOtherUserDto(senderProfile, senderUser),
    },
    conversation: {
      id: chatDoc._id.toString(),
    },
  };
}

/**
 * Handle atomic reciprocal match creation when User B likes User A who already liked User B
 */
async function createReciprocalMatch(userBId, userAId, newLikeDoc, existingLikeDoc) {
  const [lowerId, higherId] = [userBId.toString(), userAId.toString()].sort();
  const canonicalPair = `${lowerId}:${higherId}`;

  // 1. Create Match
  let matchDoc;
  try {
    matchDoc = await Match.create({
      canonicalPair,
      user1: lowerId,
      user2: higherId,
      users: [lowerId, higherId],
      status: 'ACTIVE',
      initiatorInteraction: existingLikeDoc._id,
      acceptorInteraction: newLikeDoc._id,
      matchedAt: new Date(),
    });
  } catch (createErr) {
    if (createErr.code === 11000) {
      matchDoc = await Match.findOne({ canonicalPair });
    } else {
      throw createErr;
    }
  }

  // 2. Ensure authoritative direct match conversation & memberships exist
  const { ensureDirectMatchConversation } = require('./conversationService');
  const { conversation: chatDoc } = await ensureDirectMatchConversation({
    actorUserId: userBId,
    matchId: matchDoc._id,
  });

  // 3. Mark both interactions as ACCEPTED
  existingLikeDoc.status = 'ACCEPTED';
  existingLikeDoc.acceptedAt = new Date();
  await existingLikeDoc.save();

  newLikeDoc.status = 'ACCEPTED';
  newLikeDoc.acceptedAt = new Date();
  await newLikeDoc.save();

  // 4. Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'match.created',
      aggregateType: 'MATCH',
      aggregateId: matchDoc._id.toString(),
      payload: {
        matchId: matchDoc._id.toString(),
        conversationId: chatDoc._id.toString(),
        userAId: lowerId,
        userBId: higherId,
        source: 'RECIPROCAL_LIKES',
        sourceLikeIds: [existingLikeDoc._id.toString(), newLikeDoc._id.toString()],
        matchedAt: matchDoc.matchedAt,
      },
      deduplicationKey: `match_${matchDoc._id}`,
    });
  } catch (err) {
    console.warn('[MATCH SERVICE] Outbox recording warning:', err.message);
  }

  // 5. Hydrate other user profile
  const otherProfile = await DatingProfile.findOne({ user: userAId });
  const otherUser = await User.findById(userAId);

  return {
    matched: true,
    match: {
      id: matchDoc._id.toString(),
      matchedAt: matchDoc.matchedAt,
      otherUser: formatOtherUserDto(otherProfile, otherUser),
    },
    conversation: {
      id: chatDoc._id.toString(),
    },
  };
}

const crypto = require('crypto');

/**
 * Sign an opaque cursor for Matches list pagination
 */
function createMatchCursor(payload) {
  const secret = process.env.JWT_SECRET || 'rubaru_match_cursor_secret_2026';
  const dataString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  return `cur_m_${dataString}.${signature}`;
}

/**
 * Verify and decode an opaque match cursor
 */
function verifyMatchCursor(cursorString, currentUserId) {
  if (!cursorString || typeof cursorString !== 'string' || !cursorString.startsWith('cur_m_')) {
    throw new MatchServiceError('INVALID_MATCH_CURSOR', 'Match cursor format is invalid', 400);
  }

  const raw = cursorString.substring(6);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new MatchServiceError('INVALID_MATCH_CURSOR', 'Match cursor structure is malformed', 400);
  }

  const [dataString, signature] = parts;
  const secret = process.env.JWT_SECRET || 'rubaru_match_cursor_secret_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');

  if (signature !== expectedSig) {
    throw new MatchServiceError('INVALID_MATCH_CURSOR', 'Match cursor signature verification failed', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
  } catch (err) {
    throw new MatchServiceError('INVALID_MATCH_CURSOR', 'Match cursor payload cannot be decoded', 400);
  }

  if (payload.userId !== currentUserId.toString()) {
    throw new MatchServiceError('INVALID_MATCH_CURSOR', 'Match cursor does not belong to authenticated user', 403);
  }

  if (payload.exp && Date.now() > payload.exp) {
    throw new MatchServiceError('INVALID_MATCH_CURSOR', 'Match cursor has expired', 410);
  }

  return payload;
}

/**
 * Query active Matches list for authenticated user with cursor pagination
 */
async function getMatchesList(userId, options = {}) {
  if (!userId) {
    throw new MatchServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const { cursor, status = 'ACTIVE' } = options;
  const limit = Math.min(20, Math.max(1, parseInt(options.limit, 10) || 10));

  let offset = 0;
  if (cursor) {
    const decoded = verifyMatchCursor(cursor, userId);
    offset = decoded.offset || 0;
  }

  // 1. Query user's matches
  const totalMatches = await Match.find({
    users: userId,
    status,
  })
    .sort({ matchedAt: -1, _id: -1 })
    .populate('conversation')
    .lean();

  const pageMatches = totalMatches.slice(offset, offset + limit);
  const hasMore = offset + limit < totalMatches.length;

  const nextCursor = hasMore
    ? createMatchCursor({
        userId: userId.toString(),
        status,
        offset: offset + limit,
        exp: Date.now() + 3600000,
      })
    : null;

  if (pageMatches.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  // 2. Extract other user IDs and bulk-hydrate profiles and users (zero N+1)
  const otherUserIds = pageMatches.map((m) => {
    const otherId = m.users.find((u) => u.toString() !== userId.toString());
    return otherId ? otherId.toString() : null;
  }).filter(Boolean);

  const [otherProfiles, otherUsers] = await Promise.all([
    DatingProfile.find({ user: { $in: otherUserIds } }).lean(),
    User.find({ _id: { $in: otherUserIds } }, '_id isAgeVerified accountStatus').lean(),
  ]);

  const profileMap = new Map(otherProfiles.map((p) => [p.user.toString(), p]));
  const userMap = new Map(otherUsers.map((u) => [u._id.toString(), u]));

  // 3. Format strict privacy-safe DTO items
  const items = pageMatches.map((m) => {
    const otherId = m.users.find((u) => u.toString() !== userId.toString());
    const oIdStr = otherId ? otherId.toString() : '';
    const oProfile = profileMap.get(oIdStr) || {};
    const oUser = userMap.get(oIdStr);

    const conv = m.conversation;

    return {
      matchId: m._id.toString(),
      matchedAt: m.matchedAt,
      status: m.status,
      otherUser: formatOtherUserDto(oProfile, oUser),
      conversation: {
        id: conv ? conv._id.toString() : '',
        latestMessage: null,
        unreadCount: 0,
      },
      availableActions: ['OPEN_CONVERSATION'],
    };
  });

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Retrieve Match Details by Match ID
 */
async function getMatchDetails(userId, matchId) {
  const { requireActiveMatchMember } = require('./matchAuthorizationService');
  const authContext = await requireActiveMatchMember(userId, matchId);
  const match = authContext.match;
  const otherUserId = authContext.otherMemberId;

  const [otherProfile, otherUser] = await Promise.all([
    DatingProfile.findOne({ user: otherUserId }),
    User.findById(otherUserId, '_id isAgeVerified accountStatus'),
  ]);

  return {
    matchId: match._id.toString(),
    matchedAt: match.matchedAt,
    status: match.status,
    otherUser: formatOtherUserDto(otherProfile, otherUser),
    conversation: {
      id: match.conversation ? match.conversation.toString() : '',
    },
    availableActions: match.status === 'ACTIVE' ? ['OPEN_CONVERSATION'] : [],
  };
}

module.exports = {
  acceptIncomingLike,
  createReciprocalMatch,
  getMatchesList,
  getMatchDetails,
  createMatchCursor,
  verifyMatchCursor,
  MatchServiceError,
};
