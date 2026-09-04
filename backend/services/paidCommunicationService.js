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
const walletService = require('./walletService');
const fraudProtectionService = require('./fraudProtectionService');
const featureFlagService = require('./featureFlagService');
const pushAdapter = require('./pushAdapter');
const { getSocketIO } = require('./socketDispatchService');
const {
  CommunicationTypes,
  ConversationTypes,
  PaidSessionStatuses,
  PaidSessionEndReasons,
  OutboxStatuses,
  MemberStates,
} = require('../models/enums');

class PaidSessionError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'PaidSessionError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Initiate a new paid communication session with fraud checks & rate snapshot
 */
async function initiatePaidSession({ initiatorId, receiverId, conversationId = null, communicationType }) {
  if (!initiatorId) {
    throw new PaidSessionError('AUTHENTICATION_REQUIRED', 'Initiator ID is required', 401);
  }
  if (!receiverId) {
    throw new PaidSessionError('RECEIVER_ID_REQUIRED', 'Receiver ID is required', 400);
  }
  if (initiatorId.toString() === receiverId.toString()) {
    throw new PaidSessionError('SELF_COMMUNICATION_PROHIBITED', 'Cannot start a paid session with yourself', 400);
  }
  if (!Object.values(CommunicationTypes).includes(communicationType)) {
    throw new PaidSessionError('INVALID_COMMUNICATION_TYPE', `Invalid communication type: ${communicationType}`, 400);
  }

  // 1. Verify user existence & account status
  const [initiator, receiver] = await Promise.all([
    User.findById(initiatorId),
    User.findById(receiverId),
  ]);

  if (!initiator || initiator.accountStatus !== 'ACTIVE') {
    throw new PaidSessionError('INITIATOR_INACTIVE', 'Initiator account is inactive or not found', 403);
  }
  if (!receiver || receiver.accountStatus !== 'ACTIVE') {
    throw new PaidSessionError('RECEIVER_INACTIVE', 'Receiver account is inactive or not found', 403);
  }

  // 2. Safety & block check
  const isBlocked = await Block.findOne({
    $or: [
      { blocker: initiatorId, blocked: receiverId },
      { blocker: receiverId, blocked: initiatorId },
    ],
  });
  if (isBlocked) {
    throw new PaidSessionError('COMMUNICATION_BLOCKED', 'Communication is not permitted due to safety restrictions', 403);
  }

  // 3. Conversation & match validation if applicable
  let resolvedConversationId = null;
  if (conversationId) {
    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      throw new PaidSessionError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }
    if (conv.type === ConversationTypes.GROUP || conv.isGroup) {
      throw new PaidSessionError(
        'GROUP_PAID_COMMUNICATION_NOT_SUPPORTED',
        'Paid communication is only supported for one-to-one direct matches',
        400
      );
    }
    const members = await ConversationMember.find({
      conversationId: conv._id,
      state: MemberStates.ACTIVE,
    });
    const memberUserIds = members.map((m) => (m.userId ? m.userId.toString() : m.user?.toString()));
    const isParticipant =
      (Array.isArray(conv.participants) &&
        conv.participants.some((p) => p.toString() === initiatorId.toString()) &&
        conv.participants.some((p) => p.toString() === receiverId.toString())) ||
      (memberUserIds.includes(initiatorId.toString()) && memberUserIds.includes(receiverId.toString()));
    if (!isParticipant) {
      throw new PaidSessionError('CONVERSATION_ACCESS_DENIED', 'Participants are not part of this conversation', 403);
    }
    resolvedConversationId = conv._id;
  }

  // 4. Fraud and Abuse Protection Validation
  const fraudCheck = await fraudProtectionService.validateSessionInitiation({
    initiatorId,
    receiverId,
  });
  if (!fraudCheck.allowed) {
    throw new PaidSessionError(fraudCheck.code, fraudCheck.message, 429);
  }

  // 5. Load Active Rate Configuration & Verify Feature Flag
  const [activeConfig, featureFlags] = await Promise.all([
    PaidCommunicationConfig.getActiveConfig(),
    featureFlagService.getFeatureFlags(),
  ]);

  if (featureFlags && featureFlags.flags && featureFlags.flags.emergencyStop === true) {
    throw new PaidSessionError(
      'EMERGENCY_STOP_ACTIVE',
      'Paid communication is temporarily halted due to an administrative emergency stop.',
      503
    );
  }

  // Fail closed if communication type is disabled
  if (activeConfig.enabled && activeConfig.enabled[communicationType] === false) {
    throw new PaidSessionError(
      'COMMUNICATION_TYPE_DISABLED',
      `Paid ${communicationType} communication is currently disabled.`,
      403
    );
  }

  const rate = activeConfig.rates[communicationType];
  if (!rate || rate <= 0) {
    throw new PaidSessionError('INVALID_RATE', `No valid rate configured for ${communicationType}`, 500);
  }

  // 6. Prevent conflicting duplicate active / pending sessions between same participants
  const existingActiveSession = await PaidCommunicationSession.findOne({
    $or: [
      { initiatorId, receiverId },
      { initiatorId: receiverId, receiverId: initiatorId },
    ],
    status: {
      $in: [
        PaidSessionStatuses.PENDING,
        PaidSessionStatuses.ACCEPTED,
        PaidSessionStatuses.CONNECTING,
        PaidSessionStatuses.ACTIVE,
      ],
    },
  });

  if (existingActiveSession) {
    throw new PaidSessionError(
      'ACTIVE_SESSION_EXISTS',
      'An active or pending session already exists between these participants',
      409,
      { sessionId: existingActiveSession.sessionId, status: existingActiveSession.status }
    );
  }

  // 7. Balance Pre-Check: Initiator must be able to afford at least the first minute
  const initiatorWallet = await walletService.getOrCreateWallet(initiatorId);
  if (initiatorWallet.status !== 'ACTIVE') {
    throw new PaidSessionError('WALLET_NOT_ACTIVE', `Initiator wallet is ${initiatorWallet.status}`, 403);
  }
  if (initiatorWallet.availableBalance < rate) {
    throw new PaidSessionError(
      'INSUFFICIENT_BALANCE',
      `Insufficient Rubaru Coins. Required: ${rate}, Available: ${initiatorWallet.availableBalance}`,
      402
    );
  }

  // 8. Create Session with Cryptographic Connection Nonce
  const sessionId = uuidv4();
  const connectionNonce = crypto.randomBytes(16).toString('hex');
  const requestExpiresAt = new Date(Date.now() + (activeConfig.requestExpirationSeconds || 60) * 1000);

  const sessionDoc = new PaidCommunicationSession({
    sessionId,
    initiatorId,
    receiverId,
    conversationId: resolvedConversationId,
    communicationType,
    ratePerMinuteSnapshot: rate,
    billingIncrementSecondsSnapshot: activeConfig.billingIncrementSeconds || 60,
    configurationVersion: activeConfig.version,
    status: PaidSessionStatuses.PENDING,
    requestExpiresAt,
    metadata: {
      connectionNonce,
    },
  });

  await sessionDoc.save();

  // 9. Enqueue Outbox Event for Socket Dispatch
  await OutboxEvent.create({
    eventType: 'paid_session.requested',
    aggregateType: 'PAID_SESSION',
    aggregateId: sessionId,
    payload: {
      sessionId,
      initiatorId: initiatorId.toString(),
      receiverId: receiverId.toString(),
      conversationId: resolvedConversationId ? resolvedConversationId.toString() : null,
      communicationType,
      ratePerMinute: rate,
      requestExpiresAt,
    },
    payloadSchemaVersion: '1.0',
    deduplicationKey: `outbox:session-requested:${sessionId}`,
    status: OutboxStatuses.PENDING,
  });

  // 10. Multi-Device Native Background Push Dispatch for Calls
  if (communicationType === CommunicationTypes.AUDIO || communicationType === CommunicationTypes.VIDEO) {
    try {
      await pushAdapter.sendIncomingCallPush({
        receiverId,
        sessionId,
        caller: {
          id: initiatorId.toString(),
          displayName: initiator.email || initiator.phone || 'Rubaru User',
        },
        callType: communicationType,
        ratePerMinute: rate,
        expiresInSeconds: activeConfig.requestExpirationSeconds || 60,
      });
    } catch (pushErr) {
      console.warn('[PAID CALL] Push notification dispatch warning:', pushErr.message);
    }
  }

  // 11. Immediate Real-Time Socket.io Dispatch to Online Receiver Devices
  const io = getSocketIO();
  if (io) {
    io.to(`user:${receiverId}`).emit('paid_session.requested', {
      sessionId,
      initiatorId: initiatorId.toString(),
      receiverId: receiverId.toString(),
      communicationType,
      ratePerMinute: rate,
      requestExpiresAt,
      caller: {
        id: initiatorId.toString(),
        displayName: initiator.email || initiator.phone || 'Rubaru User',
      },
    });
  }

  return sessionDoc;
}

