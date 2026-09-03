/**
 * Centralized In-Chat Poll Service
 * R3-09-REQ-012, R3-09-REQ-013, R3-09-REQ-014, R3-09-REQ-015, R3-09-REQ-016,
 * R3-09-REQ-017, R3-09-REQ-018, R3-09-REQ-019
 */

const crypto = require('crypto');
const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');
const OutboxEvent = require('../models/OutboxEvent');
const { authorizeConversationAccess } = require('./conversationAuthorizationService');
const interactionConfig = require('../config/interactionConfig');
const { PollStatuses } = require('../models/enums');

class PollServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'PollServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validate and normalize poll creation payload
 */
function validatePollInput(pollData) {
  if (!pollData || typeof pollData !== 'object') {
    throw new PollServiceError('INVALID_POLL', 'Poll data object is required', 400);
  }

  const { question, options, allowMultiple = false, maxSelections = 1, closesAt } = pollData;

  // 1. Question validation
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new PollServiceError('INVALID_POLL_QUESTION', 'Poll question cannot be empty', 400);
  }
  const cleanQuestion = question.trim();
  if (cleanQuestion.length > interactionConfig.polls.maxQuestionLength) {
    throw new PollServiceError(
      'INVALID_POLL_QUESTION',
      `Poll question exceeds ${interactionConfig.polls.maxQuestionLength} characters`,
      400
    );
  }

  // 2. Options validation
  if (!Array.isArray(options)) {
    throw new PollServiceError('INVALID_POLL_OPTIONS', 'Poll options must be an array', 400);
  }
  if (options.length < interactionConfig.polls.minOptions || options.length > interactionConfig.polls.maxOptions) {
    throw new PollServiceError(
      'INVALID_POLL_OPTIONS',
      `Poll must contain between ${interactionConfig.polls.minOptions} and ${interactionConfig.polls.maxOptions} options`,
      400
    );
  }

  const normalizedOptions = [];
  const seenTexts = new Set();

  for (let i = 0; i < options.length; i++) {
    const rawOpt = typeof options[i] === 'string' ? options[i] : (options[i] && options[i].text);
    if (!rawOpt || typeof rawOpt !== 'string' || !rawOpt.trim()) {
      throw new PollServiceError('INVALID_POLL_OPTIONS', `Option ${i + 1} cannot be empty`, 400);
    }
    const cleanOpt = rawOpt.trim();
    if (cleanOpt.length > interactionConfig.polls.maxOptionLength) {
      throw new PollServiceError(
        'INVALID_POLL_OPTIONS',
        `Option '${cleanOpt}' exceeds ${interactionConfig.polls.maxOptionLength} characters`,
        400
      );
    }

    const lower = cleanOpt.toLowerCase();
    if (seenTexts.has(lower)) {
      throw new PollServiceError('DUPLICATE_POLL_OPTIONS', `Duplicate option detected: '${cleanOpt}'`, 400);
    }
    seenTexts.add(lower);

    // Stable server-generated option ID (R3-09-REQ-013)
    const optionId = `opt_${i + 1}_${crypto.randomBytes(3).toString('hex')}`;
    normalizedOptions.push({
      optionId,
      text: cleanOpt,
      order: i,
      voteCount: 0,
    });
  }

  // 3. Selection bounds
  const isMulti = !!allowMultiple;
  let cleanMaxSelections = 1;
  if (isMulti) {
    cleanMaxSelections = Math.max(1, Math.min(normalizedOptions.length, parseInt(maxSelections, 10) || normalizedOptions.length));
  }

  // 4. ClosesAt validation
  let cleanClosesAt = null;
  if (closesAt) {
    const parsedDate = new Date(closesAt);
    if (isNaN(parsedDate.getTime())) {
      throw new PollServiceError('INVALID_POLL_EXPIRY', 'Invalid closesAt date format', 400);
    }
    const duration = parsedDate.getTime() - Date.now();
    if (duration < interactionConfig.polls.minDurationMs) {
      throw new PollServiceError('INVALID_POLL_EXPIRY', 'Poll closing time must be at least 1 minute in the future', 400);
    }
    if (duration > interactionConfig.polls.maxDurationMs) {
      throw new PollServiceError('INVALID_POLL_EXPIRY', 'Poll closing time cannot exceed 30 days', 400);
    }
    cleanClosesAt = parsedDate;
  }

  return {
    question: cleanQuestion,
    options: normalizedOptions,
    allowMultiple: isMulti,
    maxSelections: cleanMaxSelections,
    closesAt: cleanClosesAt,
  };
}

