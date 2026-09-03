/**
 * Centralized Message Reaction Service
 * R3-09-REQ-001, R3-09-REQ-002, R3-09-REQ-003, R3-09-REQ-004, R3-09-REQ-005, R3-09-REQ-006
 */

const mongoose = require('mongoose');
const Message = require('../models/Message');
const MessageReaction = require('../models/MessageReaction');
const OutboxEvent = require('../models/OutboxEvent');
const { authorizeConversationAccess } = require('./conversationAuthorizationService');
const interactionConfig = require('../config/interactionConfig');
const { MessageReactions } = require('../models/enums');

class ReactionServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'ReactionServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validate and normalize reaction value to canonical enum
 */
function normalizeReaction(input) {
  if (!input || typeof input !== 'string') {
    throw new ReactionServiceError('INVALID_REACTION', 'Reaction value must be a non-empty string', 400);
  }

  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  if (interactionConfig.reactions.aliasMap[trimmed]) {
    return interactionConfig.reactions.aliasMap[trimmed];
  }
  if (interactionConfig.reactions.aliasMap[upper]) {
    return interactionConfig.reactions.aliasMap[upper];
  }

  if (Object.values(MessageReactions).includes(upper)) {
    return upper;
  }

  throw new ReactionServiceError(
    'INVALID_REACTION',
    `Reaction '${input}' is not in the allowed canonical set: ${interactionConfig.reactions.allowed.join(', ')}`,
    400
  );
}

/**
 * Clean helper to convert Mongoose Map / Plain Object to plain summary object
 */
function formatReactionSummary(reactionSummary, currentUserReaction = null) {
  const version = (reactionSummary && reactionSummary.version) || 0;
  const total = Math.max(0, (reactionSummary && reactionSummary.total) || 0);
  const countsObj = {};

  if (reactionSummary && reactionSummary.counts) {
    if (reactionSummary.counts instanceof Map) {
      for (const [k, v] of reactionSummary.counts.entries()) {
        if (v > 0) countsObj[k] = v;
      }
    } else if (typeof reactionSummary.counts === 'object') {
      for (const [k, v] of Object.entries(reactionSummary.counts)) {
        if (v > 0) countsObj[k] = v;
      }
    }
  }

  return {
    version,
    total,
    counts: countsObj,
    ...(currentUserReaction ? { currentUserReaction } : {}),
  };
}

/**
 * Add or update a reaction on a message
 * R3-09-REQ-001, R3-09-REQ-003, R3-09-REQ-004, R3-09-REQ-005, R3-09-REQ-006
 */