/**
 * Receiver accepts the paid session request
 */
async function acceptPaidSession({ receiverId, sessionId }) {
  if (!receiverId) {
    throw new PaidSessionError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId });
  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  if (sessionDoc.receiverId.toString() !== receiverId.toString()) {
    throw new PaidSessionError('UNAUTHORIZED_ACTION', 'Only the receiver can accept this session', 403);
  }

  if (sessionDoc.status !== PaidSessionStatuses.PENDING) {
    throw new PaidSessionError(
      'INVALID_STATE_TRANSITION',
      `Cannot accept session in status: ${sessionDoc.status}`,
      400
    );
  }

  if (sessionDoc.requestExpiresAt && new Date() > sessionDoc.requestExpiresAt) {
    sessionDoc.status = PaidSessionStatuses.EXPIRED;
    sessionDoc.endedAt = new Date();
    sessionDoc.endReason = PaidSessionEndReasons.EXPIRED;
    await sessionDoc.save();
    throw new PaidSessionError('SESSION_EXPIRED', 'Session request has expired', 410);
  }

  sessionDoc.status = PaidSessionStatuses.ACCEPTED;
  sessionDoc.acceptedAt = new Date();
  await sessionDoc.save();

  await OutboxEvent.create({
    eventType: 'paid_session.accepted',
    aggregateType: 'PAID_SESSION',
    aggregateId: sessionId,
    payload: {
      sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      acceptedAt: sessionDoc.acceptedAt,
    },
    payloadSchemaVersion: '1.0',
    deduplicationKey: `outbox:session-accepted:${sessionId}`,
    status: OutboxStatuses.PENDING,
  });

  const ioAccept = getSocketIO();
  if (ioAccept) {
    ioAccept.to(`paid_session:${sessionId}`).to(`user:${sessionDoc.initiatorId}`).emit('paid_session.accepted', {
      sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      acceptedAt: sessionDoc.acceptedAt,
    });
  }

  return sessionDoc;
}

