const paidCommunicationService = require('../services/paidCommunicationService');
const walletService = require('../services/walletService');

/**
 * Register Real-Time Socket.io Handlers for Paid Communication
 */
function registerPaidCommunicationHandlers(io, socket) {
  const userId = socket.data ? socket.data.userId : (socket.user ? socket.user._id.toString() : null);

  if (!userId) {
    console.warn('[SOCKET PAID COMM] Socket connected without authenticated user ID');
    return;
  }

  // 1. Client initiates a paid communication session
  socket.on('paid_session.initiate', async (data, callback) => {
    try {
      const { receiverId, conversationId, communicationType } = data || {};
      const session = await paidCommunicationService.initiatePaidSession({
        initiatorId: userId,
        receiverId,
        conversationId: conversationId || null,
        communicationType,
      });

      socket.join(`paid_session:${session.sessionId}`);

      // Emit to receiver's user room
      io.to(`user:${receiverId}`).emit('paid_session.requested', {
        sessionId: session.sessionId,
        initiatorId: userId,
        receiverId,
        communicationType,
        ratePerMinute: session.ratePerMinuteSnapshot,
        requestExpiresAt: session.requestExpiresAt,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, data: session });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });

  // 2. Client accepts a paid session request
  socket.on('paid_session.accept', async (data, callback) => {
    try {
      const { sessionId } = data || {};
      const session = await paidCommunicationService.acceptPaidSession({
        receiverId: userId,
        sessionId,
      });

      socket.join(`paid_session:${sessionId}`);

      io.to(`user:${session.initiatorId}`).emit('paid_session.accepted', {
        sessionId: session.sessionId,
        receiverId: userId,
        acceptedAt: session.acceptedAt,
      });

      io.to(`paid_session:${sessionId}`).emit('paid_session.accepted', {
        sessionId: session.sessionId,
        receiverId: userId,
        acceptedAt: session.acceptedAt,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, data: session });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });

  // 3. Client declines a paid session request
  socket.on('paid_session.decline', async (data, callback) => {
    try {
      const { sessionId, reason } = data || {};
      const session = await paidCommunicationService.declinePaidSession({
        receiverId: userId,
        sessionId,
        reason,
      });

      io.to(`user:${session.initiatorId}`).emit('paid_session.declined', {
        sessionId: session.sessionId,
        receiverId: userId,
        reason: session.endReason,
      });

      io.to(`paid_session:${sessionId}`).emit('paid_session.declined', {
        sessionId: session.sessionId,
        receiverId: userId,
        reason: session.endReason,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, data: session });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });

  // 4. Client cancels a paid session request
  socket.on('paid_session.cancel', async (data, callback) => {
    try {
      const { sessionId, reason } = data || {};
      const session = await paidCommunicationService.cancelPaidSession({
        initiatorId: userId,
        sessionId,
        reason,
      });

      io.to(`user:${session.receiverId}`).emit('paid_session.ended', {
        sessionId: session.sessionId,
        endReason: session.endReason,
      });

      io.to(`paid_session:${sessionId}`).emit('paid_session.ended', {
        sessionId: session.sessionId,
        endReason: session.endReason,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, data: session });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });

  // 5. Participant reports connected
  socket.on('paid_session.connected', async (data, callback) => {
    try {
      const { sessionId } = data || {};
      socket.join(`paid_session:${sessionId}`);

      const session = await paidCommunicationService.markParticipantConnected({
        userId,
        sessionId,
      });

      if (session.status === 'ACTIVE') {
        io.to(`user:${session.initiatorId}`).emit('paid_session.active', {
          sessionId: session.sessionId,
          connectedAt: session.connectedAt,
          billedMinutes: session.billedMinutes,
          nextChargeAt: session.nextChargeAt,
        });
        io.to(`user:${session.receiverId}`).emit('paid_session.active', {
          sessionId: session.sessionId,
          connectedAt: session.connectedAt,
          billedMinutes: session.billedMinutes,
          nextChargeAt: session.nextChargeAt,
        });
        io.to(`paid_session:${sessionId}`).emit('paid_session.active', {
          sessionId: session.sessionId,
          connectedAt: session.connectedAt,
          billedMinutes: session.billedMinutes,
          nextChargeAt: session.nextChargeAt,
        });
      }

      if (typeof callback === 'function') {
        callback({ ok: true, data: session });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });

  // 6. Participant sends heartbeat
  socket.on('paid_session.heartbeat', async (data, callback) => {
    try {
      const { sessionId } = data || {};
      const result = await paidCommunicationService.recordSessionHeartbeat({
        userId,
        sessionId,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, data: result });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });

  // 7. Participant explicitly ends session
  socket.on('paid_session.end', async (data, callback) => {
    try {
      const { sessionId, reason } = data || {};
      const session = await paidCommunicationService.endPaidSession({
        actorUserId: userId,
        sessionId,
        endReason: reason,
      });

      io.to(`user:${session.initiatorId}`).emit('paid_session.ended', {
        sessionId: session.sessionId,
        billedMinutes: session.billedMinutes,
        totalCoinsCharged: session.totalCoinsCharged,
        endedAt: session.endedAt,
        endReason: session.endReason,
      });
      io.to(`user:${session.receiverId}`).emit('paid_session.ended', {
        sessionId: session.sessionId,
        billedMinutes: session.billedMinutes,
        totalCoinsEarned: session.totalCoinsEarned,
        endedAt: session.endedAt,
        endReason: session.endReason,
      });
      io.to(`paid_session:${sessionId}`).emit('paid_session.ended', {
        sessionId: session.sessionId,
        billedMinutes: session.billedMinutes,
        totalCoinsCharged: session.totalCoinsCharged,
        endedAt: session.endedAt,
        endReason: session.endReason,
      });

      if (typeof callback === 'function') {
        callback({ ok: true, data: session });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({
          ok: false,
          code: err.code || 'INTERNAL_ERROR',
          message: err.message,
        });
      }
    }
  });
}

module.exports = {
  registerPaidCommunicationHandlers,
};
