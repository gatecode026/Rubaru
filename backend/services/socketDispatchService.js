const SocketEvents = require('../socket/socketEvents');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Block = require('../models/Block');
const { MemberStates, ConversationStatuses } = require('../models/enums');

let activeIoInstance = null;

/**
 * Bind active Socket.io instance for outbox event dispatches
 */
function setSocketIO(io) {
  activeIoInstance = io;
}

/**
 * Get active Socket.io instance
 */
function getSocketIO() {
  return activeIoInstance;
}

/**
 * Dispatch committed message.created outbox event to authorized real-time recipients
 * @param {Object} payload - Outbox event payload
 */
async function dispatchOutboxMessageCreated(payload) {
  if (!activeIoInstance) {
    return { dispatched: false, reason: 'SOCKET_IO_NOT_INITIALIZED' };
  }

  const { conversationId, messageId, senderId, clientMessageId, sequence, type, text, attachments = [], createdAt } = payload || {};

  if (!conversationId || !messageId) {
    return { dispatched: false, reason: 'INVALID_PAYLOAD' };
  }

  // 1. Verify Conversation is still active
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || conversation.status !== ConversationStatuses.ACTIVE) {
    return { dispatched: false, reason: 'CONVERSATION_NOT_ACTIVE' };
  }

  // 2. Fetch Active Conversation Members
  const activeMembers = await ConversationMember.find({
    conversationId,
    state: MemberStates.ACTIVE,
  }).lean();

  if (!activeMembers || activeMembers.length === 0) {
    return { dispatched: false, reason: 'NO_ACTIVE_MEMBERS' };
  }

  // 3. Build Versioned Event Envelope
  const eventEnvelope = {
    version: 1,
    eventId: `evt_${messageId}_${Date.now()}`,
    eventType: SocketEvents.MESSAGE_CREATED,
    occurredAt: new Date().toISOString(),
    correlationId: `outbox_${messageId}`,
    data: {
      message: {
        id: messageId.toString(),
        conversationId: conversationId.toString(),
        senderId: senderId.toString(),
        clientMessageId: clientMessageId || null,
        sequence: sequence || 0,
        type: type || 'TEXT',
        text: text || '',
        attachments: attachments || [],
        status: 'ACTIVE',
        createdAt: createdAt || new Date().toISOString(),
      },
    },
  };

  // 4. Emit to Canonical Conversation Room
  activeIoInstance.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_CREATED, eventEnvelope);

  // 5. Emit to Member User Rooms (for multi-device consistency)
  for (const member of activeMembers) {
    const memUserId = (member.userId || member.user).toString();
    activeIoInstance.to(`user:${memUserId}`).emit(SocketEvents.MESSAGE_CREATED, eventEnvelope);
  }

  return {
    dispatched: true,
    recipientCount: activeMembers.length,
  };
}

/**
 * Revoke conversation room access and notify participants when a conversation is closed or users blocked
 * @param {Object} params
 * @param {string} params.conversationId - Conversation ID
 * @param {string} [params.reason='CONVERSATION_UNAVAILABLE'] - Privacy safe reason
 */
async function dispatchConversationRevoked({ conversationId, reason = 'CONVERSATION_UNAVAILABLE' }) {
  if (!activeIoInstance) return;

  const revocationEnvelope = {
    version: 1,
    eventId: `evt_revoked_${conversationId}_${Date.now()}`,
    eventType: SocketEvents.CONVERSATION_REVOKED,
    occurredAt: new Date().toISOString(),
    data: {
      conversationId: conversationId.toString(),
      reason,
    },
  };

  // Notify connected sockets in the conversation room
  const canonicalRoom = `conversation:${conversationId}`;
  const legacyRoom = `chat_${conversationId}`;

  activeIoInstance.to(canonicalRoom).emit(SocketEvents.CONVERSATION_REVOKED, revocationEnvelope);
  activeIoInstance.to(legacyRoom).emit(SocketEvents.CONVERSATION_REVOKED, revocationEnvelope);

  // Evict sockets from room
  const sockets = await activeIoInstance.in(canonicalRoom).fetchSockets();
  for (const s of sockets) {
    s.leave(canonicalRoom);
    s.leave(legacyRoom);
  }
}

/**
 * Dispatch committed watermark update event to authorized real-time participants and user rooms
 * R3-06-REQ-013, R3-06-REQ-014, R3-06-REQ-017
 * @param {Object} payload - Outbox event payload
 */