/**
 * Receiver declines the paid session request
 */
async function declinePaidSession({ receiverId, sessionId, reason = null }) {
  if (!receiverId) {
    throw new PaidSessionError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId });
  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  if (sessionDoc.receiverId.toString() !== receiverId.toString()) {
    throw new PaidSessionError('UNAUTHORIZED_ACTION', 'Only the receiver can decline this session', 403);
  }

  if (!sessionDoc.canTransitionTo(PaidSessionStatuses.DECLINED)) {
    throw new PaidSessionError(
      'INVALID_STATE_TRANSITION',
      `Cannot decline session in status: ${sessionDoc.status}`,
      400
    );
  }

  sessionDoc.status = PaidSessionStatuses.DECLINED;
  sessionDoc.endedAt = new Date();
  sessionDoc.endReason = reason || PaidSessionEndReasons.CALL_DECLINED;
  await sessionDoc.save();

  await OutboxEvent.create({
    eventType: 'paid_session.declined',
    aggregateType: 'PAID_SESSION',
    aggregateId: sessionId,
    payload: {
      sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      endReason: sessionDoc.endReason,
    },
    payloadSchemaVersion: '1.0',
    deduplicationKey: `outbox:session-declined:${sessionId}`,
    status: OutboxStatuses.PENDING,
  });

  if (sessionDoc.communicationType === CommunicationTypes.AUDIO || sessionDoc.communicationType === CommunicationTypes.VIDEO) {
    pushAdapter.sendCallCancellationPush({
      receiverId: sessionDoc.receiverId,
      sessionId,
      reason: sessionDoc.endReason,
    }).catch(() => {});
  }

  const ioDecline = getSocketIO();
  if (ioDecline) {
    ioDecline.to(`paid_session:${sessionId}`).to(`user:${sessionDoc.initiatorId}`).to(`user:${sessionDoc.receiverId}`).emit('paid_session.declined', {
      sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      endReason: sessionDoc.endReason,
    });
    ioDecline.to(`paid_session:${sessionId}`).to(`user:${sessionDoc.initiatorId}`).to(`user:${sessionDoc.receiverId}`).emit('call.cancelled', {
      sessionId,
      reason: sessionDoc.endReason,
    });
  }

  return sessionDoc;
}

