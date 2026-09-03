const crypto = require('crypto');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Match = require('../models/Match');
const Block = require('../models/Block');
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const OutboxEvent = require('../models/OutboxEvent');
const { ConversationTypes, ConversationStatuses, MemberRoles, MemberStates } = require('../models/enums');
const { authorizeConversationAccess, ConversationAuthorizationError } = require('./conversationAuthorizationService');

class ConversationServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'ConversationServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Sign an opaque cursor for Conversation list pagination
 */
function createConversationCursor(payload) {
  const secret = process.env.JWT_SECRET || 'rubaru_conversation_cursor_secret_2026';
  const dataString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  return `cur_c_${dataString}.${signature}`;
}

/**
 * Verify and decode an opaque conversation cursor
 */
function verifyConversationCursor(cursorString, currentUserId) {
  if (!cursorString || typeof cursorString !== 'string' || !cursorString.startsWith('cur_c_')) {
    throw new ConversationServiceError('INVALID_CURSOR', 'Conversation cursor format is invalid', 400);
  }

  const raw = cursorString.substring(6);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new ConversationServiceError('INVALID_CURSOR', 'Conversation cursor structure is malformed', 400);
  }

  const [dataString, signature] = parts;
  const secret = process.env.JWT_SECRET || 'rubaru_conversation_cursor_secret_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');

  if (signature !== expectedSig) {
    throw new ConversationServiceError('INVALID_CURSOR', 'Conversation cursor signature verification failed', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
  } catch (err) {
    throw new ConversationServiceError('INVALID_CURSOR', 'Conversation cursor payload cannot be decoded', 400);
  }

  if (payload.userId !== currentUserId.toString()) {
    throw new ConversationServiceError('INVALID_CURSOR', 'Conversation cursor does not belong to authenticated user', 403);
  }

  if (payload.exp && Date.now() > payload.exp) {
    throw new ConversationServiceError('INVALID_CURSOR', 'Conversation cursor has expired', 410);
  }

  return payload;
}

/**
 * Format privacy-safe other user summary for conversation DTO
 */
function formatMemberProfileDto(profile, user) {
  if (!profile) {
    return {
      userId: user ? user._id.toString() : '',
      displayName: 'Rubaru User',
      avatarUri: '',
      isVerified: user ? Boolean(user.isAgeVerified) : false,
    };
  }

  return {
    userId: profile.user ? profile.user.toString() : '',
    displayName: profile.displayName || 'Rubaru User',
    avatarUri: profile.avatarUri || (Array.isArray(profile.photos) && profile.photos[0]) || '',
    age: profile.age || null,
    isVerified: user ? Boolean(user.isAgeVerified) : false,
  };
}

/**
 * Ensure an active direct match conversation exists between two matched users
 * @param {Object} params
 * @param {string} params.actorUserId - Authenticated User ID
 * @param {string} params.matchId - Match document ID
 * @returns {Promise<Object>} { conversation, members, isNew }
 */
