/**
 * Centralized Real-Time Presence Service
 * R3-08-REQ-001, R3-08-REQ-003, R3-08-REQ-004, R3-08-REQ-006, R3-08-REQ-008,
 * R3-08-REQ-009, R3-08-REQ-010, R3-08-REQ-011, R3-08-REQ-012, R3-08-REQ-013
 */

const { getPresenceStore } = require('./presenceStore');
const { authorizeConversationAccess, ConversationAuthorizationError } = require('./conversationAuthorizationService');
const ConversationMember = require('../models/ConversationMember');
const SocketEvents = require('../socket/socketEvents');
const { MemberStates } = require('../models/enums');

class PresenceServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'PresenceServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Handle socket connection registration
 * Returns { isFirstConnection, totalConnections, state }
 */
async function registerSocketConnection({ userId, connectionId, metadata = {} }) {
  if (!userId || !connectionId) {
    throw new PresenceServiceError('INVALID_PRESENCE_PARAMS', 'userId and connectionId are required', 400);
  }

  const store = getPresenceStore();
  const regResult = await store.registerConnection(userId, connectionId, metadata);

  if (regResult.degraded) {
    return {
      state: 'UNKNOWN',
      isFirstConnection: false,
      totalConnections: 0,
    };
  }

  return {
    state: 'ONLINE',
    isFirstConnection: regResult.isFirstConnection,
    totalConnections: regResult.totalConnections,
  };
}

/**
 * Handle heartbeat refresh for an active socket connection
 */
async function refreshSocketHeartbeat({ userId, connectionId }) {
  if (!userId || !connectionId) {
    throw new PresenceServiceError('INVALID_PRESENCE_PARAMS', 'userId and connectionId are required', 400);
  }

  const store = getPresenceStore();
  const refreshResult = await store.refreshConnection(userId, connectionId);

  if (refreshResult.notFound) {
    // If not found in store, re-register lease
    const regResult = await store.registerConnection(userId, connectionId);
    return {
      ok: true,
      refreshed: true,
      state: regResult.degraded ? 'UNKNOWN' : 'ONLINE',
    };
  }

  return {
    ok: !refreshResult.degraded,
    refreshed: refreshResult.refreshed,
    state: refreshResult.degraded ? 'UNKNOWN' : 'ONLINE',
  };
}

/**
 * Handle socket disconnection
 * Returns { isLastDisconnect, remainingConnections, state, lastSeenAt }
 */
async function removeSocketConnection({ userId, connectionId }) {
  if (!userId || !connectionId) {
    return { isLastDisconnect: false, remainingConnections: 0, state: 'OFFLINE' };
  }

  const store = getPresenceStore();
  const removeResult = await store.removeConnection(userId, connectionId);

  if (removeResult.degraded) {
    return {
      state: 'UNKNOWN',
      isLastDisconnect: false,
      remainingConnections: 0,
      lastSeenAt: null,
    };
  }

  let lastSeenAt = null;
  if (removeResult.isLastDisconnect) {
    lastSeenAt = new Date();
    await store.setLastSeen(userId, lastSeenAt);
  }

  return {
    state: removeResult.isLastDisconnect ? 'OFFLINE' : 'ONLINE',
    isLastDisconnect: removeResult.isLastDisconnect,
    remainingConnections: removeResult.remainingConnections,
    lastSeenAt: lastSeenAt ? lastSeenAt.toISOString() : null,
  };
}

/**
 * Get Authorized Presence Snapshot for a Conversation
 * R3-08-REQ-008, R3-08-REQ-009, R3-08-REQ-010
 */
async function getAuthorizedPresenceSnapshot({ actorUserId, conversationId }) {
  if (!actorUserId) {
    throw new PresenceServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  if (!conversationId) {
    throw new PresenceServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }

  // Authorize actor access to conversation
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const conversation = authContext.conversation;

  // Retrieve all active members for this conversation
  const members = await ConversationMember.find({
    conversationId: conversation._id,
    state: MemberStates.ACTIVE,
  }).select('userId state role');

  const store = getPresenceStore();
  const memberPresenceList = [];

  for (const member of members) {
    const mUserId = member.userId.toString();
    const presence = await store.getUserPresence(mUserId);

    // If member is actor, report state directly
    if (mUserId === actorUserId.toString()) {
      memberPresenceList.push({
        userId: mUserId,
        state: presence.state,
        lastSeenAt: presence.lastSeenAt,
      });
      continue;
    }

    // Visibility rules: Presence is visible to active authorized participants of the conversation
    // Unavailable fallback if store degraded or privacy hidden
    if (presence.state === 'UNKNOWN') {
      memberPresenceList.push({
        userId: mUserId,
        state: 'UNKNOWN',
        lastSeenAt: null,
      });
    } else {
      memberPresenceList.push({
        userId: mUserId,
        state: presence.state,
        lastSeenAt: presence.lastSeenAt,
      });
    }
  }

  return {
    version: 1,
    conversationId: conversation._id.toString(),
    members: memberPresenceList,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get User's Active Authorized Conversation IDs for Presence Broadcast Fan-out
 */
async function getUserActiveConversationIds(userId) {
  const activeMemberships = await ConversationMember.find({
    userId,
    state: MemberStates.ACTIVE,
  }).select('conversationId');

  return activeMemberships.map((m) => m.conversationId.toString());
}

/**
 * Dispatch Presence Updated Event across Socket.io
 * R3-08-REQ-011
 */
async function broadcastPresenceUpdated(io, { userId, state, lastSeenAt = null }) {
  if (!io || !userId) return;

  const changedAt = new Date().toISOString();
  const payload = {
    version: 1,
    userId: userId.toString(),
    state, // 'ONLINE' or 'OFFLINE'
    changedAt,
    ...(state === 'OFFLINE' && lastSeenAt ? { lastSeenAt } : {}),
  };

  // Find all active conversation rooms user is in
  const conversationIds = await getUserActiveConversationIds(userId);

  for (const convId of conversationIds) {
    io.to(`conversation:${convId}`).emit(SocketEvents.PRESENCE_UPDATED, payload);
    // Legacy room broadcast
    io.to(`chat_${convId}`).emit('presence_updated', payload);
  }
}

module.exports = {
  PresenceServiceError,
  registerSocketConnection,
  refreshSocketHeartbeat,
  removeSocketConnection,
  getAuthorizedPresenceSnapshot,
  getUserActiveConversationIds,
  broadcastPresenceUpdated,
};
