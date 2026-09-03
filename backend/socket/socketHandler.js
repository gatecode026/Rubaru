const { socketAuthMiddleware } = require('./socketAuth');
const { registerMessagingHandlers } = require('./messagingSocketHandler');
const { registerCallingHandlers } = require('./callingSocketHandler');
const { setSocketIO } = require('../services/socketDispatchService');
const presenceService = require('../services/presenceService');
const typingService = require('../services/typingService');

// Map of userId -> primary socket ID for quick peer-to-peer call lookups
const userSocketMap = new Map();

/**
 * Authoritative Socket.io Setup and Connection Handler
 */
const socketHandler = (io) => {
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
