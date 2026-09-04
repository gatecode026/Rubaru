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
  let effectiveActorId = actorUserId;
  let effectiveConvId = conversationId;
  if (actorUserId && typeof actorUserId === 'object' && actorUserId.actorUserId) {
    effectiveActorId = actorUserId.actorUserId;
    effectiveConvId = actorUserId.conversationId;
  }

  const authContext = await authorizeConversationAccess({
    actorUserId: effectiveActorId,
    conversationId: effectiveConvId,
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

/**
 * Create a real database-backed group conversation
 */
async function createGroupConversation({ actorUserId, name, avatarUri = '', memberUserIds = [] }) {
  if (!actorUserId) {
    throw new ConversationServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 80) {
    throw new ConversationServiceError('INVALID_GROUP_NAME', 'Group name must be between 2 and 80 characters', 400);
  }

  // Deduplicate and filter member IDs
  const validMemberIds = [...new Set(
    memberUserIds
      .map((id) => (id ? id.toString() : null))
      .filter((id) => id && id !== actorUserId.toString())
  )];

  // Validate users exist and are active
  const targetUsers = await User.find({
    _id: { $in: validMemberIds },
    accountStatus: { $in: ['ACTIVE', 'active'] },
  });

  const activeMemberIds = targetUsers.map((u) => u._id.toString());
  const allParticipantIds = [actorUserId, ...activeMemberIds];

  const conversation = new Conversation({
    type: ConversationTypes.GROUP,
    status: ConversationStatuses.ACTIVE,
    isGroup: true,
    groupName: trimmedName,
    groupAvatar: avatarUri || '',
    createdBy: actorUserId,
    participants: allParticipantIds,
    memberCount: allParticipantIds.length,
    lastSequence: 0,
  });

  await conversation.save();

  // Create Owner membership for creator
  await ConversationMember.create({
    conversationId: conversation._id,
    userId: actorUserId,
    role: MemberRoles.OWNER,
    state: MemberStates.ACTIVE,
    joinedAt: new Date(),
    joinedSequence: 0,
  });

  // Create Member memberships for initial members
  for (const memberId of activeMemberIds) {
    await ConversationMember.create({
      conversationId: conversation._id,
      userId: memberId,
      role: MemberRoles.MEMBER,
      state: MemberStates.ACTIVE,
      joinedAt: new Date(),
      joinedSequence: 0,
    });
  }

  return {
    id: conversation._id.toString(),
    type: conversation.type,
    isGroup: true,
    groupName: conversation.groupName,
    groupAvatar: conversation.groupAvatar,
    memberCount: conversation.memberCount,
    createdBy: actorUserId.toString(),
    createdAt: conversation.createdAt,
  };
}

/**
 * Update Group Metadata (name, avatar) - Requires OWNER or ADMIN
 */
async function updateGroupMetadata({ actorUserId, conversationId, name, avatarUri }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'MANAGE_MEMBERS',
  });

  const { conversation } = authContext;
  if (conversation.type !== ConversationTypes.GROUP && !conversation.isGroup) {
    throw new ConversationServiceError('INVALID_CONVERSATION_TYPE', 'Only group metadata can be updated', 400);
  }

  if (name !== undefined) {
    const trimmed = name ? name.trim() : '';
    if (!trimmed || trimmed.length < 2 || trimmed.length > 80) {
      throw new ConversationServiceError('INVALID_GROUP_NAME', 'Group name must be between 2 and 80 characters', 400);
    }
    conversation.groupName = trimmed;
  }

  if (avatarUri !== undefined) {
    conversation.groupAvatar = avatarUri || '';
  }

  await conversation.save();

  return {
    id: conversation._id.toString(),
    groupName: conversation.groupName,
    groupAvatar: conversation.groupAvatar,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Get Group Members list with roles and profile details
 */
async function getGroupMembers({ actorUserId, conversationId }) {
  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const members = await ConversationMember.find({
    conversationId,
    state: MemberStates.ACTIVE,
  })
    .populate('userId', '_id isAgeVerified accountStatus')
    .lean();

  const userIds = members.map((m) => (m.userId ? m.userId._id : m.user));
  const profiles = await DatingProfile.find({ user: { $in: userIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  return members.map((m) => {
    const u = m.userId || {};
    const uId = u._id ? u._id.toString() : (m.user ? m.user.toString() : '');
    const profile = profileMap.get(uId);

    return {
      userId: uId,
      role: m.role,
      state: m.state,
      joinedAt: m.joinedAt,
      profile: formatMemberProfileDto(profile, u),
    };
  });
}

/**
 * Add Members to Group - Requires OWNER or ADMIN
 */
async function addGroupMembers({ actorUserId, conversationId, memberUserIds = [] }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'MANAGE_MEMBERS',
  });

  const { conversation, member: actorMember } = authContext;
  if (conversation.type !== ConversationTypes.GROUP && !conversation.isGroup) {
    throw new ConversationServiceError('INVALID_CONVERSATION_TYPE', 'Cannot add members to non-group conversation', 400);
  }

  if (actorMember.role !== MemberRoles.OWNER && actorMember.role !== MemberRoles.ADMIN) {
    throw new ConversationServiceError('FORBIDDEN', 'Only group owner or admins can add members', 403);
  }

  const validIds = [...new Set(
    memberUserIds.map((id) => (id ? id.toString() : null)).filter(Boolean)
  )];

  const addedMembers = [];
  for (const targetId of validIds) {
    let existing = await ConversationMember.findOne({
      conversationId: conversation._id,
      userId: targetId,
    });

    if (existing) {
      if (existing.state !== MemberStates.ACTIVE) {
        existing.state = MemberStates.ACTIVE;
        existing.role = MemberRoles.MEMBER;
        existing.joinedAt = new Date();
        existing.joinedSequence = conversation.lastSequence || 0;
        await existing.save();
        addedMembers.push(targetId);
      }
    } else {
      await ConversationMember.create({
        conversationId: conversation._id,
        userId: targetId,
        role: MemberRoles.MEMBER,
        state: MemberStates.ACTIVE,
        joinedAt: new Date(),
        joinedSequence: conversation.lastSequence || 0,
      });
      addedMembers.push(targetId);
    }
  }

  const activeCount = await ConversationMember.countDocuments({
    conversationId: conversation._id,
    state: MemberStates.ACTIVE,
  });

  conversation.memberCount = activeCount;
  if (Array.isArray(conversation.participants)) {
    for (const addedId of addedMembers) {
      if (!conversation.participants.some((p) => p.toString() === addedId)) {
        conversation.participants.push(addedId);
      }
    }
  }
  await conversation.save();

  return {
    conversationId: conversation._id.toString(),
    addedCount: addedMembers.length,
    memberCount: activeCount,
  };
}

/**
 * Remove Group Member - OWNER removes anyone; ADMIN removes MEMBER; Cannot remove OWNER
 */
async function removeGroupMember({ actorUserId, conversationId, targetUserId }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'MANAGE_MEMBERS',
  });

  const { conversation, member: actorMember } = authContext;
  if (conversation.type !== ConversationTypes.GROUP && !conversation.isGroup) {
    throw new ConversationServiceError('INVALID_CONVERSATION_TYPE', 'Cannot remove members from non-group conversation', 400);
  }

  if (actorMember.role !== MemberRoles.OWNER && actorMember.role !== MemberRoles.ADMIN) {
    throw new ConversationServiceError('FORBIDDEN', 'Only group owner or admins can remove members', 403);
  }

  const targetMember = await ConversationMember.findOne({
    conversationId: conversation._id,
    userId: targetUserId,
    state: MemberStates.ACTIVE,
  });

  if (!targetMember) {
    throw new ConversationServiceError('MEMBER_NOT_FOUND', 'Target user is not an active member of this group', 404);
  }

  if (targetMember.role === MemberRoles.OWNER) {
    throw new ConversationServiceError('CANNOT_REMOVE_OWNER', 'The group owner cannot be removed from the group', 403);
  }

  if (actorMember.role === MemberRoles.ADMIN && targetMember.role === MemberRoles.ADMIN) {
    throw new ConversationServiceError('CANNOT_REMOVE_ADMIN', 'Admins cannot remove other admins. Only the owner can remove admins.', 403);
  }

  targetMember.state = MemberStates.REMOVED;
  targetMember.removedAt = new Date();
  targetMember.removedBy = actorUserId;
  await targetMember.save();

  const activeCount = await ConversationMember.countDocuments({
    conversationId: conversation._id,
    state: MemberStates.ACTIVE,
  });

  conversation.memberCount = activeCount;
  await conversation.save();

  return {
    conversationId: conversation._id.toString(),
    removedUserId: targetUserId.toString(),
    memberCount: activeCount,
  };
}

/**
 * Update Member Role - Only OWNER can promote or demote ADMINs
 */
async function updateMemberRole({ actorUserId, conversationId, targetUserId, newRole }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'MANAGE_MEMBERS',
  });

  const { conversation, member: actorMember } = authContext;
  if (actorMember.role !== MemberRoles.OWNER) {
    throw new ConversationServiceError('OWNER_REQUIRED', 'Only the group owner can update member roles', 403);
  }

  if (![MemberRoles.ADMIN, MemberRoles.MEMBER].includes(newRole)) {
    throw new ConversationServiceError('INVALID_ROLE', 'Role must be either ADMIN or MEMBER', 400);
  }

  const targetMember = await ConversationMember.findOne({
    conversationId: conversation._id,
    userId: targetUserId,
    state: MemberStates.ACTIVE,
  });

  if (!targetMember) {
    throw new ConversationServiceError('MEMBER_NOT_FOUND', 'Target user is not an active member', 404);
  }

  if (targetMember.role === MemberRoles.OWNER) {
    throw new ConversationServiceError('CANNOT_MODIFY_OWNER_ROLE', 'Cannot change owner role directly. Use transfer ownership.', 403);
  }

  targetMember.role = newRole;
  await targetMember.save();

  return {
    conversationId: conversation._id.toString(),
    userId: targetUserId.toString(),
    role: targetMember.role,
  };
}

