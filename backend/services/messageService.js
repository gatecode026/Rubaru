const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MediaAsset = require('../models/MediaAsset');
const Poll = require('../models/Poll');
const OutboxEvent = require('../models/OutboxEvent');
const { authorizeConversationAccess } = require('./conversationAuthorizationService');
const mediaConfig = require('../config/mediaConfig');
const { formatReactionSummary } = require('./reactionService');
const { createPollDocument, formatPollDto } = require('./pollService');

class MessageServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'MessageServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Format a safe, sanitized reply preview
 * R3-09-REQ-009, R3-09-REQ-010
 */
function formatReplyPreview(targetMsg) {
  if (!targetMsg) return null;

  const isUnavailable = targetMsg.status === 'DELETED';
  let textPreview = '';

  if (isUnavailable) {
    textPreview = 'This message was unsent.';
  } else if (targetMsg.text) {
    textPreview = targetMsg.text.length > 120 ? `${targetMsg.text.substring(0, 117)}...` : targetMsg.text;
  } else if (targetMsg.attachments && targetMsg.attachments.length > 0) {
    textPreview = `[${targetMsg.attachments[0].type || 'ATTACHMENT'}]`;
  } else if (targetMsg.type === 'POLL') {
    textPreview = '[POLL]';
  }

  const firstAttachmentCategory = (!isUnavailable && targetMsg.attachments && targetMsg.attachments[0])
    ? targetMsg.attachments[0].type
    : null;

  return {
    messageId: targetMsg._id.toString(),
    sequence: targetMsg.sequence || 0,
    senderId: targetMsg.senderId ? targetMsg.senderId.toString() : '',
    messageType: targetMsg.type || 'TEXT',
    textPreview,
    attachmentCategory: firstAttachmentCategory,
    isUnavailable,
  };
}

/**
 * Format clean message DTO for responses and events
 * R3-09-REQ-004, R3-09-REQ-009, R3-09-REQ-018, R3-09-REQ-023
 */
function formatMessageDto(msg, peerWatermarks = null, replyPreview = null, pollDto = null, currentUserReaction = null) {
  const formattedAttachments = (msg.attachments || []).map((att) => ({
    mediaAssetId: att.mediaAssetId ? att.mediaAssetId.toString() : '',
    type: att.type,
    mimeType: att.mimeType,
    fileSize: att.fileSize || 0,
    width: att.width || 0,
    height: att.height || 0,
    durationMs: att.durationMs || 0,
    waveform: att.waveform || null,
    thumbnailUrl: att.thumbnailKey ? `/uploads/media/${att.thumbnailKey}` : null,
  }));

  let derivedDeliveryStatus = msg.status || 'SENT';
  if (msg.status === 'DELETED') {
    derivedDeliveryStatus = 'DELETED';
  } else if (peerWatermarks) {
    const { deriveDirectMessageStatus } = require('./receiptService');
    derivedDeliveryStatus = deriveDirectMessageStatus({ message: msg, peerWatermarks });
  }

  // Resolve reply preview if msg.replyTo was populated or passed in
  let resolvedReplyPreview = replyPreview;
  if (!resolvedReplyPreview && msg.replyTo && typeof msg.replyTo === 'object') {
    resolvedReplyPreview = formatReplyPreview(msg.replyTo);
  }

  // Resolve poll DTO if msg.poll was populated or passed in
  let resolvedPollDto = pollDto;
  if (!resolvedPollDto && msg.poll && typeof msg.poll === 'object') {
    resolvedPollDto = formatPollDto(msg.poll);
  }

  return {
    id: msg._id.toString(),
    conversationId: msg.conversationId ? msg.conversationId.toString() : (msg.chat ? msg.chat.toString() : ''),
    senderId: msg.senderId ? msg.senderId.toString() : (msg.sender ? msg.sender.toString() : ''),
    clientMessageId: msg.clientMessageId || null,
    sequence: msg.sequence || 0,
    type: msg.type || 'TEXT',
    text: msg.text || '',
    attachments: formattedAttachments,
    replyToMessageId: msg.replyToMessageId ? msg.replyToMessageId.toString() : (msg.replyTo ? msg.replyTo.toString() : null),
    replyToSequence: msg.replyToSequence || null,
    replyTo: resolvedReplyPreview || null,
    pollId: msg.pollId ? msg.pollId.toString() : null,
    poll: resolvedPollDto || null,
    reactionSummary: formatReactionSummary(msg.reactionSummary, currentUserReaction),
    status: msg.status || 'ACTIVE',
    deliveryStatus: derivedDeliveryStatus,
    createdAt: msg.createdAt,
    updatedAt: msg.updatedAt,
  };
}