async function ensureDirectMatchConversation({ actorUserId, matchId }) {
  if (!actorUserId) {
    throw new ConversationServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  if (!matchId) {
    throw new ConversationServiceError('MATCH_ID_REQUIRED', 'Match ID is required', 400);
  }

  // 1. Load Match and confirm actor membership
  const match = await Match.findById(matchId);
  if (!match) {
    throw new ConversationServiceError('MATCH_NOT_FOUND', 'Match was not found', 404);
  }

  const isActorInMatch = match.users.some((u) => u.toString() === actorUserId.toString());
  if (!isActorInMatch) {
    throw new ConversationServiceError('MATCH_ACCESS_DENIED', 'Access denied to this match', 403);
  }

  if (match.status !== 'ACTIVE') {
    throw new ConversationServiceError('MATCH_NOT_ACTIVE', `Match is no longer active (status: ${match.status})`, 403);
  }

  // 2. Derive participants from Match
  const user1Id = match.users[0].toString();
  const user2Id = match.users[1].toString();
  const [lowerId, higherId] = [user1Id, user2Id].sort();
  const canonicalParticipantKey = `${lowerId}:${higherId}`;

  // 3. Check for blocks between users
  const isBlocked = await Block.findOne({
    $or: [
      { blocker: lowerId, blocked: higherId },
      { blocker: higherId, blocked: lowerId },
    ],
  });

  if (isBlocked) {
    throw new ConversationServiceError('USER_BLOCKED', 'Cannot open conversation due to safety restrictions', 403);
  }

  // 4. Check if conversation already exists by matchId or canonicalParticipantKey
  let isNew = false;
  let conversation = await Conversation.findOne({
    $or: [{ matchId: match._id }, { canonicalParticipantKey }],
  });

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        type: ConversationTypes.DIRECT_MATCH,
        status: ConversationStatuses.ACTIVE,
        matchId: match._id,
        canonicalParticipantKey,
        createdBy: actorUserId,
        participants: [lowerId, higherId],
        memberCount: 2,
      });
      isNew = true;
    } catch (err) {
      if (err.code === 11000) {
        conversation = await Conversation.findOne({
          $or: [{ matchId: match._id }, { canonicalParticipantKey }],
        });
        isNew = false;
      } else {
        throw err;
      }
    }
  }

  // 5. Ensure both membership records exist and are ACTIVE
  await Promise.all([
    ConversationMember.findOneAndUpdate(
      { conversationId: conversation._id, userId: lowerId },
      {
        $setOnInsert: {
          conversationId: conversation._id,
          conversation: conversation._id,
          userId: lowerId,
          user: lowerId,
          role: MemberRoles.MEMBER,
          joinedAt: new Date(),
        },
        $set: { state: MemberStates.ACTIVE },
      },
      { upsert: true, new: true }
    ),
    ConversationMember.findOneAndUpdate(
      { conversationId: conversation._id, userId: higherId },
      {
        $setOnInsert: {
          conversationId: conversation._id,
          conversation: conversation._id,
          userId: higherId,
          user: higherId,
          role: MemberRoles.MEMBER,
          joinedAt: new Date(),
        },
        $set: { state: MemberStates.ACTIVE },
      },
      { upsert: true, new: true }
    ),
  ]);

  // 6. Link conversation on Match
  if (!match.conversation || match.conversation.toString() !== conversation._id.toString()) {
    match.conversation = conversation._id;
    await match.save();
  }

  // 7. Record Outbox Event only for newly created conversations
  if (isNew) {
    try {
      await OutboxEvent.create({
        eventType: 'conversation.created',
        aggregateType: 'CONVERSATION',
        aggregateId: conversation._id.toString(),
        payload: {
          conversationId: conversation._id.toString(),
          type: conversation.type,
          matchId: match._id.toString(),
          participants: [lowerId, higherId],
          canonicalParticipantKey,
          createdAt: conversation.createdAt,
        },
        deduplicationKey: `conv_created_${conversation._id}`,
      });
    } catch (outboxErr) {
      console.warn('[CONVERSATION SERVICE] Outbox event recording warning:', outboxErr.message);
    }
  }

  return {
    conversation,
    isNew,
  };
}

/**
 * Close conversation when unmatching occurs
 */
async function closeConversationForUnmatch({ conversationId, matchId, actorUserId, reason = 'USER_UNMATCHED' }) {
  const query = conversationId ? { _id: conversationId } : { matchId };
  const conversation = await Conversation.findOne(query);

  if (!conversation) return null;

  if (conversation.status === ConversationStatuses.CLOSED_BY_UNMATCH) {
    return conversation;
  }

  conversation.status = ConversationStatuses.CLOSED_BY_UNMATCH;
  conversation.closedAt = new Date();
  conversation.closedBy = actorUserId;
  conversation.closeReason = reason;
  await conversation.save();

  // Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'conversation.closed',
      aggregateType: 'CONVERSATION',
      aggregateId: conversation._id.toString(),
      payload: {
        conversationId: conversation._id.toString(),
        matchId: conversation.matchId ? conversation.matchId.toString() : null,
        closedBy: actorUserId ? actorUserId.toString() : null,
        closedAt: conversation.closedAt,
        closeReason: conversation.closeReason,
        status: conversation.status,
      },
      deduplicationKey: `conv_closed_${conversation._id}_${Date.now()}`,
    });
  } catch (err) {
    console.warn('[CONVERSATION SERVICE] Outbox close recording warning:', err.message);
  }

  return conversation;
}

/**
 * Close conversation and update member states when a block occurs
 */