/**
 * Format clean Poll DTO for client consumption
 */
function formatPollDto(poll, currentUserId = null, currentUserOptionIds = null) {
  if (!poll) return null;

  const pollIdStr = poll._id ? poll._id.toString() : (poll.id || '');
  const convIdStr = poll.conversationId ? poll.conversationId.toString() : '';
  const msgIdStr = poll.messageId ? poll.messageId.toString() : '';
  const createdByStr = poll.createdByUserId ? poll.createdByUserId.toString() : '';

  // Calculate effective status
  let effectiveStatus = poll.status || PollStatuses.OPEN;
  if (effectiveStatus === PollStatuses.OPEN && poll.closesAt && new Date(poll.closesAt) <= new Date()) {
    effectiveStatus = PollStatuses.EXPIRED;
  }

  const optionsDto = (poll.options || []).map((o) => ({
    optionId: o.optionId,
    text: o.text,
    order: o.order,
    voteCount: Math.max(0, o.voteCount || 0),
  }));

  return {
    id: pollIdStr,
    pollId: pollIdStr,
    conversationId: convIdStr,
    messageId: msgIdStr,
    createdByUserId: createdByStr,
    question: poll.question,
    options: optionsDto,
    allowMultiple: !!poll.allowMultiple,
    maxSelections: poll.maxSelections || 1,
    status: effectiveStatus,
    closesAt: poll.closesAt || null,
    closedAt: poll.closedAt || null,
    totalVoters: Math.max(0, poll.totalVoters || 0),
    version: poll.version || 1,
    currentUserOptionIds: Array.isArray(currentUserOptionIds) ? currentUserOptionIds : [],
    createdAt: poll.createdAt,
    updatedAt: poll.updatedAt,
  };
}

/**
 * Create a Poll Document
 * R3-09-REQ-012, R3-09-REQ-014
 */
async function createPollDocument({ actorUserId, conversationId, messageId, pollData }) {
  const validated = validatePollInput(pollData);

  const poll = await Poll.create({
    conversationId,
    messageId,
    createdByUserId: actorUserId,
    question: validated.question,
    options: validated.options,
    allowMultiple: validated.allowMultiple,
    maxSelections: validated.maxSelections,
    status: PollStatuses.OPEN,
    closesAt: validated.closesAt,
    version: 1,
    totalVoters: 0,
  });

  return poll;
}

/**
 * Submit or change a vote on a poll
 * R3-09-REQ-015, R3-09-REQ-016, R3-09-REQ-018, R3-09-REQ-019
 */
