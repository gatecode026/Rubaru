const User = require('../models/User');
const Match = require('../models/Match');
const Chat = require('../models/Chat');
const Block = require('../models/Block');
const Report = require('../models/Report');
const DatingInteraction = require('../models/DatingInteraction');
const OutboxEvent = require('../models/OutboxEvent');
const { ReportCategories } = require('../models/enums');

class SafetyServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'SafetyServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Unmatch an active match
 */
async function unmatchUser(userId, matchId, data = {}) {
  if (!userId) {
    throw new SafetyServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const match = await Match.findById(matchId);
  if (!match) {
    throw new SafetyServiceError('MATCH_NOT_FOUND', 'Match was not found', 404);
  }

  const isMember = match.users.some((u) => u.toString() === userId.toString());
  if (!isMember) {
    throw new SafetyServiceError('MATCH_ACCESS_DENIED', 'Access denied to this match', 403);
  }

  // Idempotency: if already unmatched by this user, return current state
  if (match.status === 'UNMATCHED') {
    return {
      unmatched: true,
      endedAt: match.endedAt,
    };
  }

  if (match.status !== 'ACTIVE') {
    throw new SafetyServiceError('MATCH_NOT_ACTIVE', `Match is already ended with status: ${match.status}`, 400);
  }

  const otherUserId = match.users.find((u) => u.toString() !== userId.toString());

  // Update Match state
  match.status = 'UNMATCHED';
  match.endedAt = new Date();
  match.endedBy = userId;
  match.endReason = data.reason || 'USER_UNMATCHED';
  await match.save();

  // Close Conversation for future writes
  if (match.conversation) {
    await Chat.findByIdAndUpdate(match.conversation, { status: 'CLOSED' });
  }

  // Invalidate any residual pending interactions between this pair
  if (otherUserId) {
    await DatingInteraction.updateMany(
      {
        $or: [
          { actor: userId, target: otherUserId, status: 'PENDING' },
          { actor: otherUserId, target: userId, status: 'PENDING' },
        ],
      },
      {
        $set: { status: 'INVALIDATED' },
      }
    );
  }

  // Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'match.unmatched',
      aggregateType: 'MATCH',
      aggregateId: match._id.toString(),
      payload: {
        matchId: match._id.toString(),
        unmatchedBy: userId.toString(),
        otherUserId: otherUserId ? otherUserId.toString() : '',
        endedAt: match.endedAt,
      },
      deduplicationKey: `unmatch_${match._id}`,
    });
  } catch (err) {
    console.warn('[SAFETY SERVICE] Outbox recording warning:', err.message);
  }

  return {
    unmatched: true,
    endedAt: match.endedAt,
  };
}

/**
 * Block another user immediately in both directions
 */
async function blockUser(userId, targetUserId, data = {}) {
  if (!userId) {
    throw new SafetyServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  if (!targetUserId || userId.toString() === targetUserId.toString()) {
    throw new SafetyServiceError('SELF_BLOCK_NOT_ALLOWED', 'Users cannot block themselves', 400);
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new SafetyServiceError('USER_NOT_FOUND', 'Target user was not found', 404);
  }

  // 1. Create or reuse unique Block record
  let blockDoc = await Block.findOne({ blocker: userId, blocked: targetUserId });
  if (!blockDoc) {
    blockDoc = await Block.create({
      blocker: userId,
      blocked: targetUserId,
      reason: data.reason || 'USER_BLOCKED',
    });
  }

  // 2. Resolve canonical pair and close active Match/Chat if exists
  const [lowerId, higherId] = [userId.toString(), targetUserId.toString()].sort();
  const canonicalPair = `${lowerId}:${higherId}`;

  const match = await Match.findOne({ canonicalPair });
  if (match && match.status !== 'BLOCKED') {
    match.status = 'BLOCKED';
    match.endedAt = new Date();
    match.endedBy = userId;
    match.endReason = 'USER_BLOCKED';
    await match.save();

    if (match.conversation) {
      await Chat.findByIdAndUpdate(match.conversation, { status: 'BLOCKED' });
    }
  }

  // 3. Invalidate any pending pair interactions
  await DatingInteraction.updateMany(
    {
      $or: [
        { actor: userId, target: targetUserId, status: 'PENDING' },
        { actor: targetUserId, target: userId, status: 'PENDING' },
      ],
    },
    {
      $set: { status: 'INVALIDATED' },
    }
  );

  // 4. Revoke social follow relationships symmetrically in both directions
  try {
    const followService = require('./followService');
    await followService.handleBlockCreated(userId, targetUserId);
  } catch (followErr) {
    console.warn('[SAFETY SERVICE] Social follow revocation warning:', followErr.message);
  }

  // 5. Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'user.blocked',
      aggregateType: 'SAFETY',
      aggregateId: blockDoc._id.toString(),
      payload: {
        blockerId: userId.toString(),
        blockedId: targetUserId.toString(),
        blockedAt: blockDoc.createdAt,
      },
      deduplicationKey: `block_${userId}_${targetUserId}`,
    });
  } catch (err) {
    console.warn('[SAFETY SERVICE] Outbox recording warning:', err.message);
  }

  return {
    blocked: true,
    blockedAt: blockDoc.createdAt,
  };
}

