const Profile = require('../models/Profile');
const Message = require('../models/Message');
const SocketEvents = require('./socketEvents');
const callService = require('../services/callService');
const walletService = require('../services/walletService');
const callLockService = require('../services/callLockService');
const callRateLimiter = require('../services/callRateLimiter');
const callMetrics = require('../services/callMetrics');
const turnService = require('../services/turnService');
const {
  formatAckSuccess,
  formatAckError,
  validateInitiatePayload,
  validateAcceptPayload,
  validateRejectPayload,
  validateCancelPayload,
  validateOfferPayload,
  validateAnswerPayload,
  validateIcePayload,
  validateMediaReadyPayload,
  validateEndPayload,
} = require('./callSocketUtils');
const { CallEndReasons, CallDomainErrors, CallStatuses } = require('../models/enums');

/**
 * Register Production-Ready Secure Calling & WebRTC Signaling Handlers
 */
function registerCallingHandlers(io, socket, userSocketMap) {
  const userId = socket.data ? socket.data.userId : (socket.user ? socket.user._id.toString() : null);

  if (!userId) {
    console.warn('[SOCKET CALL] Rejecting unauthenticated socket connection');
    return;
  }

  // ===========================================================================
  // 1. CANONICAL CALL INITIATION (call:initiate)
  // ===========================================================================
  socket.on(SocketEvents.CALL_INITIATE, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    callMetrics.increment('initiation_attempts');
    const validation = validateInitiatePayload(data);

    if (!validation.valid) {
      await callRateLimiter.checkInvalidAttempts(userId);
      callMetrics.increment('denied_initiations');
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { recipientId, callType, idempotencyKey, requestId } = validation.data;

    try {
      // 1. Enforce distributed rate limits
      const initLimit = await callRateLimiter.checkCallInitiation(userId);
      if (!initLimit.allowed) {
        callMetrics.increment('rate_limit_blocks');
        return cb(formatAckError(requestId, { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many call initiation attempts. Please slow down.' }));
      }
      const targetLimit = await callRateLimiter.checkTargetedInitiation(userId, recipientId);
      if (!targetLimit.allowed) {
        callMetrics.increment('rate_limit_blocks');
        return cb(formatAckError(requestId, { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many calls targeting this user. Please try again later.' }));
      }

      // 2. Authoritative initiation through callService
      const session = await callService.initiateCall({
        callerId: userId,
        receiverId: recipientId,
        callType,
        idempotencyKey,
      });

      // 3. Bind caller socket as selected media device
      await callLockService.bindCallDevice(session.callId, userId, socket.id);

      // 4. Fetch caller profile details for incoming call display
      const callerProfile = await Profile.findOne({ user: userId });
      const callerInfo = {
        id: userId,
        displayName: callerProfile ? callerProfile.displayName : 'Rubaru Caller',
        avatarUrl: callerProfile ? (callerProfile.avatarUri || callerProfile.avatar) : null,
      };

      // 5. Emit call:incoming to receiver's user room (distributed across instances)
      callMetrics.increment('incoming_calls');
      io.to(`user:${recipientId}`).emit(SocketEvents.CALL_INCOMING, {
        callId: session.callId,
        sessionId: session.callId,
        caller: callerInfo,
        callerId: userId,
        callerName: callerInfo.displayName,
        callerAvatar: callerInfo.avatarUrl || '',
        initiatorId: userId,
        initiatorName: callerInfo.displayName,
        initiatorAvatar: callerInfo.avatarUrl || '',
        callType: session.callType,
        communicationType: (session.callType || 'AUDIO').toUpperCase(),
        ratePerMinute: session.ratePerMinute || (session.callType === 'video' ? 10 : 5),
        expiresAt: session.requestExpiresAt,
        requestExpiresAt: session.requestExpiresAt,
      });

      // Also emit legacy incoming_call for backward-compatible clients
      io.to(`user:${recipientId}`).emit(SocketEvents.LEGACY_INCOMING_CALL, {
        callerId: userId,
        callerName: callerInfo.displayName,
        callerAvatar: callerInfo.avatarUrl || '',
        callType: session.callType,
        callSessionId: session.callId,
        ratePerMinute: session.ratePerMinute || (session.callType === 'video' ? 10 : 5),
      });

      // 6. Transition to RINGING and emit call:ringing to caller's room
      await callService.markRinging({ callId: session.callId, actorUserId: userId });
      io.to(`user:${userId}`).emit(SocketEvents.CALL_RINGING, {
        callId: session.callId,
        status: CallStatuses.RINGING,
        recipientId,
      });

      callMetrics.increment('authorized_initiations');
      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Call initiate error (${userId} -> ${recipientId}):`, err.message);
      callMetrics.increment('denied_initiations');
      if (err.code === CallDomainErrors.USER_BUSY) {
        callMetrics.increment('busy_results');
        socket.emit(SocketEvents.CALL_BUSY, { recipientId, code: 'USER_BUSY' });
      }
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 2. CANONICAL CALL ACCEPT (call:accept)
  // ===========================================================================
  socket.on(SocketEvents.CALL_ACCEPT, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateAcceptPayload(data);

    if (!validation.valid) {
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, requestId } = validation.data;

    try {
      // 1. Accept through authoritative domain service
      const session = await callService.acceptCall({
        callId,
        receiverId: userId,
      });

      // 2. Bind receiver device socket as the winning device
      await callLockService.bindCallDevice(callId, userId, socket.id);

      // 3. Emit call:accepted to caller room
      io.to(`user:${session.callerId}`).emit(SocketEvents.CALL_ACCEPTED, {
        callId: session.callId,
        receiverId: session.receiverId,
        acceptedAt: session.acceptedAt,
      });

      // Legacy call_connected event
      io.to(`user:${session.callerId}`).emit(SocketEvents.LEGACY_CALL_CONNECTED, {
        callSessionId: session.callId,
      });

      // 4. Multi-device sync: Notify other receiver devices that call was answered
      socket.to(`user:${userId}`).emit(SocketEvents.CALL_SYNC, {
        callId: session.callId,
        status: CallStatuses.ACCEPTED,
        handledByOtherDevice: true,
      });
      socket.to(`user:${userId}`).emit(SocketEvents.CALL_DISMISSED, {
        callId: session.callId,
        reason: 'ANSWERED_ON_ANOTHER_DEVICE',
      });

      callMetrics.increment('accepted_calls');
      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Call accept error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 3. CANONICAL CALL REJECT (call:reject)
  // ===========================================================================
  socket.on(SocketEvents.CALL_REJECT, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateRejectPayload(data);

    if (!validation.valid) {
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, reason, requestId } = validation.data;

    try {
      const session = await callService.rejectCall({
        callId,
        receiverId: userId,
        reason,
      });

      // Broadcast call:rejected to caller and receiver rooms
      io.to(`user:${session.callerId}`).emit(SocketEvents.CALL_REJECTED, {
        callId: session.callId,
        reason: session.endReason,
      });
      io.to(`user:${session.receiverId}`).emit(SocketEvents.CALL_REJECTED, {
        callId: session.callId,
        reason: session.endReason,
      });

      // Legacy call_declined event
      io.to(`user:${session.callerId}`).emit(SocketEvents.LEGACY_CALL_DECLINED, {
        callSessionId: session.callId,
      });

      callMetrics.increment('rejected_calls');
      callMetrics.recordTerminalReason(session.endReason);
      await callLockService.clearCallDeviceBindings(session.callId, session.callerId, session.receiverId);

      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Call reject error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 4. CANONICAL CALL CANCEL (call:cancel)
  // ===========================================================================
  socket.on(SocketEvents.CALL_CANCEL, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateCancelPayload(data);

    if (!validation.valid) {
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, reason, requestId } = validation.data;

    try {
      const session = await callService.cancelCall({
        callId,
        callerId: userId,
        reason,
      });

      io.to(`user:${session.callerId}`).emit(SocketEvents.CALL_CANCELLED, {
        callId: session.callId,
        reason: session.endReason,
      });
      io.to(`user:${session.receiverId}`).emit(SocketEvents.CALL_CANCELLED, {
        callId: session.callId,
        reason: session.endReason,
      });

      callMetrics.increment('cancelled_calls');
      callMetrics.recordTerminalReason(session.endReason);
      await callLockService.clearCallDeviceBindings(session.callId, session.callerId, session.receiverId);

      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Call cancel error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 5. SECURE SDP OFFER RELAY (call:signal:offer)
  // ===========================================================================
  socket.on(SocketEvents.CALL_SIGNAL_OFFER, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateOfferPayload(data);

    if (!validation.valid) {
      await callRateLimiter.checkInvalidAttempts(userId);
      callMetrics.increment('sdp_validation_failures');
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, sdp, requestId } = validation.data;

    try {
      // 1. Check SDP offer rate limit
      const rateLimit = await callRateLimiter.checkSdpOffer(callId, userId);
      if (!rateLimit.allowed) {
        callMetrics.increment('rate_limit_blocks');
        return cb(formatAckError(requestId, { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many SDP offers. Please slow down.' }));
      }

      // 2. Authoritative participant and state check
      const session = await callService.getCallForParticipant({ callId, userId });
      if (['ENDED', 'REJECTED', 'CANCELLED', 'MISSED', 'FAILED', 'COMPLETED'].includes(session.status)) {
        return cb(formatAckError(requestId, { code: 'CALL_TERMINATED', message: `Cannot signal in terminal call status: ${session.status}` }));
      }
      const peerId = session.callerId === userId ? session.receiverId : session.callerId;

      // 3. Selected-Device Check
      const boundSocketId = await callLockService.getCallDevice(callId, userId);
      if (boundSocketId && boundSocketId !== socket.id) {
        return cb(formatAckError(requestId, { code: 'DEVICE_NOT_SELECTED', message: 'Another device is active for this call' }));
      }

      // 4. Transition to CONNECTING if initially accepted
      if (session.status === CallStatuses.ACCEPTED) {
        await callService.markConnecting({ callId, actorUserId: userId });
      }

      // 4. Relay to authoritative peer's selected media socket
      const peerSocketId = await callLockService.getCallDevice(callId, peerId);
      const targetRoom = peerSocketId || `user:${peerId}`;

      io.to(targetRoom).emit(SocketEvents.CALL_SIGNAL_OFFER, {
        callId,
        senderId: userId,
        sdp,
      });

      // Legacy call.offer support
      io.to(targetRoom).emit('call.offer', {
        sessionId: callId,
        senderId: userId,
        sdp,
      });

      return cb(formatAckSuccess(requestId, { callId, relayed: true }));
    } catch (err) {
      console.warn(`[SOCKET CALL] SDP offer error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 6. SECURE SDP ANSWER RELAY (call:signal:answer)
  // ===========================================================================
  socket.on(SocketEvents.CALL_SIGNAL_ANSWER, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateAnswerPayload(data);

    if (!validation.valid) {
      await callRateLimiter.checkInvalidAttempts(userId);
      callMetrics.increment('sdp_validation_failures');
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, sdp, requestId } = validation.data;

    try {
      // 1. Check SDP answer rate limit
      const rateLimit = await callRateLimiter.checkSdpAnswer(callId, userId);
      if (!rateLimit.allowed) {
        callMetrics.increment('rate_limit_blocks');
        return cb(formatAckError(requestId, { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many SDP answers. Please slow down.' }));
      }

      // 2. Authoritative participant check
      const session = await callService.getCallForParticipant({ callId, userId });
      if (['ENDED', 'REJECTED', 'CANCELLED', 'MISSED', 'FAILED', 'COMPLETED'].includes(session.status)) {
        return cb(formatAckError(requestId, { code: 'CALL_TERMINATED', message: `Cannot signal in terminal call status: ${session.status}` }));
      }
      const peerId = session.callerId === userId ? session.receiverId : session.callerId;

      // 3. Selected-Device Check
      const boundSocketId = await callLockService.getCallDevice(callId, userId);
      if (boundSocketId && boundSocketId !== socket.id) {
        return cb(formatAckError(requestId, { code: 'DEVICE_NOT_SELECTED', message: 'Another device is active for this call' }));
      }

      // 4. Relay to authoritative peer's selected media socket
      const peerSocketId = await callLockService.getCallDevice(callId, peerId);
      const targetRoom = peerSocketId || `user:${peerId}`;

      io.to(targetRoom).emit(SocketEvents.CALL_SIGNAL_ANSWER, {
        callId,
        senderId: userId,
        sdp,
      });

      // Legacy call.answer support
      io.to(targetRoom).emit('call.answer', {
        sessionId: callId,
        senderId: userId,
        sdp,
      });

      return cb(formatAckSuccess(requestId, { callId, relayed: true }));
    } catch (err) {
      console.warn(`[SOCKET CALL] SDP answer error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 7. SECURE ICE CANDIDATE RELAY (call:signal:ice)
  // ===========================================================================
  socket.on(SocketEvents.CALL_SIGNAL_ICE, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateIcePayload(data);

    if (!validation.valid) {
      await callRateLimiter.checkInvalidAttempts(userId);
      callMetrics.increment('ice_validation_failures');
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, candidate, requestId } = validation.data;

    try {
      // 1. Distributed ICE candidate rate limit (120/min)
      const rateLimit = await callRateLimiter.checkIceCandidate(callId, userId);
      if (!rateLimit.allowed) {
        callMetrics.increment('rate_limit_blocks');
        return cb(formatAckError(requestId, { code: 'RATE_LIMIT_EXCEEDED', message: 'ICE candidate rate limit exceeded.' }));
      }

      // 2. Authoritative participant check
      const session = await callService.getCallForParticipant({ callId, userId });
      if (['ENDED', 'REJECTED', 'CANCELLED', 'MISSED', 'FAILED', 'COMPLETED'].includes(session.status)) {
        return cb(formatAckError(requestId, { code: 'CALL_TERMINATED', message: `Cannot signal in terminal call status: ${session.status}` }));
      }
      const peerId = session.callerId === userId ? session.receiverId : session.callerId;

      // 3. Selected-Device Check
      const boundSocketId = await callLockService.getCallDevice(callId, userId);
      if (boundSocketId && boundSocketId !== socket.id) {
        return cb(formatAckError(requestId, { code: 'DEVICE_NOT_SELECTED', message: 'Another device is active for this call' }));
      }

      // 4. Relay strictly to peer's selected media socket
      const peerSocketId = await callLockService.getCallDevice(callId, peerId);
      const targetRoom = peerSocketId || `user:${peerId}`;

      io.to(targetRoom).emit(SocketEvents.CALL_SIGNAL_ICE, {
        callId,
        senderId: userId,
        candidate,
      });

      // Legacy call.ice_candidate support
      io.to(targetRoom).emit('call.ice_candidate', {
        sessionId: callId,
        senderId: userId,
        candidate,
      });

      return cb(formatAckSuccess(requestId, { callId, relayed: true }));
    } catch (err) {
      console.warn(`[SOCKET CALL] ICE candidate relay error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 8. MEDIA CONNECTION CONFIRMATION (call:media-ready)
  // ===========================================================================
  socket.on(SocketEvents.CALL_MEDIA_READY, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateMediaReadyPayload(data);

    if (!validation.valid) {
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, requestId } = validation.data;

    try {
      // Selected-Device Check
      const boundSocketId = await callLockService.getCallDevice(callId, userId);
      if (boundSocketId && boundSocketId !== socket.id) {
        return cb(formatAckError(requestId, { code: 'DEVICE_NOT_SELECTED', message: 'Another device is active for this call' }));
      }

      const session = await callService.markMediaConnected({
        callId,
        userId,
      });

      // When BOTH participants report connected and state becomes ACTIVE -> broadcast call:connected!
      if (session.status === CallStatuses.ACTIVE) {
        callMetrics.increment('calls_active');
        io.to(`user:${session.callerId}`).emit(SocketEvents.CALL_CONNECTED, {
          callId: session.callId,
          status: CallStatuses.ACTIVE,
          connectedAt: session.connectedAt,
        });
        io.to(`user:${session.receiverId}`).emit(SocketEvents.CALL_CONNECTED, {
          callId: session.callId,
          status: CallStatuses.ACTIVE,
          connectedAt: session.connectedAt,
        });
      }

      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Media ready error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 9. RECONNECTION LIFECYCLE (call:reconnecting & call:reconnected)
  // ===========================================================================
  socket.on(SocketEvents.CALL_RECONNECTING, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const callId = data?.callId || data?.sessionId;
    const requestId = data?.requestId || `req_${Date.now()}`;

    if (!callId) {
      return cb(formatAckError(requestId, 'callId is required'));
    }

    try {
      const session = await callService.markReconnecting({
        callId,
        actorUserId: userId,
        reason: data?.reason || null,
      });

      const peerId = session.callerId === userId ? session.receiverId : session.callerId;
      io.to(`user:${peerId}`).emit(SocketEvents.CALL_RECONNECTING, {
        callId: session.callId,
        status: CallStatuses.RECONNECTING,
        reconnectionDeadline: session.reconnectionDeadline,
      });

      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Reconnecting error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  // Rebind device socket on reconnection before recovery signaling
  socket.on(SocketEvents.CALL_RECONNECT, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const callId = data?.callId || data?.sessionId;
    const requestId = data?.requestId || `req_${Date.now()}`;

    if (!callId) {
      return cb(formatAckError(requestId, 'callId is required'));
    }

    try {
      // 1. Authoritative participant check
      const session = await callService.getCallForParticipant({ callId, userId });

      if (['ENDED', 'REJECTED', 'CANCELLED', 'MISSED', 'FAILED', 'COMPLETED'].includes(session.status)) {
        return cb(formatAckError(requestId, { code: 'CALL_TERMINATED', message: 'Cannot reconnect to a terminated call' }));
      }

      // 2. Atomically rebind this new socket as the selected media device
      await callLockService.rebindCallDevice(callId, userId, socket.id);

      // 3. If ACTIVE, transition to RECONNECTING to notify peer
      if (session.status === CallStatuses.ACTIVE) {
        await callService.markReconnecting({ callId, actorUserId: userId });
        const peerId = session.callerId === userId ? session.receiverId : session.callerId;
        io.to(`user:${peerId}`).emit(SocketEvents.CALL_RECONNECTING, {
          callId: session.callId,
          status: CallStatuses.RECONNECTING,
          reconnectionDeadline: session.reconnectionDeadline,
        });
      }

      return cb(formatAckSuccess(requestId, { callId, rebound: true, session }));
    } catch (err) {
      console.warn(`[SOCKET CALL] Reconnect rebind error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  });

  socket.on(SocketEvents.CALL_RECONNECTED, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const callId = data?.callId || data?.sessionId;
    const requestId = data?.requestId || `req_${Date.now()}`;

    if (!callId) {
      return cb(formatAckError(requestId, 'callId is required'));
    }

    try {
      const session = await callService.restoreActiveCall({
        callId,
        actorUserId: userId,
      });

      // Atomically rebind media socket on reconnect
      await callLockService.rebindCallDevice(callId, userId, socket.id);

      io.to(`user:${session.callerId}`).emit(SocketEvents.CALL_RECONNECTED, {
        callId: session.callId,
        status: CallStatuses.ACTIVE,
      });
      io.to(`user:${session.receiverId}`).emit(SocketEvents.CALL_RECONNECTED, {
        callId: session.callId,
        status: CallStatuses.ACTIVE,
      });

      callMetrics.increment('reconnection_successes');
      return cb(formatAckSuccess(requestId, session));
    } catch (err) {
      console.warn(`[SOCKET CALL] Reconnected restore error (${callId}):`, err.message);
      callMetrics.increment('reconnection_failures');
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 10. CANONICAL CALL TERMINATION (call:end / call:hangup)
  // ===========================================================================
  const handleCallEnd = async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const validation = validateEndPayload(data);

    if (!validation.valid) {
      return cb(formatAckError(data?.requestId, validation.error));
    }

    const { callId, reason, requestId } = validation.data;

    try {
      const session = await callService.endCall({
        callId,
        actorUserId: userId,
        reason,
      });

      let callerWalletBalance = null;
      let receiverWalletBalance = null;
      try {
        const callerWallet = await walletService.getOrCreateWallet(session.callerId);
        callerWalletBalance = callerWallet?.availableBalance ?? null;
        const receiverWallet = await walletService.getOrCreateWallet(session.receiverId);
        receiverWalletBalance = receiverWallet?.availableBalance ?? null;
      } catch (e) {
        // Non-blocking wallet balance lookup
      }

      const endPayloadBase = {
        callId: session.callId,
        status: session.status,
        endReason: session.endReason,
        durationSeconds: session.durationSeconds || 0,
        billedMinutes: session.billedMinutes || 0,
        coinsCharged: session.totalCoinsCharged || 0,
        totalCoinsCharged: session.totalCoinsCharged || 0,
        totalCoinsEarned: session.totalCoinsEarned || 0,
        endedAt: session.endedAt,
      };

      const callerPayload = {
        ...endPayloadBase,
        walletBalance: callerWalletBalance,
        remainingBalance: callerWalletBalance,
        isInitiator: true,
      };

      const receiverPayload = {
        ...endPayloadBase,
        walletBalance: receiverWalletBalance,
        remainingBalance: receiverWalletBalance,
        isInitiator: false,
      };

      io.to(`user:${session.callerId}`).emit(SocketEvents.CALL_ENDED, callerPayload);
      io.to(`user:${session.receiverId}`).emit(SocketEvents.CALL_ENDED, receiverPayload);

      // Legacy call_hungup event
      io.to(`user:${session.callerId}`).emit(SocketEvents.LEGACY_CALL_HUNGUP, { callSessionId: session.callId });
      io.to(`user:${session.receiverId}`).emit(SocketEvents.LEGACY_CALL_HUNGUP, { callSessionId: session.callId });

      callMetrics.recordTerminalReason(session.endReason);
      await callLockService.clearCallDeviceBindings(session.callId, session.callerId, session.receiverId);

      const isCaller = session.callerId === userId;
      return cb(formatAckSuccess(requestId, isCaller ? callerPayload : receiverPayload));
    } catch (err) {
      console.warn(`[SOCKET CALL] End call error (${callId}):`, err.message);
      return cb(formatAckError(requestId, err));
    }
  };

  socket.on(SocketEvents.CALL_END, handleCallEnd);
  socket.on('call:hangup', handleCallEnd);

  // ===========================================================================
  // 11. STATE SYNC (call:sync)
  // ===========================================================================
  socket.on(SocketEvents.CALL_SYNC, async (data, callback) => {
    const cb = typeof callback === 'function' ? callback : () => {};
    const requestId = data?.requestId || `req_${Date.now()}`;

    try {
      const activeCallId = await callLockService.getUserActiveCallId(userId);
      if (activeCallId) {
        try {
          const session = await callService.getCallForParticipant({ callId: activeCallId, userId });
          socket.emit(SocketEvents.CALL_SYNC, { hasActiveCall: true, call: session });
          return cb(formatAckSuccess(requestId, { hasActiveCall: true, call: session }));
        } catch (e) {
          // If session is already terminal in DB, sync as no active call
        }
      }

      socket.emit(SocketEvents.CALL_SYNC, { hasActiveCall: false, call: null });
      return cb(formatAckSuccess(requestId, { hasActiveCall: false, call: null }));
    } catch (err) {
      return cb(formatAckError(requestId, err));
    }
  });

  // ===========================================================================
  // 12. LEGACY COMPATIBILITY ADAPTERS (Routed Authoritatively)
  // ===========================================================================
  socket.on(SocketEvents.LEGACY_CALL_USER, async (data) => {
    callMetrics.increment('legacy_event_invocations');
    const { recipientId, callType, callSessionId } = data || {};
    try {
      const session = await callService.initiateCall({
        callerId: userId,
        receiverId: recipientId,
        callType: callType || 'AUDIO',
        idempotencyKey: callSessionId || `legacy_${Date.now()}`,
      });

      await callLockService.bindCallDevice(session.callId, userId, socket.id);

      const callerProfile = await Profile.findOne({ user: userId });
      io.to(`user:${recipientId}`).emit(SocketEvents.LEGACY_INCOMING_CALL, {
        callerId: userId,
        callerName: callerProfile ? callerProfile.displayName : 'Rubaru Caller',
        callerAvatar: callerProfile ? callerProfile.avatarUri : null,
        callType: session.callType,
        callSessionId: session.callId,
      });
    } catch (err) {
      console.warn('[LEGACY CALL] call_user error:', err.message);
      if (err.code === CallDomainErrors.USER_BUSY) {
        socket.emit(SocketEvents.CALL_BUSY, { recipientId });
      }
    }
  });

  socket.on(SocketEvents.LEGACY_CALL_ACCEPTED, async (data) => {
    callMetrics.increment('legacy_event_invocations');
    const { callSessionId } = data || {};
    if (!callSessionId) return;
    try {
      const session = await callService.acceptCall({ callId: callSessionId, receiverId: userId });
      await callLockService.bindCallDevice(session.callId, userId, socket.id);
      io.to(`user:${session.callerId}`).emit(SocketEvents.LEGACY_CALL_CONNECTED, { callSessionId: session.callId });
    } catch (err) {
      console.warn('[LEGACY CALL] call_accepted error:', err.message);
    }
  });

  socket.on(SocketEvents.LEGACY_CALL_REJECTED, async (data) => {
    callMetrics.increment('legacy_event_invocations');
    const { callSessionId } = data || {};
    if (!callSessionId) return;
    try {
      const session = await callService.rejectCall({ callId: callSessionId, receiverId: userId });
      await callLockService.clearCallDeviceBindings(session.callId, session.callerId, session.receiverId);
      io.to(`user:${session.callerId}`).emit(SocketEvents.LEGACY_CALL_DECLINED, { callSessionId: session.callId });
    } catch (err) {
      console.warn('[LEGACY CALL] call_rejected error:', err.message);
    }
  });

  socket.on(SocketEvents.LEGACY_CALL_ENDED, async (data) => {
    callMetrics.increment('legacy_event_invocations');
    const { callSessionId } = data || {};
    if (!callSessionId) return;
    try {
      const session = await callService.endCall({ callId: callSessionId, actorUserId: userId });
      await callLockService.clearCallDeviceBindings(session.callId, session.callerId, session.receiverId);
      io.to(`user:${session.callerId}`).emit(SocketEvents.LEGACY_CALL_HUNGUP, { callSessionId: session.callId });
      io.to(`user:${session.receiverId}`).emit(SocketEvents.LEGACY_CALL_HUNGUP, { callSessionId: session.callId });
    } catch (err) {
      console.warn('[LEGACY CALL] call_ended error:', err.message);
    }
  });

  // Safely reject raw unvalidated generic relay to prevent security bypass
  socket.on(SocketEvents.LEGACY_SEND_WEBRTC_SIGNAL, (data, callback) => {
    callMetrics.increment('legacy_event_invocations');
    const cb = typeof callback === 'function' ? callback : () => {};
    console.warn('[LEGACY CALL] Rejected unsafe send_webrtc_signal invocation from user:', userId);
    return cb(formatAckError(data?.requestId, {
      code: 'DEPRECATED_UNSAFE_RELAY',
      message: 'send_webrtc_signal is deprecated and disabled for security. Use canonical call:signal:* events.',
    }));
  });

  // 13. Legacy Relay Message / Reaction / Poll handlers (Preserved for compatibility)
  socket.on('relay_message', (data) => {
    const { chatId, message } = data || {};
    if (chatId && message) {
      io.to(`conversation:${chatId}`).emit('receive_message', message);
      io.to(`chat_${chatId}`).emit('receive_message', message);
    }
  });

  socket.on('send_reaction', async (data) => {
    const { chatId, messageId, emoji } = data || {};
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const reactionIndex = message.reactions.findIndex((r) => r.user.toString() === userId);
      if (reactionIndex > -1) {
        if (message.reactions[reactionIndex].emoji === emoji) {
          message.reactions.splice(reactionIndex, 1);
        } else {
          message.reactions[reactionIndex].emoji = emoji;
        }
      } else {
        message.reactions.push({ user: userId, emoji });
      }

      await message.save();

      const updatedReactions = await Promise.all(
        message.reactions.map(async (r) => {
          const p = await Profile.findOne({ user: r.user });
          return {
            userId: r.user,
            displayName: p ? p.displayName : 'User',
            emoji: r.emoji,
          };
        })
      );

      io.to(`conversation:${chatId}`).emit('update_reaction', { messageId, reactions: updatedReactions });
      io.to(`chat_${chatId}`).emit('update_reaction', { messageId, reactions: updatedReactions });
    } catch (err) {
      console.error('[SOCKET CALL] send_reaction error:', err.message);
    }
  });

  socket.on('submit_vote', async (data) => {
    const { chatId, messageId, optionIndex } = data || {};
    try {
      const msg = await Message.findById(messageId);
      if (!msg || !msg.isPoll) return;

      msg.pollOptions.forEach((option) => {
        option.votes = option.votes.filter((id) => id.toString() !== userId);
      });

      if (msg.pollOptions[optionIndex]) {
        msg.pollOptions[optionIndex].votes.push(userId);
        await msg.save();

        const updatedOptions = msg.pollOptions.map((opt, index) => ({
          index,
          optionText: opt.optionText,
          voterIds: opt.votes,
          votesCount: opt.votes.length,
        }));

        io.to(`conversation:${chatId}`).emit('update_poll', { messageId, pollOptions: updatedOptions });
        io.to(`chat_${chatId}`).emit('update_poll', { messageId, pollOptions: updatedOptions });
      }
    } catch (err) {
      console.error('[SOCKET CALL] submit_vote error:', err.message);
    }
  });
}

module.exports = {
  registerCallingHandlers,
};