/**
 * Transfer Group Ownership - Only current OWNER
 */
async function transferOwnership({ actorUserId, conversationId, targetUserId }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'MANAGE_MEMBERS',
  });

  const { conversation, member: actorMember } = authContext;
  if (actorMember.role !== MemberRoles.OWNER) {
    throw new ConversationServiceError('OWNER_REQUIRED', 'Only current owner can transfer ownership', 403);
  }

  const targetMember = await ConversationMember.findOne({
    conversationId: conversation._id,
    userId: targetUserId,
    state: MemberStates.ACTIVE,
  });

  if (!targetMember) {
    throw new ConversationServiceError('MEMBER_NOT_FOUND', 'Target user is not an active member', 404);
  }

  actorMember.role = MemberRoles.ADMIN;
  targetMember.role = MemberRoles.OWNER;
  conversation.createdBy = targetUserId;

  await Promise.all([actorMember.save(), targetMember.save(), conversation.save()]);

  return {
    conversationId: conversation._id.toString(),
    previousOwnerId: actorUserId.toString(),
    newOwnerId: targetUserId.toString(),
  };
}

/**
 * Leave Group
 */
async function leaveGroup({ actorUserId, conversationId }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const { conversation, member } = authContext;
  if (conversation.type !== ConversationTypes.GROUP && !conversation.isGroup) {
    throw new ConversationServiceError('INVALID_CONVERSATION_TYPE', 'Cannot leave a direct conversation', 400);
  }

  const activeCount = await ConversationMember.countDocuments({
    conversationId: conversation._id,
    state: MemberStates.ACTIVE,
  });

  if (member.role === MemberRoles.OWNER && activeCount > 1) {
    throw new ConversationServiceError(
      'OWNER_CANNOT_LEAVE_WITHOUT_TRANSFER',
      'Group owner must transfer ownership to another member before leaving',
      400
    );
  }

  member.state = MemberStates.LEFT;
  member.leftAt = new Date();
  await member.save();

  conversation.memberCount = Math.max(0, activeCount - 1);
  if (conversation.memberCount === 0) {
    conversation.status = ConversationStatuses.CLOSED;
    conversation.closedAt = new Date();
    conversation.closeReason = 'All members left';
  }
  await conversation.save();

  return {
    conversationId: conversation._id.toString(),
    leftUserId: actorUserId.toString(),
    remainingMemberCount: conversation.memberCount,
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
  createGroupConversation,
  updateGroupMetadata,
  getGroupMembers,
  addGroupMembers,
  removeGroupMember,
  updateMemberRole,
  transferOwnership,
  leaveGroup,
  ConversationServiceError,
};