/**
 * Unblock a previously blocked user
 */
async function unblockUser(userId, targetUserId) {
  if (!userId) {
    throw new SafetyServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const blockDoc = await Block.findOne({ blocker: userId, blocked: targetUserId });
  if (!blockDoc) {
    throw new SafetyServiceError('BLOCK_NOT_FOUND', 'No active block found against this user', 404);
  }

  await Block.findByIdAndDelete(blockDoc._id);

  // Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'user.unblocked',
      aggregateType: 'SAFETY',
      aggregateId: blockDoc._id.toString(),
      payload: {
        blockerId: userId.toString(),
        unblockedId: targetUserId.toString(),
        unblockedAt: new Date(),
      },
      deduplicationKey: `unblock_${userId}_${targetUserId}_${Date.now()}`,
    });
  } catch (err) {
    console.warn('[SAFETY SERVICE] Outbox recording warning:', err.message);
  }

  return {
    unblocked: true,
  };
}

/**
 * Submit a trust & safety report
 */
async function reportUser(userId, reportedUserId, data = {}) {
  if (!userId) {
    throw new SafetyServiceError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  if (!reportedUserId || userId.toString() === reportedUserId.toString()) {
    throw new SafetyServiceError('SELF_REPORT_NOT_ALLOWED', 'Users cannot report themselves', 400);
  }

  const { category, description, evidenceUrls, alsoBlock } = data;

  const validCategories = Object.values(ReportCategories);
  if (!category || !validCategories.includes(category)) {
    throw new SafetyServiceError('INVALID_REPORT_CATEGORY', `Invalid category. Allowed categories: ${validCategories.join(', ')}`, 400);
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new SafetyServiceError('INVALID_REPORT_DETAILS', 'Report description is required', 400);
  }

  if (description.length > 1000) {
    throw new SafetyServiceError('INVALID_REPORT_DETAILS', 'Report description cannot exceed 1000 characters', 400);
  }

  const reportedUser = await User.findById(reportedUserId);
  if (!reportedUser) {
    throw new SafetyServiceError('USER_NOT_FOUND', 'Reported user was not found', 404);
  }

  // 1. Create Report document
  const reportDoc = await Report.create({
    reporter: userId,
    reportedUser: reportedUserId,
    category,
    description: description.trim(),
    evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
    status: 'PENDING',
  });

  // 2. Combined Report and Block if requested
  let blockResult = null;
  if (alsoBlock) {
    blockResult = await blockUser(userId, reportedUserId, { reason: `REPORT_${category}` });
  }

  // 3. Record Outbox Event
  try {
    await OutboxEvent.create({
      eventType: 'report.created',
      aggregateType: 'SAFETY',
      aggregateId: reportDoc._id.toString(),
      payload: {
        reportId: reportDoc._id.toString(),
        reporterId: userId.toString(),
        reportedUserId: reportedUserId.toString(),
        category,
        alsoBlocked: Boolean(alsoBlock),
        createdAt: reportDoc.createdAt,
      },
      deduplicationKey: `report_${reportDoc._id}`,
    });
  } catch (err) {
    console.warn('[SAFETY SERVICE] Outbox recording warning:', err.message);
  }

  return {
    reported: true,
    reportId: reportDoc._id.toString(),
    alsoBlocked: Boolean(alsoBlock),
  };
}

module.exports = {
  unmatchUser,
  blockUser,
  unblockUser,
  reportUser,
  SafetyServiceError,
};