async function closeConversationForBlock({ conversationId, matchId, blockerId, blockedId, reason = 'USER_BLOCKED' }) {
  const query = conversationId ? { _id: conversationId } : { matchId };
  const conversation = await Conversation.findOne(query);

  if (!conversation) return null;

  conversation.status = ConversationStatuses.CLOSED_BY_BLOCK;
  conversation.closedAt = new Date();
  conversation.closedBy = blockerId;
  conversation.closeReason = reason;
  await conversation.save();

  if (blockedId) {
    await ConversationMember.updateOne(
      { conversationId: conversation._id, userId: blockedId },
      { $set: { state: MemberStates.BLOCKED } }
    );
  }

  // Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'conversation.closed',
      aggregateType: 'CONVERSATION',
      aggregateId: conversation._id.toString(),
      payload: {
        conversationId: conversation._id.toString(),
        closedBy: blockerId ? blockerId.toString() : null,
        blockedId: blockedId ? blockedId.toString() : null,
        closedAt: conversation.closedAt,
        closeReason: conversation.closeReason,
        status: conversation.status,
      },
      deduplicationKey: `conv_blocked_${conversation._id}_${Date.now()}`,
    });
  } catch (err) {
    console.warn('[CONVERSATION SERVICE] Outbox block recording warning:', err.message);
  }

  return conversation;
}

/**
 * Retrieve paginated conversation list for authenticated user
 */
async function getConversationList(actorUserId, options = {}) {
  if (!actorUserId) {
    throw new ConversationServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const { cursor, status = ConversationStatuses.ACTIVE, type } = options;
  const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 20));

  let offset = 0;
  if (cursor) {
    const decoded = verifyConversationCursor(cursor, actorUserId);
    offset = decoded.offset || 0;
  }

  // 1. Find user's active memberships
  const memberDocs = await ConversationMember.find({
    userId: actorUserId,
    state: MemberStates.ACTIVE,
  })
    .sort({ updatedAt: -1, _id: -1 })
    .populate('conversationId')
    .lean();

  // 2. Filter valid active conversations matching requested criteria
  const validMemberships = memberDocs.filter((m) => {
    const conv = m.conversationId || m.conversation;
    if (!conv) return false;
    if (status && conv.status !== status) return false;
    if (type && conv.type !== type) return false;
    return true;
  });

  const pageMemberships = validMemberships.slice(offset, offset + limit);
  const hasMore = offset + limit < validMemberships.length;

  const nextCursor = hasMore
    ? createConversationCursor({
        userId: actorUserId.toString(),
        status,
        type: type || null,
        offset: offset + limit,
        exp: Date.now() + 3600000,
      })
    : null;

  if (pageMemberships.length === 0) {
    return {
      items: [],
      nextCursor: null,
      hasMore: false,
    };
  }

  // 3. Extract other member IDs for direct match conversations and bulk-hydrate profiles (zero N+1)
  const otherUserIds = pageMemberships
    .map((m) => {
      const conv = m.conversationId || m.conversation;
      if (!conv) return null;
      if (conv.canonicalParticipantKey) {
        const parts = conv.canonicalParticipantKey.split(':');
        return parts.find((id) => id !== actorUserId.toString()) || null;
      }
      if (Array.isArray(conv.participants)) {
        const otherPart = conv.participants.find((p) => p.toString() !== actorUserId.toString());
        return otherPart ? otherPart.toString() : null;
      }
      return null;
    })
    .filter(Boolean);

  const [otherProfiles, otherUsers] = await Promise.all([
    DatingProfile.find({ user: { $in: otherUserIds } }).lean(),
    User.find({ _id: { $in: otherUserIds } }, '_id isAgeVerified accountStatus').lean(),
  ]);

  const profileMap = new Map(otherProfiles.map((p) => [p.user.toString(), p]));
  const userMap = new Map(otherUsers.map((u) => [u._id.toString(), u]));

  // 4. Format clean DTO items
  const items = pageMemberships.map((m) => {
    const conv = m.conversationId || m.conversation;
    let otherIdStr = null;

    if (conv.canonicalParticipantKey) {
      const parts = conv.canonicalParticipantKey.split(':');
      otherIdStr = parts.find((id) => id !== actorUserId.toString()) || null;
    } else if (Array.isArray(conv.participants)) {
      const otherPart = conv.participants.find((p) => p.toString() !== actorUserId.toString());
      otherIdStr = otherPart ? otherPart.toString() : null;
    }

    const oProfile = otherIdStr ? profileMap.get(otherIdStr) : null;
    const oUser = otherIdStr ? userMap.get(otherIdStr) : null;

    return {
      id: conv._id.toString(),
      type: conv.type,
      status: conv.status,
      isGroup: Boolean(conv.isGroup || conv.type === ConversationTypes.GROUP),
      groupName: conv.groupName || '',
      groupAvatar: conv.groupAvatar || '',
      otherParticipant: conv.type === ConversationTypes.DIRECT_MATCH ? formatMemberProfileDto(oProfile, oUser) : null,
      memberCount: conv.memberCount || 2,
      lastSequence: conv.lastSequence || 0,
      lastMessageAt: conv.lastMessageAt || conv.updatedAt,
      myMembership: {
        role: m.role,
        state: m.state,
        joinedAt: m.joinedAt,
        lastReadSequence: m.readThroughSequence || m.lastReadSequence || 0,
        lastDeliveredSequence: m.deliveredThroughSequence || m.lastDeliveredSequence || 0,
        deliveredThroughSequence: m.deliveredThroughSequence || m.lastDeliveredSequence || 0,
        readThroughSequence: m.readThroughSequence || m.lastReadSequence || 0,
        deliveredAt: m.deliveredAt || null,
        readAt: m.readAt || null,
        notificationPreference: m.notificationPreference || 'ALL',
      },
      updatedAt: conv.updatedAt,
    };
  });

  return {
    items,
    nextCursor,
    hasMore,
  };
}

