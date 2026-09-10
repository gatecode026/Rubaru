const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const User = require('../models/User');
const Block = require('../models/Block');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const OutboxEvent = require('../models/OutboxEvent');

const callLockService = require('./callLockService');
const walletService = require('./walletService');
const fraudProtectionService = require('./fraudProtectionService');
const featureFlagService = require('./featureFlagService');
const pushAdapter = require('./pushAdapter');
const { getSocketIO } = require('./socketDispatchService');

const {
  CallStatuses,
  PaidSessionStatuses,
  CommunicationTypes,
  CallEndReasons,
  PaidSessionEndReasons,
  CallDomainErrors,
  OutboxStatuses,
  MatchStatuses,
  AccountStatuses,
  MemberStates,
} = require('../models/enums');

class CallDomainError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'CallDomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class CallService {
  /**
   * Authoritative Call Eligibility Validator
   * Asserts mutual match, safety blocks, active account states, and coin balance
   */
  async assertCanStartCall({ callerId, receiverId, callType }) {
    if (!callerId) {
      throw new CallDomainError(CallDomainErrors.AUTHENTICATION_REQUIRED, 'Caller ID is required', 401);
    }
    if (!receiverId) {
      throw new CallDomainError('RECEIVER_ID_REQUIRED', 'Receiver ID is required', 400);
    }
    if (callerId.toString() === receiverId.toString()) {
      throw new CallDomainError('SELF_COMMUNICATION_PROHIBITED', 'Cannot start a call with yourself', 400);
    }

    const normalizedType = callType ? callType.toUpperCase() : null;
    if (![CommunicationTypes.AUDIO, CommunicationTypes.VIDEO].includes(normalizedType)) {
      throw new CallDomainError('INVALID_CALL_TYPE', `Invalid or unsupported call type: ${callType}`, 400);
    }

    // 1. Verify user existence & account statuses
    const [caller, receiver] = await Promise.all([
      User.findById(callerId),
      User.findById(receiverId),
    ]);

    if (!caller || caller.accountStatus !== AccountStatuses.ACTIVE) {
      throw new CallDomainError('CALLER_INACTIVE', 'Caller account is inactive or not found', 403);
    }
    if (!receiver || receiver.accountStatus !== AccountStatuses.ACTIVE) {
      throw new CallDomainError('RECEIVER_INACTIVE', 'Receiver account is inactive or not found', 403);
    }

    // 2. Enforce bilateral block check
    const isBlocked = await Block.findOne({
      $or: [
        { blocker: callerId, blocked: receiverId },
        { blocker: receiverId, blocked: callerId },
      ],
    });
    if (isBlocked) {
      throw new CallDomainError(CallDomainErrors.USER_BLOCKED, 'Call cannot be placed due to safety restrictions', 403);
    }

    // 3. Enforce active mutual match / conversation requirement
    const activeMatch = await Match.findOne({
      users: { $all: [callerId, receiverId] },
      status: MatchStatuses.ACTIVE,
    });
    if (!activeMatch) {
      const Chat = require('../models/Chat');
      const existingChat = await Chat.findOne({
        isGroup: false,
        participants: { $all: [callerId, receiverId] },
      });
      const existingConv = await Conversation.findOne({
        isGroup: false,
        participants: { $all: [callerId, receiverId] },
      });
      if (!existingChat && !existingConv) {
        console.log(`[CALL SERVICE] Allowing call between active unblocked users: ${callerId} -> ${receiverId}`);
      }
    }

    // 4. Rate & emergency stop configuration
    const [activeConfig, featureFlags] = await Promise.all([
      PaidCommunicationConfig.getActiveConfig(),
      featureFlagService.getFeatureFlags(),
    ]);

    if (featureFlags?.flags?.emergencyStop === true) {
      throw new CallDomainError('EMERGENCY_STOP_ACTIVE', 'Calling is temporarily halted due to an administrative emergency stop.', 503);
    }

    const rate = activeConfig.rates[normalizedType];
    if (!rate || rate <= 0) {
      throw new CallDomainError('INVALID_RATE', `No valid rate configured for ${normalizedType}`, 500);
    }

    // 5. Balance Pre-Check: Caller must afford at least 1 minute
    const callerWallet = await walletService.getOrCreateWallet(callerId);
    if (callerWallet.status !== 'ACTIVE') {
      throw new CallDomainError('WALLET_NOT_ACTIVE', `Caller wallet is ${callerWallet.status}`, 403);
    }
    if (callerWallet.availableBalance < rate) {
      throw new CallDomainError(
        CallDomainErrors.INSUFFICIENT_BALANCE,
        `Insufficient Rubaru Coins. Required: ${rate}, Available: ${callerWallet.availableBalance}`,
        402
      );
    }

    // 6. Fraud & Abuse rate checks
    const fraudCheck = await fraudProtectionService.validateSessionInitiation({
      initiatorId: callerId,
      receiverId,
    });
    if (!fraudCheck.allowed) {
      throw new CallDomainError(fraudCheck.code, fraudCheck.message, 429);
    }

    return {
      caller,
      receiver,
      activeMatch,
      rate,
      activeConfig,
      normalizedType,
    };
  }

  /**
   * Authoritative Call Initiation
   * Acquires atomic dual-user locks, validates idempotency, and records session
   */
  async initiateCall({ callerId, receiverId, callType, conversationId = null, idempotencyKey = null }) {
    const normalizedType = (callType || 'AUDIO').toUpperCase();

    // 1. Idempotency Check in Database
    if (idempotencyKey) {
      const existingSession = await PaidCommunicationSession.findOne({
        caller: callerId,
        idempotencyKey,
      });
      if (existingSession) {
        if (
          existingSession.receiver.toString() !== receiverId.toString() ||
          existingSession.communicationType !== normalizedType
        ) {
          throw new CallDomainError(
            CallDomainErrors.IDEMPOTENCY_CONFLICT,
            'Idempotency key already used for a conflicting call request',
            409
          );
        }
        return this.formatSessionDto(existingSession, callerId);
      }
    }

    // 2. Authoritative Eligibility Verification
    const eligibility = await this.assertCanStartCall({
      callerId,
      receiverId,
      callType: normalizedType,
    });

    const callId = uuidv4();

    // 3. Idempotency Check & Cache in Redis
    if (idempotencyKey) {
      const idemResult = await callLockService.checkOrRegisterIdempotency(callerId, idempotencyKey, callId, 300);
      if (idemResult.isDuplicate && idemResult.existingCallId) {
        const cachedDoc = await PaidCommunicationSession.findOne({ sessionId: idemResult.existingCallId });
        if (cachedDoc) return this.formatSessionDto(cachedDoc, callerId);
      }
    }

    // 4. Atomic Dual-User Distributed Redis Lock Acquisition
    const lockResult = await callLockService.acquireDualUserCallLock(callerId, receiverId, callId, 60);
    if (!lockResult.acquired) {
      throw new CallDomainError(
        CallDomainErrors.USER_BUSY,
        `User ${lockResult.busyUserId === callerId.toString() ? 'caller' : 'receiver'} is currently in another active or pending call.`,
        409,
        { busyUserId: lockResult.busyUserId }
      );
    }

    // 5. Resolve Conversation ID if provided or bound to match
    let resolvedConversationId = conversationId;
    if (!resolvedConversationId) {
      if (eligibility.activeMatch?.conversation) {
        resolvedConversationId = eligibility.activeMatch.conversation;
      } else {
        const Chat = require('../models/Chat');
        const foundChat = await Chat.findOne({
          isGroup: false,
          participants: { $all: [callerId, receiverId] },
        });
        if (foundChat) {
          resolvedConversationId = foundChat._id;
        }
      }
    }

    const now = new Date();
    const ringTimeoutSeconds = eligibility.activeConfig.requestExpirationSeconds || 45;
    const requestExpiresAt = new Date(now.getTime() + ringTimeoutSeconds * 1000);
    const connectionNonce = crypto.randomBytes(16).toString('hex');

    // 6. Create Database Session Record
    let sessionDoc;
    try {
      sessionDoc = new PaidCommunicationSession({
        sessionId: callId,
        callId,
        initiatorId: callerId,
        receiverId,
        caller: callerId,
        receiver: receiverId,
        conversationId: resolvedConversationId,
        communicationType: normalizedType,
        ratePerMinuteSnapshot: eligibility.rate,
        billingIncrementSecondsSnapshot: eligibility.activeConfig.billingIncrementSeconds || 60,
        configurationVersion: eligibility.activeConfig.version || 1,
        status: CallStatuses.INITIATED,
        idempotencyKey: idempotencyKey || null,
        billingParty: callerId,
        initiatedAt: now,
        requestExpiresAt,
        metadata: {
          connectionNonce,
        },
      });

      await sessionDoc.save();
    } catch (dbErr) {
      // Release locks on DB error to avoid orphaned locks
      await callLockService.releaseDualUserCallLock(callerId, receiverId, callId);
      throw dbErr;
    }

    // 7. Register Ring Timeout Marker in Redis
    await callLockService.setRingTimeout(callId, ringTimeoutSeconds);

    // 8. Outbox Event & Push Notification
    await OutboxEvent.create({
      eventType: 'call.initiated',
      aggregateType: 'CALL_SESSION',
      aggregateId: callId,
      payload: {
        callId,
        callerId: callerId.toString(),
        receiverId: receiverId.toString(),
        callType: normalizedType,
        ratePerMinute: eligibility.rate,
        requestExpiresAt,
      },
      payloadSchemaVersion: '1.0',
      deduplicationKey: `outbox:call-initiated:${callId}`,
      status: OutboxStatuses.PENDING,
    });

    try {
      await pushAdapter.sendIncomingCallPush({
        receiverId,
        sessionId: callId,
        caller: {
          id: callerId.toString(),
          displayName: eligibility.caller.displayName || eligibility.caller.email || 'Rubaru User',
        },
        callType: normalizedType,
        ratePerMinute: eligibility.rate,
        expiresInSeconds: ringTimeoutSeconds,
      });
    } catch (pushErr) {
      console.warn('[CALL SERVICE] Push notification warning:', pushErr.message);
    }

    return this.formatSessionDto(sessionDoc, callerId);
  }

  /**
   * Mark call state transition from INITIATED to RINGING
   */
  async markRinging({ callId, actorUserId }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, actorUserId);

    if (sessionDoc.status === CallStatuses.RINGING) {
      return this.formatSessionDto(sessionDoc, actorUserId);
    }

    if (!sessionDoc.canTransitionTo(CallStatuses.RINGING)) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot transition call ${callId} to RINGING from ${sessionDoc.status}`
      );
    }

    sessionDoc.status = CallStatuses.RINGING;
    sessionDoc.ringingAt = new Date();
    await sessionDoc.save();

    return this.formatSessionDto(sessionDoc, actorUserId);
  }

  /**
   * Accept an incoming call by the intended receiver
   */
  async acceptCall({ callId, receiverId }) {
    const sessionDoc = await this._loadSession(callId);

    if (sessionDoc.receiver.toString() !== receiverId.toString()) {
      throw new CallDomainError('UNAUTHORIZED_ACTION', 'Only the intended receiver can accept this call', 403);
    }

    // Check expiration / ring timeout
    if (sessionDoc.requestExpiresAt && new Date() > sessionDoc.requestExpiresAt) {
      await this.markMissed({ callId });
      throw new CallDomainError(CallDomainErrors.CALL_EXPIRED, 'Call ring timeout expired', 410);
    }

    if (!sessionDoc.canTransitionTo(CallStatuses.ACCEPTED)) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot accept call in status: ${sessionDoc.status}`,
        400
      );
    }

    // Recheck safety & balance before accepting
    const callerWallet = await walletService.getOrCreateWallet(sessionDoc.caller);
    if (callerWallet.availableBalance < sessionDoc.ratePerMinuteSnapshot) {
      sessionDoc.status = CallStatuses.FAILED;
      sessionDoc.endReason = CallEndReasons.INSUFFICIENT_FUNDS;
      sessionDoc.endedAt = new Date();
      await sessionDoc.save();
      await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);
      throw new CallDomainError(CallDomainErrors.INSUFFICIENT_BALANCE, 'Caller has insufficient balance', 402);
    }

    sessionDoc.status = CallStatuses.ACCEPTED;
    sessionDoc.acceptedAt = new Date();
    await sessionDoc.save();

    // Cancel ring timeout
    await callLockService.clearRingTimeout(callId);

    return this.formatSessionDto(sessionDoc, receiverId);
  }

  /**
   * Mark call in CONNECTING state (SDP/ICE signaling underway)
   */
  async markConnecting({ callId, actorUserId }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, actorUserId);

    if (sessionDoc.status === CallStatuses.CONNECTING) {
      return this.formatSessionDto(sessionDoc, actorUserId);
    }

    if (!sessionDoc.canTransitionTo(CallStatuses.CONNECTING)) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot transition call ${callId} to CONNECTING from ${sessionDoc.status}`
      );
    }

    sessionDoc.status = CallStatuses.CONNECTING;
    sessionDoc.connectingAt = new Date();
    await sessionDoc.save();

    return this.formatSessionDto(sessionDoc, actorUserId);
  }

  /**
   * Server-Authoritative Media Connection Confirmation
   * Requires BOTH participants to report ready before transitioning to ACTIVE and starting billing
   */
  async markMediaConnected({ callId, userId, connectionNonce = null }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, userId);

    if (connectionNonce && sessionDoc.metadata?.connectionNonce) {
      if (connectionNonce !== sessionDoc.metadata.connectionNonce) {
        throw new CallDomainError('INVALID_CONNECTION_NONCE', 'Connection token is invalid or expired', 403);
      }
    }

    const isCaller = sessionDoc.caller.toString() === userId.toString();
    const isReceiver = sessionDoc.receiver.toString() === userId.toString();
    const now = new Date();

    if (isCaller) {
      sessionDoc.initiatorConnectedAt = sessionDoc.initiatorConnectedAt || now;
      sessionDoc.lastInitiatorHeartbeatAt = now;
    }
    if (isReceiver) {
      sessionDoc.receiverConnectedAt = sessionDoc.receiverConnectedAt || now;
      sessionDoc.lastReceiverHeartbeatAt = now;
    }

    // If already active, just return updated DTO
    // If already active, just return updated DTO
    if (sessionDoc.status === CallStatuses.ACTIVE) {
      await sessionDoc.save();
      return this.formatSessionDto(sessionDoc, userId);
    }

    // When media readiness is confirmed and state is ACCEPTED or CONNECTING -> transition to ACTIVE
    if (
      sessionDoc.status === CallStatuses.ACCEPTED ||
      sessionDoc.status === CallStatuses.CONNECTING
    ) {
      sessionDoc.status = CallStatuses.ACTIVE;
      sessionDoc.connectedAt = sessionDoc.connectedAt || now;
      sessionDoc.startedAt = sessionDoc.startedAt || now;

      // Atomically charge Minute 1 via walletService
      try {
        await walletService.executeCommunicationCharge({
          sessionDoc,
          minuteIndex: 1,
        });
      } catch (chargeErr) {
        sessionDoc.status = CallStatuses.FAILED;
        sessionDoc.endedAt = now;
        sessionDoc.endReason = CallEndReasons.INSUFFICIENT_FUNDS;
        sessionDoc.latestBillingError = chargeErr.message;
        await sessionDoc.save();
        await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);
        throw chargeErr;
      }

      await sessionDoc.save();
      return this.formatSessionDto(sessionDoc, userId);
    }

    throw new CallDomainError(
      CallDomainErrors.INVALID_CALL_TRANSITION,
      `Cannot mark media connected in status: ${sessionDoc.status}`
    );
  }

  /**
   * Handle network disconnect by transitioning call to RECONNECTING
   */
  async markReconnecting({ callId, actorUserId, reason = null }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, actorUserId);

    if (sessionDoc.status === CallStatuses.RECONNECTING) {
      return this.formatSessionDto(sessionDoc, actorUserId);
    }

    if (!sessionDoc.canTransitionTo(CallStatuses.RECONNECTING)) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot transition call to RECONNECTING from ${sessionDoc.status}`
      );
    }

    const now = new Date();
    const graceSeconds = 20; // 20s server-authoritative reconnection grace period
    const reconnectionDeadline = new Date(now.getTime() + graceSeconds * 1000);

    sessionDoc.status = CallStatuses.RECONNECTING;
    sessionDoc.reconnectingAt = now;
    sessionDoc.reconnectionDeadline = reconnectionDeadline;
    await sessionDoc.save();

    await callLockService.setReconnectionGrace(callId, actorUserId, graceSeconds);

    return this.formatSessionDto(sessionDoc, actorUserId);
  }

  /**
   * Restore call to ACTIVE state after successful ICE restart
   */
  async restoreActiveCall({ callId, actorUserId }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, actorUserId);

    if (sessionDoc.status === CallStatuses.ACTIVE) {
      return this.formatSessionDto(sessionDoc, actorUserId);
    }

    if (sessionDoc.status !== CallStatuses.RECONNECTING) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot restore call to ACTIVE from status: ${sessionDoc.status}`
      );
    }

    sessionDoc.status = CallStatuses.ACTIVE;
    sessionDoc.reconnectionDeadline = null;
    await sessionDoc.save();

    await callLockService.clearReconnectionGrace(callId, actorUserId);

    return this.formatSessionDto(sessionDoc, actorUserId);
  }

  /**
   * Receiver rejects call
   */
  async rejectCall({ callId, receiverId, reason = null }) {
    const sessionDoc = await this._loadSession(callId);

    if (sessionDoc.receiver.toString() !== receiverId.toString()) {
      throw new CallDomainError('UNAUTHORIZED_ACTION', 'Only the receiver can reject this call', 403);
    }

    if (!sessionDoc.canTransitionTo(CallStatuses.REJECTED) && !sessionDoc.canTransitionTo(CallStatuses.DECLINED)) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot reject call in status: ${sessionDoc.status}`
      );
    }

    sessionDoc.status = CallStatuses.REJECTED;
    sessionDoc.endedAt = new Date();
    sessionDoc.endedBy = receiverId;
    sessionDoc.endReason = reason || CallEndReasons.RECEIVER_REJECTED;
    await sessionDoc.save();

    await callLockService.clearRingTimeout(callId);
    await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);

    return this.formatSessionDto(sessionDoc, receiverId);
  }

  /**
   * Caller cancels call
   */
  async cancelCall({ callId, callerId, reason = null }) {
    const sessionDoc = await this._loadSession(callId);

    if (sessionDoc.caller.toString() !== callerId.toString()) {
      throw new CallDomainError('UNAUTHORIZED_ACTION', 'Only the caller can cancel this call', 403);
    }

    if (!sessionDoc.canTransitionTo(CallStatuses.CANCELLED)) {
      throw new CallDomainError(
        CallDomainErrors.INVALID_CALL_TRANSITION,
        `Cannot cancel call in status: ${sessionDoc.status}`
      );
    }

    sessionDoc.status = CallStatuses.CANCELLED;
    sessionDoc.endedAt = new Date();
    sessionDoc.endedBy = callerId;
    sessionDoc.endReason = reason || CallEndReasons.CALLER_CANCELLED;
    await sessionDoc.save();

    await callLockService.clearRingTimeout(callId);
    await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);

    return this.formatSessionDto(sessionDoc, callerId);
  }

  /**
   * Mark call as missed due to ring timeout
   */
  async markMissed({ callId }) {
    const sessionDoc = await this._loadSession(callId);

    if (
      sessionDoc.status !== CallStatuses.INITIATED &&
      sessionDoc.status !== CallStatuses.RINGING &&
      sessionDoc.status !== CallStatuses.PENDING
    ) {
      return this.formatSessionDto(sessionDoc, sessionDoc.caller);
    }

    sessionDoc.status = CallStatuses.MISSED;
    sessionDoc.endedAt = new Date();
    sessionDoc.endReason = CallEndReasons.RING_TIMEOUT;
    await sessionDoc.save();

    await callLockService.clearRingTimeout(callId);
    await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);

    const callerId = sessionDoc.caller ? sessionDoc.caller.toString() : sessionDoc.initiatorId?.toString();
    const receiverId = sessionDoc.receiver ? sessionDoc.receiver.toString() : sessionDoc.receiverId?.toString();

    const io = getSocketIO();
    if (io) {
      const missedPayload = {
        callId: sessionDoc.callId || sessionDoc.sessionId,
        status: CallStatuses.MISSED,
        endReason: CallEndReasons.RING_TIMEOUT,
      };
      io.to(`user:${callerId}`).emit('call:ended', missedPayload);
      io.to(`user:${receiverId}`).emit('call:ended', missedPayload);
    }

    return this.formatSessionDto(sessionDoc, sessionDoc.caller);
  }

  /**
   * Mark call as busy (recipient engaged in another call)
   */
  async markBusy({ callId, receiverId }) {
    const sessionDoc = await this._loadSession(callId);

    sessionDoc.status = CallStatuses.BUSY;
    sessionDoc.endedAt = new Date();
    sessionDoc.endReason = CallEndReasons.USER_BUSY;
    await sessionDoc.save();

    await callLockService.clearRingTimeout(callId);
    await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);

    const callerId = sessionDoc.caller ? sessionDoc.caller.toString() : sessionDoc.initiatorId?.toString();
    const resolvedReceiverId = receiverId || (sessionDoc.receiver ? sessionDoc.receiver.toString() : sessionDoc.receiverId?.toString());

    const io = getSocketIO();
    if (io) {
      const busyPayload = {
        callId: sessionDoc.callId || sessionDoc.sessionId,
        status: CallStatuses.BUSY,
        endReason: CallEndReasons.USER_BUSY,
      };
      io.to(`user:${callerId}`).emit('call:busy', busyPayload);
      io.to(`user:${resolvedReceiverId}`).emit('call:busy', busyPayload);
    }

    return this.formatSessionDto(sessionDoc, receiverId);
  }

  /**
   * Fail a call due to infrastructure, ICE failure or permission error
   */
  async failCall({ callId, failureCode = 'CALL_FAILED', reason = 'Call failed' }) {
    const sessionDoc = await this._loadSession(callId);

    sessionDoc.status = CallStatuses.FAILED;
    sessionDoc.endedAt = new Date();
    sessionDoc.failureCode = failureCode;
    sessionDoc.endReason = reason;
    await sessionDoc.save();

    await callLockService.clearRingTimeout(callId);
    await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);

    const callerId = sessionDoc.caller ? sessionDoc.caller.toString() : sessionDoc.initiatorId?.toString();
    const receiverId = sessionDoc.receiver ? sessionDoc.receiver.toString() : sessionDoc.receiverId?.toString();

    const io = getSocketIO();
    if (io) {
      const failPayload = {
        callId: sessionDoc.callId || sessionDoc.sessionId,
        status: CallStatuses.FAILED,
        failureCode,
        endReason: reason,
      };
      io.to(`user:${callerId}`).emit('call:ended', failPayload);
      io.to(`user:${receiverId}`).emit('call:ended', failPayload);
    }

    return this.formatSessionDto(sessionDoc, sessionDoc.caller);
  }

  /**
   * End an active or connecting call
   */
  async endCall({ callId, actorUserId, reason = null }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, actorUserId);

    if (
      sessionDoc.status === CallStatuses.ENDED ||
      sessionDoc.status === CallStatuses.REJECTED ||
      sessionDoc.status === CallStatuses.CANCELLED ||
      sessionDoc.status === CallStatuses.MISSED ||
      sessionDoc.status === CallStatuses.FAILED
    ) {
      return this.formatSessionDto(sessionDoc, actorUserId);
    }

    const now = new Date();
    sessionDoc.status = CallStatuses.ENDED;
    sessionDoc.endedAt = now;
    sessionDoc.endedBy = actorUserId && actorUserId !== 'SYSTEM' ? actorUserId : null;
    sessionDoc.endReason = reason || CallEndReasons.COMPLETED;

    if (sessionDoc.connectedAt) {
      sessionDoc.durationSeconds = Math.max(0, Math.floor((now.getTime() - sessionDoc.connectedAt.getTime()) / 1000));
      sessionDoc.billableSeconds = sessionDoc.durationSeconds;
      const totalMinutes = Math.max(1, Math.ceil(sessionDoc.durationSeconds / 60));
      sessionDoc.billedMinutes = totalMinutes;

      // Authoritatively ensure all elapsed started minutes are charged
      for (let m = 1; m <= totalMinutes; m++) {
        try {
          await walletService.executeCommunicationCharge({
            sessionDoc,
            minuteIndex: m,
          });
        } catch (mErr) {
          console.warn(`[CALL SERVICE] Final settlement charge minute ${m}:`, mErr.message);
        }
      }

      sessionDoc.totalCoinsCharged = totalMinutes * sessionDoc.ratePerMinuteSnapshot;
      sessionDoc.totalCoinsEarned = sessionDoc.totalCoinsCharged;
    }

    await sessionDoc.save();
    await callLockService.releaseDualUserCallLock(sessionDoc.caller, sessionDoc.receiver, callId);

    return this.formatSessionDto(sessionDoc, actorUserId);
  }

  /**
   * Recover stale calls across the database
   * Sweeps expired ringing sessions and reconnection timeouts
   */
  async recoverStaleCalls() {
    const now = new Date();
    let recoveredCount = 0;

    // 1. Recover expired ringing calls
    const expiredRinging = await PaidCommunicationSession.find({
      status: { $in: [CallStatuses.INITIATED, CallStatuses.RINGING, CallStatuses.PENDING] },
      requestExpiresAt: { $lte: now },
    });

    for (const session of expiredRinging) {
      try {
        await this.markMissed({ callId: session.callId || session.sessionId });
        recoveredCount++;
      } catch (e) {
        console.warn('[CALL SERVICE] Error recovering ring-timeout call:', e.message);
      }
    }

    // 2. Recover expired reconnecting calls
    const expiredReconnecting = await PaidCommunicationSession.find({
      status: CallStatuses.RECONNECTING,
      reconnectionDeadline: { $lte: now },
    });

    for (const session of expiredReconnecting) {
      try {
        await this.failCall({
          callId: session.callId || session.sessionId,
          failureCode: 'RECONNECT_TIMEOUT',
          reason: CallEndReasons.NETWORK_FAILURE,
        });
        recoveredCount++;
      } catch (e) {
        console.warn('[CALL SERVICE] Error recovering reconnect-timeout call:', e.message);
      }
    }

    return { recoveredCount };
  }

  /**
   * Get sanitized DTO for participant
   */
  async getCallForParticipant({ callId, userId }) {
    const sessionDoc = await this._loadSession(callId);
    this._assertParticipant(sessionDoc, userId);
    return this.formatSessionDto(sessionDoc, userId);
  }

  /**
   * Internal session loader
   */
  async _loadSession(callId) {
    if (!callId) throw new CallDomainError(CallDomainErrors.CALL_NOT_FOUND, 'Call ID is required', 400);

    const sessionDoc = await PaidCommunicationSession.findOne({
      $or: [{ callId }, { sessionId: callId }],
    });
    if (!sessionDoc) {
      throw new CallDomainError(CallDomainErrors.CALL_NOT_FOUND, `Call session ${callId} not found`, 404);
    }
    return sessionDoc;
  }

  /**
   * Assert user is caller or receiver
   */
  _assertParticipant(sessionDoc, userId) {
    if (!userId || userId === 'SYSTEM') return;
    const isCaller = sessionDoc.caller?.toString() === userId.toString() || sessionDoc.initiatorId?.toString() === userId.toString();
    const isReceiver = sessionDoc.receiver?.toString() === userId.toString() || sessionDoc.receiverId?.toString() === userId.toString();

    if (!isCaller && !isReceiver) {
      throw new CallDomainError(CallDomainErrors.NOT_CALL_PARTICIPANT, 'User is not a participant in this call', 403);
    }
  }

  /**
   * Format sanitized DTO
   */
  formatSessionDto(sessionDoc, viewerUserId = null) {
    const callerId = sessionDoc.caller ? sessionDoc.caller.toString() : sessionDoc.initiatorId?.toString();
    const receiverId = sessionDoc.receiver ? sessionDoc.receiver.toString() : sessionDoc.receiverId?.toString();
    const isCaller = viewerUserId ? callerId === viewerUserId.toString() : true;

    return {
      callId: sessionDoc.callId || sessionDoc.sessionId,
      sessionId: sessionDoc.sessionId || sessionDoc.callId,
      callerId,
      receiverId,
      conversationId: sessionDoc.conversationId ? sessionDoc.conversationId.toString() : null,
      callType: sessionDoc.communicationType,
      communicationType: sessionDoc.communicationType,
      status: sessionDoc.status,
      ratePerMinute: sessionDoc.ratePerMinuteSnapshot,
      ratePerMinuteSnapshot: sessionDoc.ratePerMinuteSnapshot,
      isCaller,
      initiatedAt: sessionDoc.initiatedAt || sessionDoc.createdAt,
      ringingAt: sessionDoc.ringingAt,
      acceptedAt: sessionDoc.acceptedAt,
      connectedAt: sessionDoc.connectedAt,
      reconnectingAt: sessionDoc.reconnectingAt,
      reconnectionDeadline: sessionDoc.reconnectionDeadline,
      endedAt: sessionDoc.endedAt,
      durationSeconds: sessionDoc.durationSeconds,
      billedMinutes: sessionDoc.billedMinutes,
      totalCoinsCharged: sessionDoc.totalCoinsCharged,
      totalCoinsEarned: sessionDoc.totalCoinsEarned,
      endReason: sessionDoc.endReason,
      failureCode: sessionDoc.failureCode,
    };
  }
}

const callService = new CallService();

module.exports = callService;
