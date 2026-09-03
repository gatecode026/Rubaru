const crypto = require('crypto');
const SocketEvents = require('./socketEvents');
const { sendMessage, MessageServiceError } = require('../services/messageService');
const { authorizeConversationAccess, ConversationAuthorizationError } = require('../services/conversationAuthorizationService');

// Socket Rate Limiting Map (in-memory per socket)
const socketRateLimits = new Map();

function checkSocketRateLimit(socketId, action = 'message', maxCount = 25, windowMs = 5000) {
  const now = Date.now();
  const key = `${socketId}:${action}`;
  let record = socketRateLimits.get(key);

  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    socketRateLimits.set(key, record);
    return true;
  }

  record.count += 1;
  if (record.count > maxCount) {
    return false;
  }
  return true;
}

/**
 * Clean up rate limit state on disconnect
 */
function cleanupSocketRateLimits(socketId) {
  for (const key of socketRateLimits.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      socketRateLimits.delete(key);
    }
  }
}

/**
 * Register Messaging Event Handlers for Authenticated Socket
 */
function registerMessagingHandlers(io, socket) {
  const userId = socket.data.userId;

  // ---------------------------------------------------------------------------
  // 1. CONVERSATION SUBSCRIBE
  // ---------------------------------------------------------------------------
  const handleSubscribe = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'subscribe', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many subscription requests. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      // Extract conversationId from versioned envelope, flat object, or raw string
      let conversationId = null;
      if (typeof payload === 'string') {
        conversationId = payload;
      } else if (payload && payload.data && payload.data.conversationId) {
        conversationId = payload.data.conversationId;
      } else if (payload && (payload.conversationId || payload.chatId)) {
        conversationId = payload.conversationId || payload.chatId;
      }

      if (!conversationId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId is required to subscribe',
          correlationId,
          retryable: false,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      // Authorize subscription via R3-02 centralized service
      await authorizeConversationAccess({
        actorUserId: userId,
        conversationId: conversationId.toString(),
        operation: 'VIEW',
      });

      // Join server-controlled rooms
      const canonicalRoom = `conversation:${conversationId}`;
      const legacyRoom = `chat_${conversationId}`;
      socket.join(canonicalRoom);
      socket.join(legacyRoom);

      const successResp = {
        ok: true,
        code: 'CONVERSATION_SUBSCRIBED',
        correlationId,
        data: {
          conversationId: conversationId.toString(),
        },
      };

      socket.emit(SocketEvents.CONVERSATION_SUBSCRIBED, successResp);
      return cb(successResp);
    } catch (error) {
      const code = error.code || 'CONVERSATION_SUBSCRIPTION_DENIED';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Subscription denied',
        correlationId,
        retryable: false,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. CONVERSATION UNSUBSCRIBE
  // ---------------------------------------------------------------------------
  const handleUnsubscribe = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      let conversationId = null;
      if (typeof payload === 'string') {
        conversationId = payload;
      } else if (payload && payload.data && payload.data.conversationId) {
        conversationId = payload.data.conversationId;
      } else if (payload && (payload.conversationId || payload.chatId)) {
        conversationId = payload.conversationId || payload.chatId;
      }

      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        socket.leave(`chat_${conversationId}`);
      }

      const successResp = {
        ok: true,
        code: 'CONVERSATION_UNSUBSCRIBED',
        correlationId,
        data: {
          conversationId: conversationId ? conversationId.toString() : null,
        },
      };
      return cb(successResp);
    } catch (error) {
      const errResp = {
        ok: false,
        code: 'UNSUBSCRIBE_ERROR',
        message: error.message,
        correlationId,
      };
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. REAL-TIME MESSAGE SENDING
  // ---------------------------------------------------------------------------
  const handleMessageSend = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'message_send', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Sending messages too rapidly. Please wait a moment.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      if (!payload || typeof payload !== 'object') {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'Invalid message payload',
          correlationId,
          retryable: false,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      // Extract payload parameters supporting both versioned envelope and legacy format
      const data = payload.data || payload;
      const conversationId = data.conversationId || data.chatId;
      const text = data.text || '';
      const type = data.type || 'TEXT';
      const mediaAssetId = data.mediaAssetId || null;
      const attachments = data.attachments || [];
      const clientMessageId = data.clientMessageId || `cmsg_${socket.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const replyToMessageId = data.replyToMessageId || data.replyTo || null;
      const poll = data.poll || null;

      // Call durable message persistence service
      const result = await sendMessage({
        actorUserId: userId,
        conversationId,
        clientMessageId,
        text,
        type,
        mediaAssetId,
        attachments,
        replyToMessageId,
        poll,
      });

      // Format canonical server acknowledgment
      const ackResp = {
        ok: true,
        code: 'MESSAGE_ACCEPTED',
        correlationId,
        data: {
          message: result.message,
          idempotentReplay: result.idempotentReplay,
        },
      };

      // Broadcast immediately to conversation room members for real-time responsiveness
      const messageCreatedEnvelope = {
        version: 1,
        eventId: `evt_${result.message.id}_${Date.now()}`,
        eventType: SocketEvents.MESSAGE_CREATED,
        occurredAt: new Date().toISOString(),
        correlationId,
        data: {
          message: result.message,
        },
      };

      io.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_CREATED, messageCreatedEnvelope);
      // Also emit on legacy event name for older frontend builds
      io.to(`chat_${conversationId}`).emit(SocketEvents.LEGACY_RECEIVE_MESSAGE, {
        id: result.message.id,
        chatId: result.message.conversationId,
        senderId: result.message.senderId,
        type: result.message.type,
        text: result.message.text,
        attachments: result.message.attachments,
        sequence: result.message.sequence,
        createdAt: result.message.createdAt,
      });

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'MESSAGE_NOT_ALLOWED';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Failed to send message',
        correlationId,
        retryable: false,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      socket.emit(SocketEvents.LEGACY_ERROR_MESSAGE, { message: error.message });
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. RECEIPT DELIVERED
  // ---------------------------------------------------------------------------
  const handleReceiptDelivered = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_del_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'receipt', 60, 5000)) {
        const errResp = {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many receipt updates. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const conversationId = payload && (payload.conversationId || (payload.data && payload.data.conversationId));
      const throughSequence = payload && (payload.throughSequence !== undefined ? payload.throughSequence : (payload.data && payload.data.throughSequence));

      const { advanceDeliveryWatermark } = require('../services/receiptService');
      const result = await advanceDeliveryWatermark({
        actorUserId: userId,
        conversationId,
        throughSequence,
      });

      const ackResp = {
        ok: true,
        data: result,
        correlationId,
      };

      if (result.changed) {
        const { dispatchOutboxReceiptUpdated } = require('../services/socketDispatchService');
        await dispatchOutboxReceiptUpdated({
          conversationId,
          actorUserId: userId,
          deliveredThroughSequence: result.deliveredThroughSequence,
          readThroughSequence: result.readThroughSequence,
          deliveredAt: result.deliveredAt,
          readAt: result.readAt,
          receiptType: 'DELIVERED',
        });
      }

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'RECEIPT_DELIVERY_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Failed to advance delivery watermark',
        correlationId,
        retryable: false,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. RECEIPT READ
  // ---------------------------------------------------------------------------
  const handleReceiptRead = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_read_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'receipt', 60, 5000)) {
        const errResp = {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many receipt updates. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const conversationId = payload && (payload.conversationId || (payload.data && payload.data.conversationId));
      const throughSequence = payload && (payload.throughSequence !== undefined ? payload.throughSequence : (payload.data && payload.data.throughSequence));

      const { advanceReadWatermark } = require('../services/receiptService');
      const result = await advanceReadWatermark({
        actorUserId: userId,
        conversationId,
        throughSequence,
      });

      const ackResp = {
        ok: true,
        data: result,
        correlationId,
      };

      if (result.changed) {
        const { dispatchOutboxReceiptUpdated } = require('../services/socketDispatchService');
        await dispatchOutboxReceiptUpdated({
          conversationId,
          actorUserId: userId,
          deliveredThroughSequence: result.deliveredThroughSequence,
          readThroughSequence: result.readThroughSequence,
          deliveredAt: result.deliveredAt,
          readAt: result.readAt,
          receiptType: 'READ',
        });
      }

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'RECEIPT_READ_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Failed to advance read watermark',
        correlationId,
        retryable: false,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. CONVERSATION SYNC / RECONNECT CATCH-UP
  // ---------------------------------------------------------------------------
  const handleConversationSync = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_sync_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'sync', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'RATE_LIMITED',
          message: 'Too many sync requests. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const conversationId = payload && (payload.conversationId || (payload.data && payload.data.conversationId));
      const afterSequence = payload && (payload.afterSequence !== undefined ? payload.afterSequence : (payload.data && payload.data.afterSequence));
      const cursor = payload && (payload.cursor || (payload.data && payload.data.cursor));
      const limit = payload && (payload.limit || (payload.data && payload.data.limit));

      const { syncConversationMessages, subscribeAndSyncHandshake } = require('../services/syncService');

      // Handshake and Room Join (R3-07-REQ-008)
      const handshake = await subscribeAndSyncHandshake({
        actorUserId: userId,
        conversationId,
        afterSequence,
      });

      if (!handshake.ok) {
        const errResp = {
          ok: false,
          code: handshake.code || 'CONVERSATION_ACCESS_REVOKED',
          message: handshake.message || 'Access revoked to conversation',
          correlationId,
          retryable: false,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      // Join rooms
      const canonicalRoom = `conversation:${conversationId}`;
      const legacyRoom = `chat_${conversationId}`;
      socket.join(canonicalRoom);
      socket.join(legacyRoom);

      // Perform bounded forward sync query
      const syncResult = await syncConversationMessages({
        actorUserId: userId,
        conversationId,
        afterSequence,
        cursor,
        limit: Math.min(50, limit || 20),
      });

      const ackResp = {
        ok: true,
        status: handshake.status,
        latestSequence: handshake.latestSequence,
        throughSequence: syncResult.throughSequence,
        data: syncResult,
        correlationId,
      };

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'CONVERSATION_SYNC_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Failed to synchronize conversation',
        correlationId,
        retryable: false,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 7. PRESENCE HEARTBEAT (R3-08-REQ-005)
  // ---------------------------------------------------------------------------
  const handlePresenceHeartbeat = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_hb_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'heartbeat', 60, 5000)) {
        const errResp = {
          ok: false,
          code: 'PRESENCE_RATE_LIMITED',
          message: 'Too many heartbeat requests. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const presenceService = require('../services/presenceService');
      const result = await presenceService.refreshSocketHeartbeat({
        userId,
        connectionId: socket.id,
      });

      const ackResp = {
        ok: result.ok,
        state: result.state,
        refreshed: result.refreshed,
        correlationId,
      };
      return cb(ackResp);
    } catch (error) {
      const errResp = {
        ok: false,
        code: error.code || 'PRESENCE_STORE_UNAVAILABLE',
        message: error.message,
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. PRESENCE SNAPSHOT (R3-08-REQ-010)
  // ---------------------------------------------------------------------------
  const handlePresenceSnapshot = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_psnap_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'presence_snapshot', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'PRESENCE_RATE_LIMITED',
          message: 'Too many presence snapshot requests. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const conversationId = payload && (payload.conversationId || (payload.data && payload.data.conversationId));
      if (!conversationId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId is required for presence snapshot',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const presenceService = require('../services/presenceService');
      const snapshot = await presenceService.getAuthorizedPresenceSnapshot({
        actorUserId: userId,
        conversationId,
      });

      const ackResp = {
        ok: true,
        correlationId,
        data: snapshot,
      };
      return cb(ackResp);
    } catch (error) {
      const code = error.code === 'CONVERSATION_NOT_FOUND' || error.code === 'MEMBERSHIP_REQUIRED'
        ? 'PRESENCE_ACCESS_DENIED'
        : (error.code || 'PRESENCE_ACCESS_DENIED');
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Presence snapshot failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 9. TYPING START (R3-08-REQ-015, R3-08-REQ-017, R3-08-REQ-018, R3-08-REQ-019)
  // ---------------------------------------------------------------------------
  const handleTypingStart = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_typ_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'typing_start', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'TYPING_RATE_LIMITED',
          message: 'Typing updates sent too rapidly. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const conversationId = payload && (payload.conversationId || (payload.data && payload.data.conversationId) || payload.chatId);
      if (!conversationId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId is required to start typing',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const typingService = require('../services/typingService');
      const result = await typingService.handleTypingStart({
        actorUserId: userId,
        conversationId,
        connectionId: socket.id,
      });

      if (result.isEffectiveTransition) {
        typingService.broadcastTypingUpdated(io, {
          conversationId,
          userId,
          isTyping: true,
          expiresAt: result.expiresAt,
          correlationId,
        });
      }

      const ackResp = {
        ok: true,
        isTyping: true,
        expiresAt: result.expiresAt,
        correlationId,
      };
      return cb(ackResp);
    } catch (error) {
      const code = error.code === 'CONVERSATION_NOT_FOUND' || error.code === 'MEMBERSHIP_REQUIRED'
        ? 'TYPING_ACCESS_DENIED'
        : (error.code || 'TYPING_ACCESS_DENIED');
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Typing start denied',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 10. TYPING STOP (R3-08-REQ-016, R3-08-REQ-018, R3-08-REQ-019)
  // ---------------------------------------------------------------------------
  const handleTypingStop = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_tstop_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'typing_stop', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'TYPING_RATE_LIMITED',
          message: 'Typing updates sent too rapidly. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const conversationId = payload && (payload.conversationId || (payload.data && payload.data.conversationId) || payload.chatId);
      if (!conversationId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId is required to stop typing',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const typingService = require('../services/typingService');
      const result = await typingService.handleTypingStop({
        actorUserId: userId,
        conversationId,
        connectionId: socket.id,
      });

      if (result.isEffectiveTransition) {
        typingService.broadcastTypingUpdated(io, {
          conversationId,
          userId,
          isTyping: false,
          correlationId,
        });
      }

      const ackResp = {
        ok: true,
        isTyping: false,
        correlationId,
      };
      return cb(ackResp);
    } catch (error) {
      const errResp = {
        ok: false,
        code: error.code || 'TYPING_ACCESS_DENIED',
        message: error.message || 'Typing stop failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 11. MESSAGE REACTION SET (R3-09-REQ-003, R3-09-REQ-006, R3-09-REQ-021)
  // ---------------------------------------------------------------------------
  const handleReactionSet = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_rx_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'reaction', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'INTERACTION_RATE_LIMITED',
          message: 'Too many reaction requests. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const data = payload.data || payload;
      const conversationId = data.conversationId;
      const messageId = data.messageId;
      const reaction = data.reaction;

      if (!conversationId || !messageId || !reaction) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId, messageId, and reaction are required',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const { addOrUpdateReaction } = require('../services/reactionService');
      const result = await addOrUpdateReaction({
        actorUserId: userId,
        conversationId,
        messageId,
        reaction,
      });

      const ackResp = {
        ok: true,
        code: 'REACTION_ACCEPTED',
        correlationId,
        data: result,
      };

      if (result.changed) {
        io.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_REACTION_UPDATED, {
          version: 1,
          eventId: `evt_rx_${messageId}_${userId}_${Date.now()}`,
          conversationId: conversationId.toString(),
          messageId: messageId.toString(),
          actorUserId: userId.toString(),
          reaction: result.reaction,
          operation: 'SET',
          reactionSummaryVersion: result.summary.version,
          reactionSummary: {
            total: result.summary.total,
            counts: result.summary.counts,
          },
          committedAt: new Date().toISOString(),
        });
      }

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'REACTION_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Reaction failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 12. MESSAGE REACTION REMOVE (R3-09-REQ-003, R3-09-REQ-006, R3-09-REQ-021)
  // ---------------------------------------------------------------------------
  const handleReactionRemove = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_rx_rem_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'reaction', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'INTERACTION_RATE_LIMITED',
          message: 'Too many reaction requests. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const data = payload.data || payload;
      const conversationId = data.conversationId;
      const messageId = data.messageId;

      if (!conversationId || !messageId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId and messageId are required',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const { removeReaction } = require('../services/reactionService');
      const result = await removeReaction({
        actorUserId: userId,
        conversationId,
        messageId,
      });

      const ackResp = {
        ok: true,
        code: 'REACTION_REMOVED',
        correlationId,
        data: result,
      };

      if (result.changed) {
        io.to(`conversation:${conversationId}`).emit(SocketEvents.MESSAGE_REACTION_UPDATED, {
          version: 1,
          eventId: `evt_rx_rem_${messageId}_${userId}_${Date.now()}`,
          conversationId: conversationId.toString(),
          messageId: messageId.toString(),
          actorUserId: userId.toString(),
          operation: 'REMOVE',
          reactionSummaryVersion: result.summary.version,
          reactionSummary: {
            total: result.summary.total,
            counts: result.summary.counts,
          },
          committedAt: new Date().toISOString(),
        });
      }

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'REACTION_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Reaction remove failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 13. POLL VOTE SET (R3-09-REQ-016, R3-09-REQ-019, R3-09-REQ-021)
  // ---------------------------------------------------------------------------
  const handlePollVoteSet = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_pv_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'poll_vote', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'INTERACTION_RATE_LIMITED',
          message: 'Too many poll votes. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const data = payload.data || payload;
      const conversationId = data.conversationId;
      const pollId = data.pollId;
      const optionIds = data.optionIds;

      if (!conversationId || !pollId || !optionIds) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId, pollId, and optionIds are required',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const { votePoll } = require('../services/pollService');
      const result = await votePoll({
        actorUserId: userId,
        conversationId,
        pollId,
        optionIds,
      });

      const ackResp = {
        ok: true,
        code: 'POLL_VOTE_ACCEPTED',
        correlationId,
        data: result,
      };

      if (result.changed) {
        io.to(`conversation:${conversationId}`).emit(SocketEvents.POLL_VOTE_UPDATED, {
          version: 1,
          eventId: `evt_pv_${pollId}_${userId}_${Date.now()}`,
          conversationId: conversationId.toString(),
          messageId: result.poll.messageId,
          pollId: pollId.toString(),
          pollVersion: result.poll.version,
          status: result.poll.status,
          totalVoters: result.poll.totalVoters,
          options: result.poll.options.map((o) => ({
            optionId: o.optionId,
            voteCount: o.voteCount,
          })),
          committedAt: new Date().toISOString(),
        });
      }

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'POLL_VOTE_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Poll vote failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 14. POLL VOTE REMOVE (R3-09-REQ-016, R3-09-REQ-019, R3-09-REQ-021)
  // ---------------------------------------------------------------------------
  const handlePollVoteRemove = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_pv_rem_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      if (!checkSocketRateLimit(socket.id, 'poll_vote', 30, 5000)) {
        const errResp = {
          ok: false,
          code: 'INTERACTION_RATE_LIMITED',
          message: 'Too many poll votes. Please slow down.',
          correlationId,
          retryable: true,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const data = payload.data || payload;
      const conversationId = data.conversationId;
      const pollId = data.pollId;

      if (!conversationId || !pollId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId and pollId are required',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const { removePollVote } = require('../services/pollService');
      const result = await removePollVote({
        actorUserId: userId,
        conversationId,
        pollId,
      });

      const ackResp = {
        ok: true,
        code: 'POLL_VOTE_REMOVED',
        correlationId,
        data: result,
      };

      if (result.changed) {
        io.to(`conversation:${conversationId}`).emit(SocketEvents.POLL_VOTE_UPDATED, {
          version: 1,
          eventId: `evt_pv_rem_${pollId}_${userId}_${Date.now()}`,
          conversationId: conversationId.toString(),
          messageId: result.poll.messageId,
          pollId: pollId.toString(),
          pollVersion: result.poll.version,
          status: result.poll.status,
          totalVoters: result.poll.totalVoters,
          options: result.poll.options.map((o) => ({
            optionId: o.optionId,
            voteCount: o.voteCount,
          })),
          committedAt: new Date().toISOString(),
        });
      }

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'POLL_VOTE_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Poll vote remove failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // ---------------------------------------------------------------------------
  // 15. POLL CLOSE (R3-09-REQ-017, R3-09-REQ-019, R3-09-REQ-021)
  // ---------------------------------------------------------------------------
  const handlePollClose = async (payload, callback) => {
    const correlationId = (payload && payload.correlationId) || `corr_pc_${Date.now()}`;
    const cb = typeof callback === 'function' ? callback : () => {};

    try {
      const data = payload.data || payload;
      const conversationId = data.conversationId;
      const pollId = data.pollId;

      if (!conversationId || !pollId) {
        const errResp = {
          ok: false,
          code: 'INVALID_EVENT_PAYLOAD',
          message: 'conversationId and pollId are required',
          correlationId,
        };
        socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
        return cb(errResp);
      }

      const { closePoll } = require('../services/pollService');
      const result = await closePoll({
        actorUserId: userId,
        conversationId,
        pollId,
      });

      const ackResp = {
        ok: true,
        code: 'POLL_CLOSED',
        correlationId,
        data: result,
      };

      io.to(`conversation:${conversationId}`).emit(SocketEvents.POLL_CLOSED, {
        version: 1,
        eventId: `evt_pc_${pollId}_${Date.now()}`,
        conversationId: conversationId.toString(),
        messageId: result.poll.messageId,
        pollId: pollId.toString(),
        pollVersion: result.poll.version,
        status: 'CLOSED',
        closedAt: result.poll.closedAt,
        closedByUserId: userId.toString(),
        committedAt: new Date().toISOString(),
      });

      return cb(ackResp);
    } catch (error) {
      const code = error.code || 'POLL_CLOSE_ERROR';
      const errResp = {
        ok: false,
        code,
        message: error.message || 'Poll close failed',
        correlationId,
      };
      socket.emit(SocketEvents.MESSAGING_ERROR, errResp);
      return cb(errResp);
    }
  };

  // Register Canonical Events
  socket.on(SocketEvents.CONVERSATION_SUBSCRIBE, handleSubscribe);
  socket.on(SocketEvents.CONVERSATION_UNSUBSCRIBE, handleUnsubscribe);
  socket.on(SocketEvents.MESSAGE_SEND, handleMessageSend);
  socket.on(SocketEvents.RECEIPT_DELIVERED, handleReceiptDelivered);
  socket.on(SocketEvents.RECEIPT_READ, handleReceiptRead);
  socket.on(SocketEvents.CONVERSATION_SYNC, handleConversationSync);
  socket.on(SocketEvents.PRESENCE_HEARTBEAT, handlePresenceHeartbeat);
  socket.on(SocketEvents.PRESENCE_SNAPSHOT, handlePresenceSnapshot);
  socket.on(SocketEvents.TYPING_START, handleTypingStart);
  socket.on(SocketEvents.TYPING_STOP, handleTypingStop);
  socket.on(SocketEvents.MESSAGE_REACTION_SET, handleReactionSet);
  socket.on(SocketEvents.MESSAGE_REACTION_REMOVE, handleReactionRemove);
  socket.on(SocketEvents.POLL_VOTE_SET, handlePollVoteSet);
  socket.on(SocketEvents.POLL_VOTE_REMOVE, handlePollVoteRemove);
  socket.on(SocketEvents.POLL_CLOSE, handlePollClose);

  // Register Backward Compatibility Event Aliases
  socket.on(SocketEvents.LEGACY_JOIN_CHAT, handleSubscribe);
  socket.on(SocketEvents.LEGACY_LEAVE_CHAT, handleUnsubscribe);
  socket.on(SocketEvents.LEGACY_SEND_MESSAGE, handleMessageSend);
  socket.on(SocketEvents.LEGACY_MESSAGE_DELIVERED, handleReceiptDelivered);
  socket.on(SocketEvents.LEGACY_MESSAGE_READ, handleReceiptRead);
  socket.on('heartbeat', handlePresenceHeartbeat);
  socket.on(SocketEvents.LEGACY_TYPING_START, handleTypingStart);
  socket.on(SocketEvents.LEGACY_TYPING_STOP, handleTypingStop);

  // Clean up on disconnect
  socket.on('disconnect', () => {
    cleanupSocketRateLimits(socket.id);
  });
}

module.exports = {
  registerMessagingHandlers,
};