async function votePoll({ actorUserId, conversationId, pollId, optionIds }) {
  if (!actorUserId) {
    throw new PollServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }
  if (!conversationId) {
    throw new PollServiceError('CONVERSATION_ID_REQUIRED', 'conversationId is required', 400);
  }
  if (!pollId) {
    throw new PollServiceError('POLL_ID_REQUIRED', 'pollId is required', 400);
  }

  // 1. Centralized Conversation Authorization
  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'SEND_MESSAGE',
  });

  // 2. Load and Validate Poll
  const poll = await Poll.findById(pollId);
  if (!poll || poll.conversationId.toString() !== conversationId.toString()) {
    throw new PollServiceError('POLL_NOT_FOUND', 'Poll was not found in this conversation', 404);
  }

  // Check Expiry / Closed state
  if (poll.status === PollStatuses.CLOSED) {
    throw new PollServiceError('POLL_CLOSED', 'This poll is closed and no longer accepts votes', 400);
  }
  if (poll.closesAt && new Date(poll.closesAt) <= new Date()) {
    if (poll.status !== PollStatuses.EXPIRED) {
      poll.status = PollStatuses.EXPIRED;
      await poll.save();
    }
    throw new PollServiceError('POLL_EXPIRED', 'This poll has expired and no longer accepts votes', 400);
  }

  // 3. Validate Requested Option IDs
  let selectedOptionIds = [];
  if (Array.isArray(optionIds)) {
    selectedOptionIds = [...new Set(optionIds.map((s) => String(s).trim()))];
  } else if (typeof optionIds === 'string' && optionIds.trim()) {
    selectedOptionIds = [optionIds.trim()];
  }

  if (selectedOptionIds.length === 0) {
    throw new PollServiceError('INVALID_POLL_SELECTION', 'At least one valid option must be selected', 400);
  }

  if (!poll.allowMultiple && selectedOptionIds.length > 1) {
    throw new PollServiceError('POLL_SELECTION_LIMIT_EXCEEDED', 'This poll only allows a single selection', 400);
  }

  if (poll.allowMultiple && selectedOptionIds.length > poll.maxSelections) {
    throw new PollServiceError(
      'POLL_SELECTION_LIMIT_EXCEEDED',
      `You may select at most ${poll.maxSelections} options`,
      400
    );
  }

  const validOptionIds = new Set(poll.options.map((o) => o.optionId));
  for (const optId of selectedOptionIds) {
    if (!validOptionIds.has(optId)) {
      throw new PollServiceError('INVALID_POLL_SELECTION', `Option '${optId}' is not valid for this poll`, 400);
    }
  }

  // 4. Find Existing Vote
  const existingVote = await PollVote.findOne({
    pollId: poll._id,
    userId: actorUserId,
  });

  // Check Idempotency: exact same selection
  if (existingVote) {
    const existingSorted = [...existingVote.optionIds].sort().join(',');
    const newSorted = [...selectedOptionIds].sort().join(',');
    if (existingSorted === newSorted) {
      return {
        success: true,
        changed: false,
        poll: formatPollDto(poll, actorUserId, selectedOptionIds),
      };
    }
  }

  const oldOptionIds = existingVote ? existingVote.optionIds : [];
  const addedOptionIds = selectedOptionIds.filter((id) => !oldOptionIds.includes(id));
  const removedOptionIds = oldOptionIds.filter((id) => !selectedOptionIds.includes(id));

  // 5. Update or Create Vote Document
  if (existingVote) {
    existingVote.optionIds = selectedOptionIds;
    await existingVote.save();
  } else {
    await PollVote.create({
      pollId: poll._id,
      conversationId: poll.conversationId,
      userId: actorUserId,
      optionIds: selectedOptionIds,
    });
    poll.totalVoters = (poll.totalVoters || 0) + 1;
  }

  // 6. Atomically update option vote counts on Poll document
  for (const opt of poll.options) {
    if (addedOptionIds.includes(opt.optionId)) {
      opt.voteCount = (opt.voteCount || 0) + 1;
    }
    if (removedOptionIds.includes(opt.optionId)) {
      opt.voteCount = Math.max(0, (opt.voteCount || 1) - 1);
    }
  }

  poll.version = (poll.version || 1) + 1;
  await poll.save();

  const formattedDto = formatPollDto(poll, actorUserId, selectedOptionIds);

  // 7. Record Outbox Event (R3-09-REQ-019)
  try {
    await OutboxEvent.create({
      eventType: 'poll.vote.updated',
      aggregateType: 'POLL',
      aggregateId: poll._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_pv_${poll._id}_${actorUserId}_${Date.now()}`,
        conversationId: conversationId.toString(),
        messageId: poll.messageId ? poll.messageId.toString() : '',
        pollId: poll._id.toString(),
        pollVersion: poll.version,
        status: poll.status,
        totalVoters: poll.totalVoters,
        options: poll.options.map((o) => ({
          optionId: o.optionId,
          voteCount: o.voteCount,
        })),
        committedAt: new Date().toISOString(),
      },
      deduplicationKey: `poll_vote_${poll._id}_${actorUserId}_${poll.version}`,
    });
  } catch (outboxErr) {
    console.warn('[POLL SERVICE] Outbox recording warning:', outboxErr.message);
  }

  return {
    success: true,
    changed: true,
    poll: formattedDto,
  };
}

/**
 * Remove vote from a poll
 * R3-09-REQ-016, R3-09-REQ-018
 */
async function removePollVote({ actorUserId, conversationId, pollId }) {
  if (!actorUserId || !conversationId || !pollId) {
    throw new PollServiceError('INVALID_PARAMS', 'Missing required parameters', 400);
  }

  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'SEND_MESSAGE',
  });

  const poll = await Poll.findById(pollId);
  if (!poll || poll.conversationId.toString() !== conversationId.toString()) {
    throw new PollServiceError('POLL_NOT_FOUND', 'Poll not found', 404);
  }

  if (poll.status !== PollStatuses.OPEN || (poll.closesAt && new Date(poll.closesAt) <= new Date())) {
    throw new PollServiceError('POLL_CLOSED', 'Cannot modify votes on a closed or expired poll', 400);
  }

  const existingVote = await PollVote.findOne({
    pollId: poll._id,
    userId: actorUserId,
  });

  // Idempotent: no existing vote
  if (!existingVote) {
    return {
      success: true,
      changed: false,
      poll: formatPollDto(poll, actorUserId, []),
    };
  }

  const removedOptionIds = existingVote.optionIds || [];
  await PollVote.findByIdAndDelete(existingVote._id);

  for (const opt of poll.options) {
    if (removedOptionIds.includes(opt.optionId)) {
      opt.voteCount = Math.max(0, (opt.voteCount || 1) - 1);
    }
  }

  poll.totalVoters = Math.max(0, (poll.totalVoters || 1) - 1);
  poll.version = (poll.version || 1) + 1;
  await poll.save();

  const formattedDto = formatPollDto(poll, actorUserId, []);

  try {
    await OutboxEvent.create({
      eventType: 'poll.vote.updated',
      aggregateType: 'POLL',
      aggregateId: poll._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_pv_rem_${poll._id}_${actorUserId}_${Date.now()}`,
        conversationId: conversationId.toString(),
        messageId: poll.messageId ? poll.messageId.toString() : '',
        pollId: poll._id.toString(),
        pollVersion: poll.version,
        status: poll.status,
        totalVoters: poll.totalVoters,
        options: poll.options.map((o) => ({
          optionId: o.optionId,
          voteCount: o.voteCount,
        })),
        committedAt: new Date().toISOString(),
      },
      deduplicationKey: `poll_vote_rem_${poll._id}_${actorUserId}_${poll.version}`,
    });
  } catch (outboxErr) {
    console.warn('[POLL SERVICE] Outbox recording warning:', outboxErr.message);
  }

  return {
    success: true,
    changed: true,
    poll: formattedDto,
  };
}