/**
 * Retrieve single conversation details with authorization
 */
async function getConversationDetails(actorUserId, conversationId) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const { conversation, member, otherMemberId } = authContext;

  let otherParticipantDto = null;
  if (otherMemberId) {
    const [profile, user] = await Promise.all([
      DatingProfile.findOne({ user: otherMemberId }).lean(),
      User.findById(otherMemberId, '_id isAgeVerified accountStatus').lean(),
    ]);
    otherParticipantDto = formatMemberProfileDto(profile, user);
  }

  // Load all active members for this conversation
  const allMembers = await ConversationMember.find({
    conversationId: conversation._id,
    state: MemberStates.ACTIVE,
  }).lean();

  const peerMember = allMembers.find((m) => (m.userId || m.user).toString() !== actorUserId.toString());
  const receiptState = {
    self: {
      deliveredThroughSequence: member.deliveredThroughSequence || member.lastDeliveredSequence || 0,
      readThroughSequence: member.readThroughSequence || member.lastReadSequence || 0,
      deliveredAt: member.deliveredAt || null,
      readAt: member.readAt || null,
    },
    peer: peerMember ? {
      deliveredThroughSequence: peerMember.deliveredThroughSequence || peerMember.lastDeliveredSequence || 0,
      readThroughSequence: peerMember.readThroughSequence || peerMember.lastReadSequence || 0,
      deliveredAt: peerMember.deliveredAt || null,
      readAt: peerMember.readAt || null,
    } : {
      deliveredThroughSequence: 0,
      readThroughSequence: 0,
      deliveredAt: null,
      readAt: null,
    },
  };

  return {
    id: conversation._id.toString(),
    type: conversation.type,
    status: conversation.status,
    matchId: conversation.matchId ? conversation.matchId.toString() : null,
    isGroup: Boolean(conversation.isGroup || conversation.type === ConversationTypes.GROUP),
    groupName: conversation.groupName || '',
    groupAvatar: conversation.groupAvatar || '',
    memberCount: conversation.memberCount || allMembers.length,
    otherParticipant: otherParticipantDto,
    lastSequence: conversation.lastSequence || 0,
    lastMessageAt: conversation.lastMessageAt || conversation.updatedAt,
    receiptState,
    myMembership: {
      role: member.role,
      state: member.state,
      joinedAt: member.joinedAt,
      lastReadSequence: member.readThroughSequence || member.lastReadSequence || 0,
      lastDeliveredSequence: member.deliveredThroughSequence || member.lastDeliveredSequence || 0,
      deliveredThroughSequence: member.deliveredThroughSequence || member.lastDeliveredSequence || 0,
      readThroughSequence: member.readThroughSequence || member.lastReadSequence || 0,
      deliveredAt: member.deliveredAt || null,
      readAt: member.readAt || null,
      notificationPreference: member.notificationPreference || 'ALL',
    },
    members: allMembers.map((m) => ({
      userId: m.userId ? m.userId.toString() : m.user?.toString(),
      role: m.role,
      joinedAt: m.joinedAt,
    })),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

module.exports = {
  ensureDirectMatchConversation,
  closeConversationForUnmatch,
  closeConversationForBlock,
  getConversationList,
  getConversationDetails,
  createConversationCursor,
  verifyConversationCursor,
  ConversationServiceError,
};