/**
 * Persist an authoritative message (text, attachment, reply, or poll) durably and record transactional outbox event
 * @param {Object} params
 * @param {string} params.actorUserId - Authenticated User ID
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.clientMessageId - Client generated unique correlation ID
 * @param {string} [params.text=''] - Message content / caption
 * @param {string} [params.type='TEXT'] - Message type ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE_NOTE', 'POLL')
 * @param {Array|Object} [params.attachments=[]] - Array of attachment descriptors or single descriptor
 * @param {string} [params.mediaAssetId=null] - Shortcut for single media asset attachment
 * @param {string} [params.replyToMessageId=null] - Target message ID being replied to
 * @param {Object} [params.poll=null] - Poll creation payload { question, options, allowMultiple, closesAt }
 * @returns {Promise<Object>} { message, idempotentReplay }
 */
async function sendMessage({
  actorUserId,
  conversationId,
  clientMessageId,
  text = '',
  type = 'TEXT',
  attachments = [],
  mediaAssetId = null,
  replyToMessageId = null,
  poll = null,
}) {
  if (!actorUserId) {
    throw new MessageServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required to send messages', 401);
  }

  if (!conversationId) {
    throw new MessageServiceError('CONVERSATION_ID_REQUIRED', 'Conversation ID is required', 400);
  }

  if (!clientMessageId || typeof clientMessageId !== 'string' || !clientMessageId.trim()) {
    throw new MessageServiceError('CLIENT_MESSAGE_ID_REQUIRED', 'clientMessageId is required for idempotency', 400);
  }

  // 1. Normalize Type and Attachments
  let rawAttachments = [];
  if (Array.isArray(attachments)) {
    rawAttachments = [...attachments];
  } else if (attachments && typeof attachments === 'object') {
    rawAttachments = [attachments];
  }

  if (mediaAssetId) {
    rawAttachments.push({ mediaAssetId });
  }

  const hasAttachments = rawAttachments.length > 0;
  let normalizedType = (type || 'TEXT').toUpperCase();

  if (poll) {
    normalizedType = 'POLL';
  } else if (hasAttachments && normalizedType === 'TEXT') {
    normalizedType = 'IMAGE'; // Will be refined from loaded media asset
  }

  const allowedTypes = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE_NOTE', 'POLL'];
  if (!allowedTypes.includes(normalizedType)) {
    throw new MessageServiceError('UNSUPPORTED_MESSAGE_TYPE', `Message type '${type}' is not supported`, 400);
  }

  const safeText = typeof text === 'string' ? text.trim() : '';

  // 2. Validate Text Bounds (POLL messages use poll.question if text is empty)
  if (normalizedType !== 'POLL' && !hasAttachments && safeText.length === 0) {
    throw new MessageServiceError('MESSAGE_TEXT_EMPTY', 'Message text cannot be empty for text-only messages', 400);
  }

  if (safeText.length > 2000) {
    throw new MessageServiceError('MESSAGE_TEXT_TOO_LONG', 'Message text exceeds 2000 character limit', 400);
  }

  if (rawAttachments.length > mediaConfig.limits.maxAttachmentsPerMessage) {
    throw new MessageServiceError(
      'ATTACHMENT_LIMIT_EXCEEDED',
      `Message cannot contain more than ${mediaConfig.limits.maxAttachmentsPerMessage} attachments`,
      400
    );
  }

  // 3. Centralized Authorization Check
  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'SEND_MESSAGE',
  });

  // 4. Validate Quoted Reply Reference (R3-09-REQ-007, R3-09-REQ-008, R3-09-REQ-010)
  let targetReplyMsg = null;
  let targetReplyPreview = null;
  if (replyToMessageId) {
    targetReplyMsg = await Message.findById(replyToMessageId);
    if (!targetReplyMsg) {
      throw new MessageServiceError('REPLY_TARGET_NOT_FOUND', 'The message being replied to was not found', 404);
    }
    if (targetReplyMsg.conversationId.toString() !== conversationId.toString()) {
      throw new MessageServiceError(
        'REPLY_TARGET_CONVERSATION_MISMATCH',
        'Cross-conversation replies are forbidden',
        400
      );
    }
    targetReplyPreview = formatReplyPreview(targetReplyMsg);
  }

  // 5. Idempotency Check: check for existing message with same clientMessageId by this sender
  const existingMessage = await Message.findOne({
    conversationId,
    senderId: actorUserId,
    clientMessageId: clientMessageId.trim(),
  });

  if (existingMessage) {
    let existingPollDto = null;
    if (existingMessage.pollId) {
      const existingPoll = await Poll.findById(existingMessage.pollId);
      if (existingPoll) {
        existingPollDto = formatPollDto(existingPoll, actorUserId);
      }
    }
    return {
      message: formatMessageDto(existingMessage, null, targetReplyPreview, existingPollDto),
      idempotentReplay: true,
    };
  }

  // 6. Load and Atomically Lock Referenced Media Assets
  const boundAttachments = [];
  const lockedAssetIds = [];

  for (const rawAtt of rawAttachments) {
    const assetId = rawAtt.mediaAssetId || rawAtt.id;
    if (!assetId) {
      throw new MessageServiceError('INVALID_ATTACHMENT_DESCRIPTOR', 'Attachment descriptor is missing mediaAssetId', 400);
    }

    const lockedAsset = await MediaAsset.findOneAndUpdate(
      {
        _id: assetId,
        purpose: 'CHAT_ATTACHMENT',
        ownerId: actorUserId,
        processingStatus: 'READY',
        deletedAt: null,
        isConsumed: { $ne: true },
      },
      {
        $set: { isConsumed: true },
      },
      { new: true }
    );

    if (!lockedAsset) {
      if (lockedAssetIds.length > 0) {
        await MediaAsset.updateMany({ _id: { $in: lockedAssetIds } }, { $set: { isConsumed: false } });
      }

      const checkAsset = await MediaAsset.findById(assetId);
      if (!checkAsset) {
        throw new MessageServiceError('MEDIA_ASSET_NOT_FOUND', `Media asset '${assetId}' was not found`, 404);
      }
      if (checkAsset.purpose !== 'CHAT_ATTACHMENT') {
        throw new MessageServiceError('INCOMPATIBLE_MEDIA_PURPOSE', `Media asset purpose '${checkAsset.purpose}' is not CHAT_ATTACHMENT`, 400);
      }
      if (checkAsset.ownerId.toString() !== actorUserId.toString()) {
        throw new MessageServiceError('CROSS_USER_MEDIA_BINDING_FORBIDDEN', `You do not own media asset '${assetId}'`, 403);
      }
      if (checkAsset.conversationId && checkAsset.conversationId.toString() !== conversationId.toString()) {
        throw new MessageServiceError('CONVERSATION_MISMATCH', `Media asset '${assetId}' is not bound to this conversation`, 400);
      }
      if (checkAsset.processingStatus !== 'READY') {
        throw new MessageServiceError('MEDIA_NOT_READY', `Media asset '${assetId}' is not in READY state (status: ${checkAsset.processingStatus})`, 400);
      }
      if (checkAsset.deletedAt || checkAsset.processingStatus === 'DELETED') {
        throw new MessageServiceError('MEDIA_ASSET_DELETED', `Media asset '${assetId}' has been deleted`, 400);
      }
      if (checkAsset.isConsumed) {
        throw new MessageServiceError('MEDIA_ALREADY_CONSUMED', `Media asset '${assetId}' is already attached to another message`, 400);
      }
      throw new MessageServiceError('MEDIA_BINDING_FAILED', `Media asset '${assetId}' could not be bound to message`, 400);
    }

    if (lockedAsset.conversationId && lockedAsset.conversationId.toString() !== conversationId.toString()) {
      await MediaAsset.updateOne({ _id: lockedAsset._id }, { $set: { isConsumed: false } });
      throw new MessageServiceError('CONVERSATION_MISMATCH', `Media asset '${assetId}' is not bound to this conversation`, 400);
    }

    lockedAssetIds.push(lockedAsset._id);

    const attType = lockedAsset.attachmentCategory || lockedAsset.mediaType;
    if (hasAttachments && boundAttachments.length === 0) {
      normalizedType = attType;
    }

    boundAttachments.push({
      mediaAssetId: lockedAsset._id,
      type: attType,
      mimeType: lockedAsset.verifiedMimeType || lockedAsset.originalMimeType,
      fileSize: lockedAsset.fileSize || 0,
      width: lockedAsset.width || 0,
      height: lockedAsset.height || 0,
      durationMs: lockedAsset.durationMs || 0,
      waveform: lockedAsset.waveform || null,
      thumbnailKey: lockedAsset.thumbnail?.objectKey || '',
      originalObjectKey: lockedAsset.originalObjectKey,
    });
  }

  // 7. Monotonic Sequence Allocation on Conversation
  const updatedConv = await Conversation.findByIdAndUpdate(
    conversationId,
    { $inc: { lastSequence: 1 } },
    { new: true }
  );

  if (!updatedConv) {
    if (lockedAssetIds.length > 0) {
      await MediaAsset.updateMany({ _id: { $in: lockedAssetIds } }, { $set: { isConsumed: false } });
    }
    throw new MessageServiceError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
  }

  const nextSequence = updatedConv.lastSequence;

  // 8. Persist Message Document
  let message;
  try {
    message = await Message.create({
      conversationId: updatedConv._id,
      senderId: actorUserId,
      clientMessageId: clientMessageId.trim(),
      sequence: nextSequence,
      type: normalizedType,
      text: safeText || (poll ? poll.question : ''),
      attachments: boundAttachments,
      replyToMessageId: targetReplyMsg ? targetReplyMsg._id : null,
      replyToSequence: targetReplyMsg ? targetReplyMsg.sequence : null,
      replyTo: targetReplyMsg ? targetReplyMsg._id : null, // Backward compatibility alias
      status: 'ACTIVE',
      reactionSummary: { version: 0, total: 0, counts: new Map() },
    });
  } catch (err) {
    if (lockedAssetIds.length > 0) {
      await MediaAsset.updateMany({ _id: { $in: lockedAssetIds } }, { $set: { isConsumed: false } });
    }

    // Handle race condition on duplicate clientMessageId
    if (err.code === 11000 && err.message.includes('clientMessageId')) {
      const duplicateMsg = await Message.findOne({
        conversationId,
        senderId: actorUserId,
        clientMessageId: clientMessageId.trim(),
      });
      if (duplicateMsg) {
        return {
          message: formatMessageDto(duplicateMsg, null, targetReplyPreview),
          idempotentReplay: true,
        };
      }
    }
    throw err;
  }

  // 9. If message is a Poll, create the durable Poll document (R3-09-REQ-012, R3-09-REQ-014)
  let createdPoll = null;
  let createdPollDto = null;
  if (normalizedType === 'POLL' && poll) {
    try {
      createdPoll = await createPollDocument({
        actorUserId,
        conversationId: updatedConv._id,
        messageId: message._id,
        pollData: poll,
      });
      message.pollId = createdPoll._id;
      await message.save();
      createdPollDto = formatPollDto(createdPoll, actorUserId);
    } catch (pollErr) {
      // Rollback message on poll validation/creation failure
      await Message.findByIdAndDelete(message._id);
      throw pollErr;
    }
  }

  // 10. Atomically Link Media Assets to Message
  if (lockedAssetIds.length > 0) {
    await MediaAsset.updateMany({ _id: { $in: lockedAssetIds } }, { $set: { consumedByMessageId: message._id } });
  }

  // 11. Update Conversation Last Message Pointer
  await Conversation.findByIdAndUpdate(conversationId, {
    $set: {
      lastMessageId: message._id,
      lastMessage: message._id,
      lastMessageAt: message.createdAt,
    },
  });

  // 12. Record Outbox Event for real-time Socket.io delivery
  const formattedDto = formatMessageDto(message, null, targetReplyPreview, createdPollDto);
  try {
    await OutboxEvent.create({
      eventType: 'message.created',
      aggregateType: 'MESSAGE',
      aggregateId: message._id.toString(),
      payload: {
        messageId: message._id.toString(),
        conversationId: conversationId.toString(),
        senderId: actorUserId.toString(),
        clientMessageId: message.clientMessageId,
        sequence: message.sequence,
        type: message.type,
        text: message.text,
        attachments: formattedDto.attachments,
        replyToMessageId: formattedDto.replyToMessageId,
        replyToSequence: formattedDto.replyToSequence,
        replyTo: formattedDto.replyTo,
        pollId: formattedDto.pollId,
        poll: formattedDto.poll,
        reactionSummary: formattedDto.reactionSummary,
        status: message.status,
        createdAt: message.createdAt,
      },
      deduplicationKey: `msg_created_${message._id}`,
    });
  } catch (outboxErr) {
    console.warn('[MESSAGE SERVICE] Outbox recording warning:', outboxErr.message);
  }

  return {
    message: formattedDto,
    idempotentReplay: false,
  };
}