/**
 * Initiator cancels a pending or connecting paid session
 */
async function cancelPaidSession({ initiatorId, sessionId, reason = null }) {
  if (!initiatorId) {
    throw new PaidSessionError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId });
  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  if (sessionDoc.initiatorId.toString() !== initiatorId.toString()) {
    throw new PaidSessionError('UNAUTHORIZED_ACTION', 'Only the initiator can cancel this session', 403);
  }

  if (!sessionDoc.canTransitionTo(PaidSessionStatuses.CANCELLED)) {
    throw new PaidSessionError(
      'INVALID_STATE_TRANSITION',
      `Cannot cancel session in status: ${sessionDoc.status}`,
      400
    );
  }

  sessionDoc.status = PaidSessionStatuses.CANCELLED;
  sessionDoc.endedAt = new Date();
  sessionDoc.endReason = reason || PaidSessionEndReasons.CANCELLED;
  await sessionDoc.save();

  await OutboxEvent.create({
    eventType: 'paid_session.ended',
    aggregateType: 'PAID_SESSION',
    aggregateId: sessionId,
    payload: {
      sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      endReason: sessionDoc.endReason,
    },
    payloadSchemaVersion: '1.0',
    deduplicationKey: `outbox:session-cancelled:${sessionId}`,
    status: OutboxStatuses.PENDING,
  });

  if (sessionDoc.communicationType === CommunicationTypes.AUDIO || sessionDoc.communicationType === CommunicationTypes.VIDEO) {
    pushAdapter.sendCallCancellationPush({
      receiverId: sessionDoc.receiverId,
      sessionId,
      reason: sessionDoc.endReason,
    }).catch(() => {});
  }

  const ioCancel = getSocketIO();
  if (ioCancel) {
    ioCancel.to(`paid_session:${sessionId}`).to(`user:${sessionDoc.receiverId}`).emit('call.cancelled', {
      sessionId,
      reason: sessionDoc.endReason,
    });
    ioCancel.to(`paid_session:${sessionId}`).to(`user:${sessionDoc.receiverId}`).emit('paid_session.ended', {
      sessionId,
      status: sessionDoc.status,
      endReason: sessionDoc.endReason,
    });
  }

  return sessionDoc;
}

/**
 * Mark a participant genuinely connected (media/socket ready) with connection verification
 */
