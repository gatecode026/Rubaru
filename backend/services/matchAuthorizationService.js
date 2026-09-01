const Match = require('../models/Match');
const Chat = require('../models/Chat');
const Block = require('../models/Block');

class MatchAuthorizationError extends Error {
  constructor(code, message, statusCode = 403, details = null) {
    super(message);
    this.name = 'MatchAuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Validate that authenticated user is a canonical member of the Match
 */
async function requireMatchMember(userId, matchId) {
  if (!userId) {
    throw new MatchAuthorizationError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const match = await Match.findById(matchId);
  if (!match) {
    throw new MatchAuthorizationError('MATCH_NOT_FOUND', 'Match was not found', 404);
  }

  const isMember = match.users.some((u) => u.toString() === userId.toString());
  if (!isMember) {
    throw new MatchAuthorizationError('MATCH_ACCESS_DENIED', 'Access denied to this match', 403);
  }

  const otherUserId = match.users.find((u) => u.toString() !== userId.toString());

  return {
    match,
    authenticatedMemberId: userId.toString(),
    otherMemberId: otherUserId ? otherUserId.toString() : null,
  };
}

/**
 * Validate that authenticated user is an ACTIVE member of the Match without blocks
 */
async function requireActiveMatchMember(userId, matchId) {
  const context = await requireMatchMember(userId, matchId);

  if (context.match.status !== 'ACTIVE') {
    throw new MatchAuthorizationError('MATCH_NOT_ACTIVE', `Match is no longer active (status: ${context.match.status})`, 403);
  }

  if (context.otherMemberId) {
    const isBlocked = await Block.findOne({
      $or: [
        { blocker: userId, blocked: context.otherMemberId },
        { blocker: context.otherMemberId, blocked: userId },
      ],
    });

    if (isBlocked) {
      throw new MatchAuthorizationError('MATCH_ACCESS_DENIED', 'Access denied due to safety restrictions', 403);
    }
  }

  return context;
}

/**
 * Validate that authenticated user is an authorized member of a Conversation
 */
async function requireConversationMember(userId, conversationId) {
  if (!userId) {
    throw new MatchAuthorizationError('AUTHENTICATION_REQUIRED', 'Authentication required', 401);
  }

  const chat = await Chat.findById(conversationId);
  if (!chat) {
    throw new MatchAuthorizationError('CONVERSATION_NOT_FOUND', 'Conversation was not found', 404);
  }

  const isParticipant = chat.participants.some((p) => p.toString() === userId.toString());
  if (!isParticipant) {
    throw new MatchAuthorizationError('CONVERSATION_ACCESS_DENIED', 'Access denied to this conversation', 403);
  }

  return {
    chat,
    authenticatedMemberId: userId.toString(),
  };
}

/**
 * Validate that authenticated user has an active dating conversation bound to an active Match
 */
async function requireActiveDatingConversation(userId, conversationId) {
  const context = await requireConversationMember(userId, conversationId);
  const chat = context.chat;

  // If this is a dating conversation bound to a match, enforce match-level authorization
  if (chat.match) {
    const matchContext = await requireActiveMatchMember(userId, chat.match);
    return {
      ...context,
      match: matchContext.match,
      otherMemberId: matchContext.otherMemberId,
    };
  }

  // Non-match group/direct chat
  return context;
}

module.exports = {
  requireMatchMember,
  requireActiveMatchMember,
  requireConversationMember,
  requireActiveDatingConversation,
  MatchAuthorizationError,
};
