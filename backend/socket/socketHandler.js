const { socketAuthMiddleware } = require('./socketAuth');
const { registerMessagingHandlers } = require('./messagingSocketHandler');
const { registerCallingHandlers } = require('./callingSocketHandler');
const { registerPaidCommunicationHandlers } = require('./paidCommunicationSocketHandler');
const { setSocketIO } = require('../services/socketDispatchService');
const presenceService = require('../services/presenceService');
const typingService = require('../services/typingService');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getPublisherClient, getSubscriberClient } = require('../config/redis');

// Map of userId -> primary socket ID for backward-compatible peer lookups
const userSocketMap = new Map();

/**
 * Authoritative Socket.io Setup and Connection Handler
 */
const socketHandler = (io) => {
  // Bind Redis adapter for multi-instance distributed communication
  try {
    const pubClient = getPublisherClient();
    const subClient = getSubscriberClient();
    if (pubClient && subClient && typeof pubClient.publish === 'function' && typeof subClient.subscribe === 'function') {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[SOCKET] Redis multi-instance adapter successfully attached.');
    }
  } catch (adapterErr) {
    console.warn('[SOCKET ADAPTER] Redis adapter attachment note:', adapterErr.message);
  }

  // Bind Socket.io instance to outbox dispatcher
  setSocketIO(io);

  // 1. Authoritative Handshake Authentication Middleware
  io.use(socketAuthMiddleware);

  // 2. Connection Lifecycle Handler
  io.on('connection', (socket) => {
    const userId = socket.data.userId;

    // Track active socket mapping
    userSocketMap.set(userId, socket.id);

    // Join authoritative server-controlled user rooms (supports multiple devices per user)
    socket.join(`user:${userId}`);
    socket.join(`user_${userId}`); // Backward compatibility

    console.log(`[SOCKET] User connected: ${userId} (Socket ID: ${socket.id})`);

    // Register Presence connection lease
    presenceService.registerSocketConnection({ userId, connectionId: socket.id })
      .then((res) => {
        if (res.isFirstConnection) {
          presenceService.broadcastPresenceUpdated(io, { userId, state: 'ONLINE' });
        }
      })
      .catch((err) => {
        console.warn('[SOCKET PRESENCE] Connection register error:', err.message);
      });

    // 3. Register Domain Handlers
    registerMessagingHandlers(io, socket);
    registerCallingHandlers(io, socket, userSocketMap);
    registerPaidCommunicationHandlers(io, socket);

    // 4. Disconnection Cleanup
    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] User disconnected: ${userId} (Reason: ${reason})`);
      if (userSocketMap.get(userId) === socket.id) {
        userSocketMap.delete(userId);
      }

      // Ephemeral presence disconnect processing
      presenceService.removeSocketConnection({ userId, connectionId: socket.id })
        .then((res) => {
          if (res.isLastDisconnect) {
            presenceService.broadcastPresenceUpdated(io, {
              userId,
              state: 'OFFLINE',
              lastSeenAt: res.lastSeenAt,
            });
          }
        })
        .catch((err) => {
          console.warn('[SOCKET PRESENCE] Disconnect cleanup error:', err.message);
        });

      // Clear any typing leases held by this disconnected socket
      typingService.clearSocketTyping(socket.id)
        .then((stoppedList) => {
          if (Array.isArray(stoppedList)) {
            for (const item of stoppedList) {
              typingService.broadcastTypingUpdated(io, {
                conversationId: item.conversationId,
                userId: item.userId,
                isTyping: false,
              });
            }
          }
        })
        .catch((err) => {
          console.warn('[SOCKET TYPING] Disconnect typing cleanup error:', err.message);
        });
    });
  });
};

module.exports = socketHandler;