async function markParticipantConnected({ userId, sessionId, connectionNonce = null }) {
  if (!userId) {
    throw new PaidSessionError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId });
  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  const isInitiator = sessionDoc.initiatorId.toString() === userId.toString();
  const isReceiver = sessionDoc.receiverId.toString() === userId.toString();

  if (!isInitiator && !isReceiver) {
    throw new PaidSessionError('UNAUTHORIZED_ACTION', 'User is not a participant in this session', 403);
  }

  // Nonce validation if provided or required
  if (connectionNonce && sessionDoc.metadata && sessionDoc.metadata.connectionNonce) {
    if (connectionNonce !== sessionDoc.metadata.connectionNonce) {
      throw new PaidSessionError('INVALID_CONNECTION_NONCE', 'Connection token is invalid or expired', 403);
    }
  }

  const now = new Date();

  if (isInitiator) {
    sessionDoc.initiatorConnectedAt = sessionDoc.initiatorConnectedAt || now;
    sessionDoc.lastInitiatorHeartbeatAt = now;
  }
  if (isReceiver) {
    sessionDoc.receiverConnectedAt = sessionDoc.receiverConnectedAt || now;
    sessionDoc.lastReceiverHeartbeatAt = now;
  }

  // If already ACTIVE, update heartbeat and return
  if (sessionDoc.status === PaidSessionStatuses.ACTIVE) {
    await sessionDoc.save();
    return sessionDoc;
  }

  // If not yet ACTIVE, check if both have connected within connection window
  if (
    sessionDoc.status === PaidSessionStatuses.ACCEPTED ||
    sessionDoc.status === PaidSessionStatuses.CONNECTING
  ) {
    if (sessionDoc.initiatorConnectedAt && sessionDoc.receiverConnectedAt) {
      // Both participants verified and connected! Activate session & charge Minute 1 atomically.
      return await activatePaidSession(sessionDoc);
    } else {
      sessionDoc.status = PaidSessionStatuses.CONNECTING;
      await sessionDoc.save();
      return sessionDoc;
    }
  }

  throw new PaidSessionError(
    'INVALID_STATE_TRANSITION',
    `Cannot mark participant connected in status: ${sessionDoc.status}`,
    400
  );
}

/**
 * Activate the session and atomically execute Minute 1 charge
 */
async function activatePaidSession(sessionDoc) {
  const now = new Date();
  sessionDoc.status = PaidSessionStatuses.ACTIVE;
  sessionDoc.connectedAt = sessionDoc.connectedAt || now;
  sessionDoc.startedAt = sessionDoc.startedAt || now;
  sessionDoc.lastInitiatorHeartbeatAt = sessionDoc.lastInitiatorHeartbeatAt || now;
  sessionDoc.lastReceiverHeartbeatAt = sessionDoc.lastReceiverHeartbeatAt || now;

  try {
    // Atomically execute charge for Minute 1
    await walletService.executeCommunicationCharge({
      sessionDoc,
      minuteIndex: 1,
    });
  } catch (chargeErr) {
    sessionDoc.status = PaidSessionStatuses.INSUFFICIENT_BALANCE;
    sessionDoc.endedAt = now;
    sessionDoc.endReason = PaidSessionEndReasons.INSUFFICIENT_BALANCE;
    sessionDoc.latestBillingError = chargeErr.message;
    await sessionDoc.save();

    await OutboxEvent.create({
      eventType: 'paid_session.ended',
      aggregateType: 'PAID_SESSION',
      aggregateId: sessionDoc.sessionId,
      payload: {
        sessionId: sessionDoc.sessionId,
        initiatorId: sessionDoc.initiatorId.toString(),
        receiverId: sessionDoc.receiverId.toString(),
        endReason: sessionDoc.endReason,
        error: chargeErr.message,
      },
      payloadSchemaVersion: '1.0',
      deduplicationKey: `outbox:session-failed-activation:${sessionDoc.sessionId}`,
      status: OutboxStatuses.PENDING,
    });

    throw chargeErr;
  }

  await OutboxEvent.create({
    eventType: 'paid_session.active',
    aggregateType: 'PAID_SESSION',
    aggregateId: sessionDoc.sessionId,
    payload: {
      sessionId: sessionDoc.sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      communicationType: sessionDoc.communicationType,
      ratePerMinute: sessionDoc.ratePerMinuteSnapshot,
      connectedAt: sessionDoc.connectedAt,
      nextChargeAt: sessionDoc.nextChargeAt,
    },
    payloadSchemaVersion: '1.0',
    deduplicationKey: `outbox:session-active:${sessionDoc.sessionId}`,
    status: OutboxStatuses.PENDING,
  });

  return sessionDoc;
}

