/**
 * Centralized Ephemeral Typing Indicators Service
 * R3-08-REQ-014, R3-08-REQ-015, R3-08-REQ-016, R3-08-REQ-017, R3-08-REQ-018,
 * R3-08-REQ-019, R3-08-REQ-020, R3-08-REQ-021, R3-08-REQ-022
 */

const { getPresenceStore } = require('./presenceStore');
const { authorizeConversationAccess, ConversationAuthorizationError } = require('./conversationAuthorizationService');
const SocketEvents = require('../socket/socketEvents');

class TypingServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'TypingServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Handle Start Typing Command
 * R3-08-REQ-015, R3-08-REQ-017, R3-08-REQ-018, R3-08-REQ-019
 */
async function handleTypingStart({ actorUserId, conversationId, connectionId }) {
  if (!actorUserId) {
    throw new TypingServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required to send typing indicators', 401);
  }

  if (!conversationId) {
    throw new TypingServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }

  // 1. Authorize actor has SEND_MESSAGE permission and conversation is active
  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'SEND_MESSAGE',
  });

  // 2. Update ephemeral typing store
  const store = getPresenceStore();
  const result = await store.startTyping(conversationId, actorUserId, connectionId);

  return {
    ok: !result.degraded,
    isEffectiveTransition: result.isEffectiveTransition,
    expiresAt: result.expiresAt,
    conversationId: conversationId.toString(),
    userId: actorUserId.toString(),
  };
}

/**
 * Handle Stop Typing Command
 * R3-08-REQ-016, R3-08-REQ-018, R3-08-REQ-019
 */
async function handleTypingStop({ actorUserId, conversationId, connectionId }) {
  if (!actorUserId || !conversationId) {
    return { ok: true, isEffectiveTransition: false };
  }

  const store = getPresenceStore();
  const result = await store.stopTyping(conversationId, actorUserId, connectionId);

  return {
    ok: !result.degraded,
    isEffectiveTransition: result.isEffectiveTransition,
    conversationId: conversationId.toString(),
    userId: actorUserId.toString(),
  };
}

/**
 * Clear all active typing leases for a conversation (e.g. on block, unmatch, revocation)
 * R3-08-REQ-021
 */
async function clearConversationTyping(conversationId, userId = null) {
  const store = getPresenceStore();
  return store.clearConversationTyping(conversationId, userId);
}

/**
 * Clear all active typing leases for a socket connection (e.g. on disconnect)
 */
async function clearSocketTyping(connectionId) {
  const store = getPresenceStore();
  return store.clearSocketTyping(connectionId);
}

/**
 * Get active typing users in a conversation
 */
async function getActiveTypingUsers(conversationId) {
  const store = getPresenceStore();
  return store.getTypingUsers(conversationId);
}

/**
 * Broadcast Typing Updated Event to Conversation Room
 * R3-08-REQ-019, R3-08-REQ-020
 */
function broadcastTypingUpdated(io, { conversationId, userId, isTyping, expiresAt = null, correlationId = null }) {
  if (!io || !conversationId || !userId) return;

  const convIdStr = conversationId.toString();
  const userIdStr = userId.toString();

  const payload = {
    version: 1,
    conversationId: convIdStr,
    userId: userIdStr,
    isTyping: !!isTyping,
    ...(isTyping && expiresAt ? { expiresAt } : {}),
    ...(correlationId ? { correlationId } : {}),
  };

  // Emit to canonical room and legacy room
  io.to(`conversation:${convIdStr}`).emit(SocketEvents.TYPING_UPDATED, payload);
  io.to(`chat_${convIdStr}`).emit('user_typing', {
    chatId: convIdStr,
    userId: userIdStr,
    isTyping: !!isTyping,
  });
}

module.exports = {
  TypingServiceError,
  handleTypingStart,
  handleTypingStop,
  clearConversationTyping,
  clearSocketTyping,
  getActiveTypingUsers,
  broadcastTypingUpdated,
};
