const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const OutboxEvent = require('../models/OutboxEvent');
const { authorizeConversationAccess, ConversationAuthorizationError } = require('./conversationAuthorizationService');

class ReceiptServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'ReceiptServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validate sequence input
 */
function validateSequenceInput(throughSequence) {
  if (
    throughSequence === undefined ||
    throughSequence === null ||
    typeof throughSequence !== 'number' ||
    !Number.isInteger(throughSequence) ||
    Number.isNaN(throughSequence) ||
    !Number.isFinite(throughSequence) ||
    throughSequence < 0 ||
    throughSequence > Number.MAX_SAFE_INTEGER
  ) {
    throw new ReceiptServiceError(
      'INVALID_RECEIPT_SEQUENCE',
      'throughSequence must be a non-negative safe integer',
      400
    );
  }
  return throughSequence;
}

/**
 * Advance delivery watermark for an authenticated conversation member
 * R3-06-REQ-001, R3-06-REQ-003, R3-06-REQ-005, R3-06-REQ-011, R3-06-REQ-012, R3-06-REQ-013
 */
async function advanceDeliveryWatermark({ actorUserId, conversationId, throughSequence }) {
  if (!actorUserId) {
    throw new ReceiptServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  if (!conversationId) {
    throw new ReceiptServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }

  const validSeq = validateSequenceInput(throughSequence);

  // 1. Centralized Conversation Authorization
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const { conversation, member } = authContext;

  // 2. Bound sequence against authoritative conversation sequence (R3-06-REQ-005)
  const maxConvSeq = conversation.lastSequence || 0;
  if (validSeq > maxConvSeq) {
    throw new ReceiptServiceError(
      'RECEIPT_SEQUENCE_AHEAD',
      `throughSequence (${validSeq}) exceeds committed conversation sequence (${maxConvSeq})`,
      400
    );
  }

  // 3. Monotonic advancement check (R3-06-REQ-003, R3-06-REQ-018)
  const currentDelivered = member.deliveredThroughSequence || member.lastDeliveredSequence || 0;
  const currentRead = member.readThroughSequence || member.lastReadSequence || 0;

  if (validSeq <= currentDelivered) {
    // Idempotent duplicate or stale update: No-op
    return {
      conversationId: conversation._id.toString(),
      deliveredThroughSequence: currentDelivered,
      readThroughSequence: currentRead,
      deliveredAt: member.deliveredAt || null,
      readAt: member.readAt || null,
      changed: false,
    };
  }

  // 4. Advance Delivery Watermark Atomically via $max (R3-06-REQ-003, R3-06-REQ-026)
  const now = new Date();
  const updatedMember = await ConversationMember.findOneAndUpdate(
    {
      conversationId: conversation._id,
      userId: actorUserId,
    },
    {
      $max: {
        deliveredThroughSequence: validSeq,
        lastDeliveredSequence: validSeq,
      },
      $set: {
        deliveredAt: now,
      },
      $inc: {
        receiptVersion: 1,
      },
    },
    { new: true }
  );

  const finalDelivered = updatedMember.deliveredThroughSequence || validSeq;
  const finalRead = updatedMember.readThroughSequence || currentRead;

  // 5. Create Transactional Outbox Event (R3-06-REQ-013, R3-06-REQ-014)
  try {
    await OutboxEvent.create({
      eventType: 'conversation.receipt_watermark.updated',
      aggregateType: 'CONVERSATION',
      aggregateId: conversation._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_rcpt_del_${conversation._id}_${actorUserId}_${validSeq}_${now.getTime()}`,
        conversationId: conversation._id.toString(),
        actorUserId: actorUserId.toString(),
        deliveredThroughSequence: finalDelivered,
        readThroughSequence: finalRead,
        deliveredAt: updatedMember.deliveredAt ? updatedMember.deliveredAt.toISOString() : now.toISOString(),
        readAt: updatedMember.readAt ? updatedMember.readAt.toISOString() : null,
        receiptType: 'DELIVERED',
      },
      deduplicationKey: `rcpt_del_${conversation._id}_${actorUserId}_${validSeq}`,
    });
  } catch (outboxErr) {
    console.warn('[RECEIPT SERVICE] Outbox recording warning:', outboxErr.message);
  }

  return {
    conversationId: conversation._id.toString(),
    deliveredThroughSequence: finalDelivered,
    readThroughSequence: finalRead,
    deliveredAt: updatedMember.deliveredAt || now,
    readAt: updatedMember.readAt || null,
    changed: true,
  };
}

/**
 * Advance read watermark for an authenticated conversation member (Read implies delivered)
 * R3-06-REQ-002, R3-06-REQ-003, R3-06-REQ-004, R3-06-REQ-005, R3-06-REQ-011, R3-06-REQ-012, R3-06-REQ-013
 */
async function advanceReadWatermark({ actorUserId, conversationId, throughSequence }) {
  if (!actorUserId) {
    throw new ReceiptServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  if (!conversationId) {
    throw new ReceiptServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }

  const validSeq = validateSequenceInput(throughSequence);

  // 1. Centralized Conversation Authorization
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const { conversation, member } = authContext;

  // 2. Bound sequence against authoritative conversation sequence
  const maxConvSeq = conversation.lastSequence || 0;
  if (validSeq > maxConvSeq) {
    throw new ReceiptServiceError(
      'RECEIPT_SEQUENCE_AHEAD',
      `throughSequence (${validSeq}) exceeds committed conversation sequence (${maxConvSeq})`,
      400
    );
  }

  // 3. Monotonic & Read-Implies-Delivered advancement check (R3-06-REQ-004)
  const currentDelivered = member.deliveredThroughSequence || member.lastDeliveredSequence || 0;
  const currentRead = member.readThroughSequence || member.lastReadSequence || 0;

  if (validSeq <= currentRead && validSeq <= currentDelivered) {
    // Idempotent duplicate or stale update: No-op
    return {
      conversationId: conversation._id.toString(),
      deliveredThroughSequence: currentDelivered,
      readThroughSequence: currentRead,
      deliveredAt: member.deliveredAt || null,
      readAt: member.readAt || null,
      changed: false,
    };
  }

  // 4. Update Database Atomically via $max (Read implies delivered) (R3-06-REQ-004, R3-06-REQ-026)
  const now = new Date();
  const updateFields = {
    $max: {
      readThroughSequence: validSeq,
      lastReadSequence: validSeq,
      deliveredThroughSequence: validSeq,
      lastDeliveredSequence: validSeq,
    },
    $set: {
      readAt: now,
    },
    $inc: {
      receiptVersion: 1,
    },
  };

  if (!member.deliveredAt || validSeq > currentDelivered) {
    updateFields.$set.deliveredAt = now;
  }

  const updatedMember = await ConversationMember.findOneAndUpdate(
    {
      conversationId: conversation._id,
      userId: actorUserId,
    },
    updateFields,
    { new: true }
  );

  const finalRead = updatedMember.readThroughSequence || validSeq;
  const finalDelivered = updatedMember.deliveredThroughSequence || validSeq;

  // 5. Create Transactional Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'conversation.receipt_watermark.updated',
      aggregateType: 'CONVERSATION',
      aggregateId: conversation._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_rcpt_read_${conversation._id}_${actorUserId}_${validSeq}_${now.getTime()}`,
        conversationId: conversation._id.toString(),
        actorUserId: actorUserId.toString(),
        deliveredThroughSequence: finalDelivered,
        readThroughSequence: finalRead,
        deliveredAt: updatedMember.deliveredAt ? updatedMember.deliveredAt.toISOString() : now.toISOString(),
        readAt: now.toISOString(),
        receiptType: 'READ',
      },
      deduplicationKey: `rcpt_read_${conversation._id}_${actorUserId}_${validSeq}`,
    });
  } catch (outboxErr) {
    console.warn('[RECEIPT SERVICE] Outbox recording warning:', outboxErr.message);
  }

  return {
    conversationId: conversation._id.toString(),
    deliveredThroughSequence: finalDelivered,
    readThroughSequence: finalRead,
    deliveredAt: updatedMember.deliveredAt || now,
    readAt: updatedMember.readAt || now,
    changed: true,
  };
}