/**
 * Record a heartbeat from a participant
 */
async function recordSessionHeartbeat({ userId, sessionId }) {
  if (!userId) {
    throw new PaidSessionError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId });
  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  const isInitiator = sessionDoc.initiatorId.toString() === userId.toString();
  const isReceiver = sessionDoc.receiverId.toString() === userId.toString();

  if (!isInitiator && !isReceiver) {
    throw new PaidSessionError('UNAUTHORIZED_ACTION', 'User is not a participant in this session', 403);
  }

  const now = new Date();
  if (isInitiator) {
    sessionDoc.lastInitiatorHeartbeatAt = now;
  }
  if (isReceiver) {
    sessionDoc.lastReceiverHeartbeatAt = now;
  }

  await sessionDoc.save();
  return { success: true, timestamp: now };
}

/**
 * Explicitly end an active or pending paid communication session
 */
async function endPaidSession({ actorUserId, sessionId, endReason = null }) {
  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId });
  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  // System or participant authorization
  if (actorUserId && actorUserId !== 'SYSTEM') {
    const isParticipant =
      sessionDoc.initiatorId.toString() === actorUserId.toString() ||
      sessionDoc.receiverId.toString() === actorUserId.toString();
    if (!isParticipant) {
      throw new PaidSessionError('UNAUTHORIZED_ACTION', 'User is not authorized to end this session', 403);
    }
  }

  if (
    sessionDoc.status === PaidSessionStatuses.ENDED ||
    sessionDoc.status === PaidSessionStatuses.DECLINED ||
    sessionDoc.status === PaidSessionStatuses.CANCELLED ||
    sessionDoc.status === PaidSessionStatuses.EXPIRED
  ) {
    return sessionDoc; // Idempotent
  }

  sessionDoc.status = PaidSessionStatuses.ENDED;
  sessionDoc.endedAt = new Date();
  sessionDoc.endReason = endReason || PaidSessionEndReasons.USER_HANGUP;
  await sessionDoc.save();

  // Run anomaly inspection asynchronously
  try {
    await fraudProtectionService.analyzeSessionAnomaly(sessionDoc);
  } catch (fraudErr) {
    console.warn('[PAID SESSION] Fraud analysis non-fatal warning:', fraudErr.message);
  }

  await OutboxEvent.create({
    eventType: 'paid_session.ended',
    aggregateType: 'PAID_SESSION',
    aggregateId: sessionId,
    payload: {
      sessionId,
      initiatorId: sessionDoc.initiatorId.toString(),
      receiverId: sessionDoc.receiverId.toString(),
      billedMinutes: sessionDoc.billedMinutes,
      totalCoinsCharged: sessionDoc.totalCoinsCharged,
      endedAt: sessionDoc.endedAt,
      endReason: sessionDoc.endReason,
    },
    payloadSchemaVersion: '1.0',
    deduplicationKey: `outbox:session-ended:${sessionId}:${sessionDoc.endedAt.getTime()}`,
    status: OutboxStatuses.PENDING,
  });

  const ioEnd = getSocketIO();
  if (ioEnd) {
    ioEnd.to(`paid_session:${sessionId}`).to(`user:${sessionDoc.initiatorId}`).to(`user:${sessionDoc.receiverId}`).emit('paid_session.ended', {
      sessionId,
      status: sessionDoc.status,
      endReason: sessionDoc.endReason,
      billedMinutes: sessionDoc.billedMinutes,
      totalCoinsCharged: sessionDoc.totalCoinsCharged,
    });
  }

  return sessionDoc;
}

