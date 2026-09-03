const crypto = require('crypto');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const DatingProfile = require('../models/DatingProfile');
const User = require('../models/User');
const { MemberStates, ConversationStatuses } = require('../models/enums');
const { authorizeConversationAccess, ConversationAuthorizationError } = require('./conversationAuthorizationService');
const { formatMessageDto } = require('./messageService');
const { getConversationReceiptState } = require('./receiptService');

class SyncServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'SyncServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Sign an opaque cryptographic sync cursor bound to user, conversation, and high-water sequence
 * R3-07-REQ-005, R3-07-REQ-006, R3-07-REQ-021
 */
function createSyncCursor(payload) {
  const secret = process.env.JWT_SECRET || 'rubaru_sync_cursor_secret_2026';
  const dataString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  return `cur_sync_${dataString}.${signature}`;
}

/**
 * Verify and decode an opaque sync cursor
 * R3-07-REQ-006, R3-07-REQ-021
 */
function verifySyncCursor(cursorString, expectedUserId, expectedConversationId) {
  if (!cursorString || typeof cursorString !== 'string' || !cursorString.startsWith('cur_sync_')) {
    throw new SyncServiceError('INVALID_SYNC_CURSOR', 'Sync cursor format is invalid', 400);
  }

  const raw = cursorString.substring(9);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new SyncServiceError('INVALID_SYNC_CURSOR', 'Sync cursor structure is malformed', 400);
  }

  const [dataString, signature] = parts;
  const secret = process.env.JWT_SECRET || 'rubaru_sync_cursor_secret_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');

  if (signature !== expectedSig) {
    throw new SyncServiceError('SYNC_CURSOR_TAMPERED', 'Sync cursor signature verification failed', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
  } catch (err) {
    throw new SyncServiceError('INVALID_SYNC_CURSOR', 'Sync cursor payload cannot be decoded', 400);
  }

  if (payload.exp && payload.exp < Date.now()) {
    throw new SyncServiceError('SYNC_CURSOR_EXPIRED', 'Sync cursor has expired. Please restart catch-up from your last applied sequence.', 400);
  }

  if (expectedUserId && payload.userId !== expectedUserId.toString()) {
    throw new SyncServiceError('SYNC_CURSOR_SCOPE_MISMATCH', 'Sync cursor does not belong to the authenticated user', 403);
  }

  if (expectedConversationId && payload.conversationId !== expectedConversationId.toString()) {
    throw new SyncServiceError('SYNC_CURSOR_SCOPE_MISMATCH', 'Sync cursor does not belong to the requested conversation', 403);
  }

  return payload;
}

/**
 * Sign an opaque cursor for Sync Manifest pagination
 */
function createManifestCursor(payload) {
  const secret = process.env.JWT_SECRET || 'rubaru_sync_cursor_secret_2026';
  const dataString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  return `cur_man_${dataString}.${signature}`;
}

/**
 * Verify and decode an opaque manifest cursor
 */
function verifyManifestCursor(cursorString, expectedUserId) {
  if (!cursorString || typeof cursorString !== 'string' || !cursorString.startsWith('cur_man_')) {
    throw new SyncServiceError('INVALID_SYNC_CURSOR', 'Manifest cursor format is invalid', 400);
  }

  const raw = cursorString.substring(8);
  const parts = raw.split('.');
  if (parts.length !== 2) {
    throw new SyncServiceError('INVALID_SYNC_CURSOR', 'Manifest cursor structure is malformed', 400);
  }

  const [dataString, signature] = parts;
  const secret = process.env.JWT_SECRET || 'rubaru_sync_cursor_secret_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');

  if (signature !== expectedSig) {
    throw new SyncServiceError('SYNC_CURSOR_TAMPERED', 'Manifest cursor signature verification failed', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
  } catch (err) {
    throw new SyncServiceError('INVALID_SYNC_CURSOR', 'Manifest cursor payload cannot be decoded', 400);
  }

  if (payload.exp && payload.exp < Date.now()) {
    throw new SyncServiceError('SYNC_CURSOR_EXPIRED', 'Manifest cursor has expired', 400);
  }

  if (expectedUserId && payload.userId !== expectedUserId.toString()) {
    throw new SyncServiceError('SYNC_CURSOR_SCOPE_MISMATCH', 'Manifest cursor user mismatch', 403);
  }

  return payload;
}