async function dispatchOutboxReceiptUpdated(payload) {
  if (!activeIoInstance) {
    return { dispatched: false, reason: 'SOCKET_IO_NOT_INITIALIZED' };
  }

  const { conversationId, actorUserId, deliveredThroughSequence, readThroughSequence, deliveredAt, readAt, receiptType } = payload || {};

  if (!conversationId || !actorUserId) {
    return { dispatched: false, reason: 'INVALID_PAYLOAD' };
  }

  // 1. Fetch Active Conversation Members
  const activeMembers = await ConversationMember.find({
    conversationId,
    state: MemberStates.ACTIVE,
  }).lean();

  if (!activeMembers || activeMembers.length === 0) {
    return { dispatched: false, reason: 'NO_ACTIVE_MEMBERS' };
  }

  // 2. Build Versioned Event Envelope
  const eventEnvelope = {
    version: 1,
    eventId: `evt_rcpt_${conversationId}_${actorUserId}_${Date.now()}`,
    eventType: SocketEvents.RECEIPT_WATERMARK_UPDATED,
    occurredAt: new Date().toISOString(),
    data: {
      conversationId: conversationId.toString(),
      actorUserId: actorUserId.toString(),
      deliveredThroughSequence: deliveredThroughSequence || 0,
      readThroughSequence: readThroughSequence || 0,
      deliveredAt: deliveredAt || null,
      readAt: readAt || null,
      receiptType: receiptType || 'DELIVERED',
    },
  };

  // 3. Emit to Canonical Conversation Room
  activeIoInstance.to(`conversation:${conversationId}`).emit(SocketEvents.RECEIPT_WATERMARK_UPDATED, eventEnvelope);

  // 4. Emit to Member User Rooms (for multi-device consistency)
  for (const member of activeMembers) {
    const memUserId = (member.userId || member.user).toString();
    activeIoInstance.to(`user:${memUserId}`).emit(SocketEvents.RECEIPT_WATERMARK_UPDATED, eventEnvelope);
  }

  // 5. Emit legacy compatibility events
  if (receiptType === 'READ') {
    activeIoInstance.to(`conversation:${conversationId}`).emit(SocketEvents.LEGACY_MESSAGE_READ, {
      chatId: conversationId.toString(),
      userId: actorUserId.toString(),
      sequence: readThroughSequence,
    });
  } else {
    activeIoInstance.to(`conversation:${conversationId}`).emit(SocketEvents.LEGACY_MESSAGE_DELIVERED, {
      chatId: conversationId.toString(),
      userId: actorUserId.toString(),
      sequence: deliveredThroughSequence,
    });
  }

  return {
    dispatched: true,
    recipientCount: activeMembers.length,
  };
}

/**
 * Dispatch real-time Reel/Content Like counter update
 */
function dispatchSocialLikeUpdated({ contentId, likesCount, userId, isLiked }) {
  if (!activeIoInstance || !contentId) return;
  const payload = {
    reelId: contentId.toString(),
    contentId: contentId.toString(),
    likesCount: Number(likesCount) || 0,
    userId: userId ? userId.toString() : null,
    isLiked: Boolean(isLiked),
    timestamp: new Date().toISOString(),
  };
  activeIoInstance.emit('reel_like_updated', payload);
  activeIoInstance.emit('content_like_updated', payload);
}

/**
 * Dispatch real-time Reel/Content Comment added event
 */
function dispatchSocialCommentAdded({ contentId, comment, commentsCount }) {
  if (!activeIoInstance || !contentId) return;
  const payload = {
    reelId: contentId.toString(),
    contentId: contentId.toString(),
    comment,
    commentsCount: Number(commentsCount) || 0,
    timestamp: new Date().toISOString(),
  };
  activeIoInstance.emit('reel_comment_added', payload);
  activeIoInstance.emit('post_comment_added', payload);
}

/**
 * Dispatch real-time Reel/Content Comment deleted event
 */
function dispatchSocialCommentDeleted({ contentId, commentId, commentsCount }) {
  if (!activeIoInstance || !contentId) return;
  const payload = {
    reelId: contentId.toString(),
    contentId: contentId.toString(),
    commentId: commentId ? commentId.toString() : null,
    commentsCount: Number(commentsCount) || 0,
    timestamp: new Date().toISOString(),
  };
  activeIoInstance.emit('reel_comment_deleted', payload);
  activeIoInstance.emit('post_comment_deleted', payload);
}

module.exports = {
  setSocketIO,
  getSocketIO,
  dispatchOutboxMessageCreated,
  dispatchOutboxReceiptUpdated,
  dispatchConversationRevoked,
  dispatchSocialLikeUpdated,
  dispatchSocialCommentAdded,
  dispatchSocialCommentDeleted,
};