async function addOrUpdateReaction({ actorUserId, conversationId, messageId, reaction }) {
  if (!actorUserId) {
    throw new ReactionServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }
  if (!conversationId) {
    throw new ReactionServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }
  if (!messageId) {
    throw new ReactionServiceError('MESSAGE_ID_REQUIRED', 'messageId is required', 400);
  }

  const normalized = normalizeReaction(reaction);

  // 1. Centralized Conversation Authorization
  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'SEND_MESSAGE',
  });

  // 2. Validate Target Message exists in conversation and is not deleted
  const message = await Message.findById(messageId);
  if (!message || message.conversationId.toString() !== conversationId.toString()) {
    throw new ReactionServiceError('MESSAGE_NOT_FOUND', 'Message was not found in this conversation', 404);
  }

  if (message.status === 'DELETED') {
    throw new ReactionServiceError('MESSAGE_UNAVAILABLE', 'Cannot react to a deleted or unsent message', 400);
  }

  // 3. Find existing reaction by this user on this message
  const existingReaction = await MessageReaction.findOne({
    messageId: message._id,
    userId: actorUserId,
  });

  // Idempotency: submitting the same reaction is a no-op
  if (existingReaction && existingReaction.reaction === normalized) {
    return {
      success: true,
      changed: false,
      reaction: normalized,
      summary: formatReactionSummary(message.reactionSummary, normalized),
    };
  }

  const previousReaction = existingReaction ? existingReaction.reaction : null;

  // 4. Update or Create Reaction Document
  if (existingReaction) {
    existingReaction.reaction = normalized;
    await existingReaction.save();
  } else {
    await MessageReaction.create({
      conversationId: message.conversationId,
      messageId: message._id,
      userId: actorUserId,
      reaction: normalized,
    });
  }

  // 5. Update Materialized Reaction Summary on Message with Invariant Enforcement
  if (!message.reactionSummary) {
    message.reactionSummary = { version: 0, total: 0, counts: new Map() };
  }
  if (!message.reactionSummary.counts) {
    message.reactionSummary.counts = new Map();
  }

  const countsMap = message.reactionSummary.counts instanceof Map
    ? message.reactionSummary.counts
    : new Map(Object.entries(message.reactionSummary.counts || {}));

  if (previousReaction) {
    const prevCount = countsMap.get(previousReaction) || 0;
    const newPrevCount = Math.max(0, prevCount - 1);
    if (newPrevCount === 0) {
      countsMap.delete(previousReaction);
    } else {
      countsMap.set(previousReaction, newPrevCount);
    }
  } else {
    message.reactionSummary.total = (message.reactionSummary.total || 0) + 1;
  }

  const newCount = (countsMap.get(normalized) || 0) + 1;
  countsMap.set(normalized, newCount);

  message.reactionSummary.counts = countsMap;
  message.reactionSummary.version = (message.reactionSummary.version || 0) + 1;
  await message.save();

  const formattedSummary = formatReactionSummary(message.reactionSummary, normalized);

  // 6. Record Outbox Event (R3-09-REQ-006)
  try {
    await OutboxEvent.create({
      eventType: 'message.reaction.updated',
      aggregateType: 'MESSAGE',
      aggregateId: message._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_rx_${message._id}_${actorUserId}_${Date.now()}`,
        conversationId: conversationId.toString(),
        messageId: message._id.toString(),
        actorUserId: actorUserId.toString(),
        reaction: normalized,
        operation: 'SET',
        reactionSummaryVersion: formattedSummary.version,
        reactionSummary: {
          total: formattedSummary.total,
          counts: formattedSummary.counts,
        },
        committedAt: new Date().toISOString(),
      },
      deduplicationKey: `rx_set_${message._id}_${actorUserId}_${formattedSummary.version}`,
    });
  } catch (outboxErr) {
    console.warn('[REACTION SERVICE] Outbox event recording warning:', outboxErr.message);
  }

  return {
    success: true,
    changed: true,
    reaction: normalized,
    summary: formattedSummary,
  };
}

/**
 * Remove a reaction from a message
 * R3-09-REQ-003, R3-09-REQ-005, R3-09-REQ-006
 */
async function removeReaction({ actorUserId, conversationId, messageId }) {
  if (!actorUserId) {
    throw new ReactionServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }
  if (!conversationId) {
    throw new ReactionServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }
  if (!messageId) {
    throw new ReactionServiceError('MESSAGE_ID_REQUIRED', 'messageId is required', 400);
  }

  // 1. Centralized Conversation Authorization
  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'SEND_MESSAGE',
  });

  const message = await Message.findById(messageId);
  if (!message || message.conversationId.toString() !== conversationId.toString()) {
    throw new ReactionServiceError('MESSAGE_NOT_FOUND', 'Message was not found in this conversation', 404);
  }

  const existingReaction = await MessageReaction.findOne({
    messageId: message._id,
    userId: actorUserId,
  });

  // Idempotent: removing non-existent reaction is a no-op
  if (!existingReaction) {
    return {
      success: true,
      changed: false,
      summary: formatReactionSummary(message.reactionSummary, null),
    };
  }

  const oldReaction = existingReaction.reaction;
  await MessageReaction.findByIdAndDelete(existingReaction._id);

  // 2. Decrement Materialized Summary atomically
  if (!message.reactionSummary) {
    message.reactionSummary = { version: 0, total: 0, counts: new Map() };
  }
  const countsMap = message.reactionSummary.counts instanceof Map
    ? message.reactionSummary.counts
    : new Map(Object.entries(message.reactionSummary.counts || {}));

  const prevCount = countsMap.get(oldReaction) || 0;
  const newPrevCount = Math.max(0, prevCount - 1);
  if (newPrevCount === 0) {
    countsMap.delete(oldReaction);
  } else {
    countsMap.set(oldReaction, newPrevCount);
  }

  message.reactionSummary.total = Math.max(0, (message.reactionSummary.total || 1) - 1);
  message.reactionSummary.counts = countsMap;
  message.reactionSummary.version = (message.reactionSummary.version || 0) + 1;
  await message.save();

  const formattedSummary = formatReactionSummary(message.reactionSummary, null);

  // 3. Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'message.reaction.updated',
      aggregateType: 'MESSAGE',
      aggregateId: message._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_rx_rem_${message._id}_${actorUserId}_${Date.now()}`,
        conversationId: conversationId.toString(),
        messageId: message._id.toString(),
        actorUserId: actorUserId.toString(),
        reaction: oldReaction,
        operation: 'REMOVE',
        reactionSummaryVersion: formattedSummary.version,
        reactionSummary: {
          total: formattedSummary.total,
          counts: formattedSummary.counts,
        },
        committedAt: new Date().toISOString(),
      },
      deduplicationKey: `rx_rem_${message._id}_${actorUserId}_${formattedSummary.version}`,
    });
  } catch (outboxErr) {
    console.warn('[REACTION SERVICE] Outbox event recording warning:', outboxErr.message);
  }

  return {
    success: true,
    changed: true,
    summary: formattedSummary,
  };
}

/**
 * Get paginated reactor list for a message
 */
async function getMessageReactions({ actorUserId, conversationId, messageId, limit = 50 }) {
  if (!actorUserId) {
    throw new ReactionServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const boundedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const reactions = await MessageReaction.find({
    conversationId,
    messageId,
  })
    .sort({ createdAt: -1 })
    .limit(boundedLimit)
    .lean();

  return {
    items: reactions.map((r) => ({
      userId: r.userId.toString(),
      reaction: r.reaction,
      createdAt: r.createdAt,
    })),
    total: reactions.length,
  };
}

module.exports = {
  ReactionServiceError,
  normalizeReaction,
  formatReactionSummary,
  addOrUpdateReaction,
  removeReaction,
  getMessageReactions,
};