/**
 * Close a poll manually
 * R3-09-REQ-017
 */
async function closePoll({ actorUserId, conversationId, pollId }) {
  if (!actorUserId || !conversationId || !pollId) {
    throw new PollServiceError('INVALID_PARAMS', 'Missing required parameters', 400);
  }

  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const poll = await Poll.findById(pollId);
  if (!poll || poll.conversationId.toString() !== conversationId.toString()) {
    throw new PollServiceError('POLL_NOT_FOUND', 'Poll not found', 404);
  }

  // Only creator can manually close direct conversation polls
  if (poll.createdByUserId.toString() !== actorUserId.toString()) {
    throw new PollServiceError('POLL_CLOSE_FORBIDDEN', 'Only the poll creator can close this poll', 403);
  }

  // Idempotent close
  if (poll.status === PollStatuses.CLOSED) {
    return {
      success: true,
      poll: formatPollDto(poll, actorUserId),
    };
  }

  poll.status = PollStatuses.CLOSED;
  poll.closedAt = new Date();
  poll.closedByUserId = actorUserId;
  poll.version = (poll.version || 1) + 1;
  await poll.save();

  const formattedDto = formatPollDto(poll, actorUserId);

  try {
    await OutboxEvent.create({
      eventType: 'poll.closed',
      aggregateType: 'POLL',
      aggregateId: poll._id.toString(),
      payload: {
        version: 1,
        eventId: `evt_pc_${poll._id}_${Date.now()}`,
        conversationId: conversationId.toString(),
        messageId: poll.messageId ? poll.messageId.toString() : '',
        pollId: poll._id.toString(),
        pollVersion: poll.version,
        closedAt: poll.closedAt,
        closedByUserId: actorUserId.toString(),
        committedAt: new Date().toISOString(),
      },
      deduplicationKey: `poll_closed_${poll._id}_${poll.version}`,
    });
  } catch (outboxErr) {
    console.warn('[POLL SERVICE] Outbox recording warning:', outboxErr.message);
  }

  return {
    success: true,
    poll: formattedDto,
  };
}

/**
 * Get poll detail by ID with user vote context
 */
async function getPollDetail({ actorUserId, conversationId, pollId }) {
  if (!actorUserId || !conversationId || !pollId) {
    throw new PollServiceError('INVALID_PARAMS', 'Missing required parameters', 400);
  }

  await authorizeConversationAccess({
    actorUserId,
    conversationId,
    operation: 'VIEW',
  });

  const poll = await Poll.findById(pollId);
  if (!poll || poll.conversationId.toString() !== conversationId.toString()) {
    throw new PollServiceError('POLL_NOT_FOUND', 'Poll not found', 404);
  }

  const userVote = await PollVote.findOne({
    pollId: poll._id,
    userId: actorUserId,
  });

  const currentUserOptionIds = userVote ? userVote.optionIds : [];
  return formatPollDto(poll, actorUserId, currentUserOptionIds);
}

module.exports = {
  PollServiceError,
  validatePollInput,
  formatPollDto,
  createPollDocument,
  votePoll,
  removePollVote,
  closePoll,
  getPollDetail,
};