/**
 * Unsend a message (Tombstone pattern with attachment delivery revocation)
 */
async function unsendMessage({ actorUserId, conversationId, messageId }) {
  if (!actorUserId) {
    throw new MessageServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const message = await Message.findById(messageId);
  if (!message || message.conversationId.toString() !== conversationId.toString()) {
    throw new MessageServiceError('MESSAGE_NOT_FOUND', 'Message not found in this conversation', 404);
  }

  if (message.senderId.toString() !== actorUserId.toString()) {
    throw new MessageServiceError('UNSEND_FORBIDDEN', 'You can only unsend messages you sent', 403);
  }

  if (message.status === 'DELETED') {
    return { success: true, message: formatMessageDto(message), alreadyUnsent: true };
  }

  message.status = 'DELETED';
  message.text = 'This message was unsent.';
  await message.save();

  // If message had an active poll, close the poll automatically
  if (message.pollId) {
    try {
      await Poll.findByIdAndUpdate(message.pollId, {
        $set: { status: 'CLOSED', closedAt: new Date() },
      });
    } catch (pErr) {
      console.warn('[MESSAGE SERVICE] Poll close on unsend warning:', pErr.message);
    }
  }

  // Create Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'message.unsent',
      aggregateType: 'MESSAGE',
      aggregateId: message._id.toString(),
      payload: {
        messageId: message._id.toString(),
        conversationId: conversationId.toString(),
        senderId: actorUserId.toString(),
        unsentAt: new Date(),
      },
      deduplicationKey: `msg_unsend_${message._id}_${Date.now()}`,
    });
  } catch (e) {
    console.warn('[MESSAGE SERVICE] Unsend outbox warning:', e.message);
  }

  return {
    success: true,
    message: formatMessageDto(message),
  };
}

module.exports = {
  sendMessage,
  unsendMessage,
  formatMessageDto,
  formatReplyPreview,
  MessageServiceError,
};