/**
 * Expire pending sessions that were not accepted in time
 */
async function expirePendingSessions() {
  const now = new Date();
  const expiredSessions = await PaidCommunicationSession.find({
    status: PaidSessionStatuses.PENDING,
    requestExpiresAt: { $lte: now },
  });

  let count = 0;
  for (const sessionDoc of expiredSessions) {
    sessionDoc.status = PaidSessionStatuses.EXPIRED;
    sessionDoc.endedAt = now;
    sessionDoc.endReason = PaidSessionEndReasons.EXPIRED;
    await sessionDoc.save();

    await OutboxEvent.create({
      eventType: 'paid_session.ended',
      aggregateType: 'PAID_SESSION',
      aggregateId: sessionDoc.sessionId,
      payload: {
        sessionId: sessionDoc.sessionId,
        initiatorId: sessionDoc.initiatorId.toString(),
        receiverId: sessionDoc.receiverId.toString(),
        endReason: sessionDoc.endReason,
      },
      payloadSchemaVersion: '1.0',
      deduplicationKey: `outbox:session-expired:${sessionDoc.sessionId}`,
      status: OutboxStatuses.PENDING,
    });
    count++;
  }

  return count;
}

/**
 * Get single paid session with participant authorization
 */
async function getPaidSession(sessionId, actorUserId) {
  if (!sessionId) {
    throw new PaidSessionError('SESSION_ID_REQUIRED', 'Session ID is required', 400);
  }

  const sessionDoc = await PaidCommunicationSession.findOne({ sessionId })
    .populate('initiatorId', 'email phone points accountStatus')
    .populate('receiverId', 'email phone points accountStatus');

  if (!sessionDoc) {
    throw new PaidSessionError('SESSION_NOT_FOUND', 'Session not found', 404);
  }

  if (actorUserId && actorUserId !== 'SYSTEM') {
    const initId = sessionDoc.initiatorId && sessionDoc.initiatorId._id
      ? sessionDoc.initiatorId._id.toString()
      : (sessionDoc.initiatorId ? sessionDoc.initiatorId.toString() : '');
    const recvId = sessionDoc.receiverId && sessionDoc.receiverId._id
      ? sessionDoc.receiverId._id.toString()
      : (sessionDoc.receiverId ? sessionDoc.receiverId.toString() : '');
    const isParticipant = initId === actorUserId.toString() || recvId === actorUserId.toString();
    if (!isParticipant) {
      throw new PaidSessionError('UNAUTHORIZED_ACTION', 'User is not a participant in this session', 403);
    }
  }

  return sessionDoc;
}

/**
 * List user's paid sessions with pagination
 */
async function listUserPaidSessions(userId, { limit = 20, page = 1, status = null } = {}) {
  if (!userId) {
    throw new PaidSessionError('USER_ID_REQUIRED', 'User ID is required', 400);
  }

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * parsedLimit;

  const query = {
    $or: [{ initiatorId: userId }, { receiverId: userId }],
  };

  if (status) {
    query.status = status;
  }

  const [sessions, totalCount] = await Promise.all([
    PaidCommunicationSession.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    PaidCommunicationSession.countDocuments(query),
  ]);

  return {
    sessions,
    pagination: {
      totalCount,
      limit: parsedLimit,
      page: Math.max(parseInt(page, 10) || 1, 1),
    },
  };
}

module.exports = {
  initiatePaidSession,
  acceptPaidSession,
  declinePaidSession,
  cancelPaidSession,
  markParticipantConnected,
  activatePaidSession,
  recordSessionHeartbeat,
  endPaidSession,
  expirePendingSessions,
  getPaidSession,
  listUserPaidSessions,
  PaidSessionError,
};
