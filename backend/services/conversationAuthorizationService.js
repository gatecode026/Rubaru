const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Match = require('../models/Match');
const Block = require('../models/Block');
const User = require('../models/User');
const { ConversationStatuses, MemberStates, MemberRoles } = require('../models/enums');

class ConversationAuthorizationError extends Error {
  constructor(code, message, statusCode = 403, details = null) {
    super(message);
    this.name = 'ConversationAuthorizationError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Authorize actor access to a conversation for a specific operation
 * @param {Object} params
 * @param {string} params.actorUserId - Authenticated User ID
 * @param {string} params.conversationId - Conversation ID
 * @param {string} params.operation - VIEW | SEND_MESSAGE | READ_HISTORY | UPDATE_MEMBER_PREFERENCE | MANAGE_MEMBERS
 * @returns {Promise<Object>} Authorization Context { authorized: true, conversation, member, otherMemberId, role }
 */
async function authorizeConversationAccess({ actorUserId, conversationId, operation = 'VIEW' }) {
  if (!actorUserId) {
    throw new ConversationAuthorizationError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  if (!conversationId) {
    throw new ConversationAuthorizationError('CONVERSATION_ID_REQUIRED', 'Conversation ID is required', 400);
  }

  // 1. Verify actor account status
  const actor = await User.findById(actorUserId);
  if (!actor || actor.accountStatus === 'DELETED' || actor.accountStatus === 'BANNED' || actor.accountStatus === 'SUSPENDED') {
    throw new ConversationAuthorizationError('ACCOUNT_NOT_ACTIVE', 'User account is suspended, banned, or deleted', 403);
  }

  // 2. Load conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ConversationAuthorizationError('CONVERSATION_NOT_FOUND', 'Conversation was not found', 404);
  }

  // 3. Load membership
  let member = await ConversationMember.findOne({
    conversationId: conversation._id,
    userId: actor._id,
  });

  // Backward compatibility fallback: if legacy chat participants array has user but member record wasn't created yet
  if (!member && Array.isArray(conversation.participants) && conversation.participants.some((p) => p.toString() === actorUserId.toString())) {
    member = await ConversationMember.create({
      conversationId: conversation._id,
      userId: actor._id,
      role: MemberRoles.MEMBER,
      state: MemberStates.ACTIVE,
    });
  }

  if (!member) {
    throw new ConversationAuthorizationError('MEMBERSHIP_REQUIRED', 'Access denied: User is not a member of this conversation', 403);
  }

  if (member.state !== MemberStates.ACTIVE) {
    throw new ConversationAuthorizationError('MEMBER_NOT_ACTIVE', `Membership is no longer active (state: ${member.state})`, 403);
  }

  // 4. Validate operation against conversation status
  const activeWriteOperations = ['SEND_MESSAGE', 'UPDATE_MEMBER_PREFERENCE', 'MANAGE_MEMBERS'];
  if (activeWriteOperations.includes(operation) && conversation.status !== ConversationStatuses.ACTIVE) {
    throw new ConversationAuthorizationError(
      'CONVERSATION_NOT_AVAILABLE',
      `Conversation is closed for active operations (status: ${conversation.status})`,
      403
    );
  }

  // 5. Determine other member ID for direct match conversations
  let otherMemberId = null;
  if (conversation.canonicalParticipantKey) {
    const ids = conversation.canonicalParticipantKey.split(':');
    otherMemberId = ids.find((id) => id !== actorUserId.toString()) || null;
  } else if (Array.isArray(conversation.participants) && conversation.participants.length === 2) {
    const otherPart = conversation.participants.find((p) => p.toString() !== actorUserId.toString());
    otherMemberId = otherPart ? otherPart.toString() : null;
  }

  // 6. Direct match safety & block enforcement
  if (otherMemberId) {
    const isBlocked = await Block.findOne({
      $or: [
        { blocker: actorUserId, blocked: otherMemberId },
        { blocker: otherMemberId, blocked: actorUserId },
      ],
    });

    if (isBlocked) {
      throw new ConversationAuthorizationError('USER_BLOCKED', 'Access denied due to safety restrictions', 403);
    }
  }

  // 7. Match-level active check if bound to a dating match
  if (conversation.matchId) {
    const match = await Match.findById(conversation.matchId);
    if (!match) {
      throw new ConversationAuthorizationError('MATCH_NOT_FOUND', 'Bound match was not found', 404);
    }

    if (activeWriteOperations.includes(operation) && match.status !== 'ACTIVE') {
      throw new ConversationAuthorizationError('MATCH_NOT_ACTIVE', `Match is no longer active (status: ${match.status})`, 403);
    }
  }

  // 8. Administrative role checks
  if (operation === 'MANAGE_MEMBERS' && member.role !== MemberRoles.ADMIN && member.role !== MemberRoles.OWNER) {
    throw new ConversationAuthorizationError('OPERATION_NOT_ALLOWED', 'Administrative role required to manage members', 403);
  }

  return {
    authorized: true,
    conversation,
    member,
    otherMemberId,
    role: member.role,
  };
}

module.exports = {
  authorizeConversationAccess,
  ConversationAuthorizationError,
};