/**
 * Get receipt state for an authorized conversation (Self & Peer watermarks)
 * R3-06-REQ-016
 */
async function getConversationReceiptState({ actorUserId, conversationId }) {
  const authContext = await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const members = await ConversationMember.find({
    conversationId: authContext.conversation._id,
  }).lean();

  let selfState = {
    deliveredThroughSequence: 0,
    readThroughSequence: 0,
    deliveredAt: null,
    readAt: null,
  };

  let peerState = {
    deliveredThroughSequence: 0,
    readThroughSequence: 0,
    deliveredAt: null,
    readAt: null,
  };

  for (const m of members) {
    const mUserId = (m.userId || m.user).toString();
    const stateObj = {
      deliveredThroughSequence: m.deliveredThroughSequence || m.lastDeliveredSequence || 0,
      readThroughSequence: m.readThroughSequence || m.lastReadSequence || 0,
      deliveredAt: m.deliveredAt || null,
      readAt: m.readAt || null,
    };

    if (mUserId === actorUserId.toString()) {
      selfState = stateObj;
    } else {
      peerState = stateObj;
    }
  }

  return {
    conversationId: authContext.conversation._id.toString(),
    receiptState: {
      self: selfState,
      peer: peerState,
    },
  };
}

/**
 * Derive direct message delivery/read status from peer member watermarks
 * R3-06-REQ-015
 * @param {Object} params
 * @param {Object} params.message - Message document or object
 * @param {Object} [params.peerWatermarks] - Peer watermark state { deliveredThroughSequence, readThroughSequence }
 * @returns {string} 'SENT' | 'DELIVERED' | 'READ' | 'DELETED'
 */
function deriveDirectMessageStatus({ message, peerWatermarks = null }) {
  if (!message) return 'SENT';

  if (message.status === 'DELETED') {
    return 'DELETED';
  }

  if (!peerWatermarks) {
    return message.status || 'SENT';
  }

  const seq = message.sequence || 0;
  const peerRead = peerWatermarks.readThroughSequence || peerWatermarks.lastReadSequence || 0;
  const peerDelivered = peerWatermarks.deliveredThroughSequence || peerWatermarks.lastDeliveredSequence || 0;

  if (peerRead >= seq) {
    return 'READ';
  }

  if (peerDelivered >= seq) {
    return 'DELIVERED';
  }

  return 'SENT';
}

module.exports = {
  advanceDeliveryWatermark,
  advanceReadWatermark,
  getConversationReceiptState,
  deriveDirectMessageStatus,
  validateSequenceInput,
  ReceiptServiceError,
};