/**
 * Get bounded conversation synchronization manifest for reconnecting client
 * R3-07-REQ-001, R3-07-REQ-002, R3-07-REQ-019
 * @param {Object} params
 * @param {string} params.actorUserId - Authenticated User ID
 * @param {string} [params.cursor] - Manifest pagination cursor
 * @param {number} [params.limit=50] - Bounded page limit
 */
async function getConversationSyncManifest({ actorUserId, cursor, limit = 50 }) {
  if (!actorUserId) {
    throw new SyncServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const boundedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  let offset = 0;

  if (cursor) {
    const decoded = verifyManifestCursor(cursor, actorUserId);
    offset = decoded.offset || 0;
  }

  // Fetch user's conversation memberships (both active and inactive for revocation sync)
  const memberDocs = await ConversationMember.find({
    userId: actorUserId,
  })
    .sort({ updatedAt: -1, _id: -1 })
    .populate('conversationId')
    .lean();

  const pageMembers = memberDocs.slice(offset, offset + boundedLimit);
  const hasMore = offset + boundedLimit < memberDocs.length;

  const nextCursor = hasMore
    ? createManifestCursor({
        userId: actorUserId.toString(),
        offset: offset + boundedLimit,
        exp: Date.now() + 3600000,
      })
    : null;

  const items = pageMembers.map((m) => {
    const conv = m.conversationId || m.conversation;

    // Handle closed/revoked conversation or inactive member
    const isRevoked = !conv || conv.status !== ConversationStatuses.ACTIVE || m.state !== MemberStates.ACTIVE;
    const accessState = isRevoked ? 'ACCESS_REVOKED' : m.state || 'ACTIVE';

    const latestSeq = conv && !isRevoked ? (conv.lastSequence || 0) : 0;
    const delSeq = m.deliveredThroughSequence || m.lastDeliveredSequence || 0;
    const readSeq = m.readThroughSequence || m.lastReadSequence || 0;

    return {
      conversationId: conv ? conv._id.toString() : m.conversationId ? m.conversationId.toString() : '',
      accessState,
      latestSequence: latestSeq,
      deliveredThroughSequence: delSeq,
      readThroughSequence: readSeq,
      catchUpRequired: !isRevoked && latestSeq > readSeq,
      updatedAt: conv ? conv.updatedAt : m.updatedAt,
    };
  });

  return {
    items,
    nextCursor,
    hasMore,
    serverTime: new Date().toISOString(),
  };
}

/**
 * Forward sequence-based catch-up query with stable high-water boundary and gap detection
 * R3-07-REQ-003, R3-07-REQ-004, R3-07-REQ-005, R3-07-REQ-006, R3-07-REQ-007, R3-07-REQ-014, R3-07-REQ-025
 * @param {Object} params
 * @param {string} params.actorUserId - Authenticated User ID
 * @param {string} params.conversationId - Conversation ID
 * @param {number} [params.afterSequence] - Sequence from which to catch up (exclusive)
 * @param {string} [params.cursor] - Resumable opaque sync cursor
 * @param {number} [params.limit=50] - Page size limit
 */
async function syncConversationMessages({ actorUserId, conversationId, afterSequence, cursor, limit = 50 }) {
  if (!actorUserId) {
    throw new SyncServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  if (!conversationId) {
    throw new SyncServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }

  // 1. Centralized Authorization Check on EVERY page request (R3-07-REQ-020)
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const { conversation } = authContext;
  const boundedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  let currentAfterSeq = 0;
  let initialAfterSeq = 0;
  let stableThroughSeq = 0;

  // 2. Cursor or Initial Request resolution (R3-07-REQ-004, R3-07-REQ-006)
  if (cursor) {
    const cursorPayload = verifySyncCursor(cursor, actorUserId, conversationId);
    currentAfterSeq = cursorPayload.lastReturnedSequence || cursorPayload.afterSequence || 0;
    initialAfterSeq = cursorPayload.afterSequence || 0;
    stableThroughSeq = cursorPayload.throughSequence;
  } else {
    // Validate initial afterSequence
    if (afterSequence === undefined || afterSequence === null) {
      afterSequence = 0;
    }

    const numAfter = Number(afterSequence);
    if (!Number.isInteger(numAfter) || numAfter < 0 || !Number.isFinite(numAfter)) {
      throw new SyncServiceError('INVALID_AFTER_SEQUENCE', 'afterSequence must be a non-negative integer', 400);
    }

    const maxConvSeq = conversation.lastSequence || 0;
    if (numAfter > maxConvSeq) {
      throw new SyncServiceError(
        'AFTER_SEQUENCE_AHEAD',
        `afterSequence (${numAfter}) exceeds conversation latest sequence (${maxConvSeq})`,
        400
      );
    }

    currentAfterSeq = numAfter;
    initialAfterSeq = numAfter;
    // Capture Stable High-Water Sequence at start of session (R3-07-REQ-004)
    stableThroughSeq = maxConvSeq;
  }

  // 3. Forward MongoDB Query with Compound Sequence Index (R3-07-REQ-003, R3-07-REQ-023)
  const queryLimit = boundedLimit + 1; // Lookahead 1 item for hasMore
  const messages = await Message.find({
    conversationId: conversation._id,
    sequence: {
      $gt: currentAfterSeq,
      $lte: stableThroughSeq,
    },
  })
    .sort({ sequence: 1 })
    .limit(queryLimit)
    .lean();

  const hasMore = messages.length > boundedLimit;
  const pageMessages = hasMore ? messages.slice(0, boundedLimit) : messages;

  // 4. Load Peer Watermarks for Message Delivery Status Formatting (Zero N+1)
  const receiptStateResult = await getConversationReceiptState({
    actorUserId,
    conversationId: conversation._id.toString(),
  });
  const peerWatermarks = receiptStateResult.receiptState.peer;

  // 4b. Bulk Load Reply Previews, Polls, and User Reactions (R3-09-REQ-009, R3-09-REQ-018, R3-09-REQ-023)
  const Poll = require('../models/Poll');
  const PollVote = require('../models/PollVote');
  const MessageReaction = require('../models/MessageReaction');
  const { formatReplyPreview } = require('./messageService');
  const { formatPollDto } = require('./pollService');

  const replyTargetIds = pageMessages.map((m) => m.replyToMessageId || m.replyTo).filter(Boolean);
  const replyTargets = replyTargetIds.length > 0
    ? await Message.find({ _id: { $in: replyTargetIds } }).lean()
    : [];
  const replyTargetMap = new Map(replyTargets.map((t) => [t._id.toString(), formatReplyPreview(t)]));

  const pollIds = pageMessages.map((m) => m.pollId).filter(Boolean);
  const polls = pollIds.length > 0
    ? await Poll.find({ _id: { $in: pollIds } }).lean()
    : [];
  const userVotes = pollIds.length > 0
    ? await PollVote.find({ pollId: { $in: pollIds }, userId: actorUserId }).lean()
    : [];
  const userVoteMap = new Map(userVotes.map((v) => [v.pollId.toString(), v.optionIds]));
  const pollDtoMap = new Map(polls.map((p) => [p._id.toString(), formatPollDto(p, actorUserId, userVoteMap.get(p._id.toString()) || [])]));

  const msgIds = pageMessages.map((m) => m._id);
  const userReactions = msgIds.length > 0
    ? await MessageReaction.find({ messageId: { $in: msgIds }, userId: actorUserId }).lean()
    : [];
  const userReactionMap = new Map(userReactions.map((r) => [r.messageId.toString(), r.reaction]));

  const formattedMessages = pageMessages.map((m) => {
    const replyTargetIdStr = m.replyToMessageId ? m.replyToMessageId.toString() : (m.replyTo ? m.replyTo.toString() : null);
    const replyPreview = replyTargetIdStr ? replyTargetMap.get(replyTargetIdStr) : null;
    const pollDto = m.pollId ? pollDtoMap.get(m.pollId.toString()) : null;
    const currentRx = userReactionMap.get(m._id.toString()) || null;
    return formatMessageDto(m, peerWatermarks, replyPreview, pollDto, currentRx);
  });

  // 5. Sequence Gap Detection (R3-07-REQ-007)
  const expectedNextSequence = currentAfterSeq + 1;
  const firstReturnedSequence = pageMessages.length > 0 ? pageMessages[0].sequence : null;
  const lastReturnedSequence = pageMessages.length > 0 ? pageMessages[pageMessages.length - 1].sequence : currentAfterSeq;

  let gapDetected = false;
  if (pageMessages.length > 0) {
    if (pageMessages[0].sequence > expectedNextSequence) {
      gapDetected = true;
    }
  } else if (currentAfterSeq < stableThroughSeq) {
    // Query returned empty even though sequence range was expected
    gapDetected = true;
  }

  // 6. Resumable Continuation Cursor (R3-07-REQ-005, R3-07-REQ-006)
  const nextCursor = hasMore
    ? createSyncCursor({
        version: 1,
        userId: actorUserId.toString(),
        conversationId: conversation._id.toString(),
        afterSequence: initialAfterSeq,
        throughSequence: stableThroughSeq,
        lastReturnedSequence,
        limit: boundedLimit,
        exp: Date.now() + 3600000, // 1 hour TTL
      })
    : null;

  return {
    conversationId: conversation._id.toString(),
    afterSequence: initialAfterSeq,
    throughSequence: stableThroughSeq,
    firstReturnedSequence,
    lastReturnedSequence,
    nextExpectedSequence: lastReturnedSequence + 1,
    gapDetected,
    messages: formattedMessages,
    hasMore,
    nextCursor,
    receiptState: receiptStateResult.receiptState,
  };
}

/**
 * Reconnect subscription handshake evaluation
 * R3-07-REQ-008, R3-07-REQ-009
 * @param {Object} params
 * @param {string} params.actorUserId - Authenticated User ID
 * @param {string} params.conversationId - Conversation ID
 * @param {number} [params.afterSequence=0] - Client's last contiguous local sequence
 */
async function subscribeAndSyncHandshake({ actorUserId, conversationId, afterSequence = 0 }) {
  try {
    const authContext = await authorizeConversationAccess({
      actorUserId,
      conversationId,
      operation: 'VIEW',
    });

    const { conversation } = authContext;
    const latestSeq = conversation.lastSequence || 0;
    const clientSeq = Math.max(0, parseInt(afterSequence, 10) || 0);

    const syncRequired = latestSeq > clientSeq;
    const status = syncRequired ? 'SYNC_REQUIRED' : 'UP_TO_DATE';

    return {
      ok: true,
      status,
      conversationId: conversation._id.toString(),
      latestSequence: latestSeq,
      throughSequence: latestSeq,
      syncRequired,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'ACCESS_REVOKED',
      code: err.code || 'CONVERSATION_ACCESS_REVOKED',
      message: err.message,
    };
  }
}

module.exports = {
  getConversationSyncManifest,
  syncConversationMessages,
  subscribeAndSyncHandshake,
  createSyncCursor,
  verifySyncCursor,
  createManifestCursor,
  verifyManifestCursor,
  SyncServiceError,
};
