const conversationService = require('../services/conversationService');

/**
 * @desc    Get paginated conversation list for authenticated user
 * @route   GET /v1/conversations
 * @access  Private
 */
const getConversations = async (req, res) => {
  try {
    const result = await conversationService.getConversationList(req.user._id, {
      cursor: req.query.cursor,
      limit: req.query.limit,
      status: req.query.status,
      type: req.query.type,
    });

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message,
      error: { code: error.code || 'CONVERSATION_ERROR' },
    });
  }
};

/**
 * @desc    Get details of a single conversation
 * @route   GET /v1/conversations/:conversationId
 * @access  Private
 */
const getConversationById = async (req, res) => {
  try {
    const result = await conversationService.getConversationDetails(
      req.user._id,
      req.params.conversationId
    );

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message,
      error: { code: error.code || 'CONVERSATION_ERROR' },
    });
  }
};

/**
 * @desc    Ensure an authoritative direct match conversation exists for an active match
 * @route   POST /v1/conversations/ensure-direct
 * @access  Private
 */
const ensureDirectConversation = async (req, res) => {
  try {
    const { matchId } = req.body;
    if (!matchId) {
      return res.status(400).json({
        message: 'matchId is required',
        error: { code: 'MATCH_ID_REQUIRED' },
      });
    }

    const result = await conversationService.ensureDirectMatchConversation({
      actorUserId: req.user._id,
      matchId,
    });

    res.status(result.isNew ? 201 : 200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message,
      error: { code: error.code || 'CONVERSATION_ERROR' },
    });
  }
};

/**
 * @desc    Send a message (text or attachment) inside a conversation
 * @route   POST /v1/conversations/:conversationId/messages
 * @access  Private
 */
const createMessage = async (req, res) => {
  try {
    const { sendMessage } = require('../services/messageService');
    const { clientMessageId, text, type, mediaAssetId, attachments, replyToMessageId, poll } = req.body;

    const result = await sendMessage({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      clientMessageId,
      text,
      type,
      mediaAssetId,
      attachments,
      replyToMessageId,
      poll,
    });

    res.status(result.idempotentReplay ? 200 : 201).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message,
      error: { code: error.code || 'MESSAGE_SEND_ERROR' },
    });
  }
};

/**
 * @desc    Unsend a message inside a conversation
 * @route   DELETE /v1/conversations/:conversationId/messages/:messageId
 * @access  Private
 */
const unsendMessage = async (req, res) => {
  try {
    const { unsendMessage: unsendMsgService } = require('../services/messageService');
    const result = await unsendMsgService({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      messageId: req.params.messageId,
    });
    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      message: error.message,
      error: { code: error.code || 'MESSAGE_UNSEND_ERROR' },
    });
  }
};

/**
 * @desc    Create a new Group Conversation
 * @route   POST /v1/conversations
 * @access  Private
 */
const handleCreateGroup = async (req, res) => {
  try {
    const { name, groupName, avatarUri, groupAvatar, memberUserIds = [] } = req.body;
    const result = await conversationService.createGroupConversation({
      actorUserId: req.user._id,
      name: name || groupName,
      avatarUri: avatarUri || groupAvatar,
      memberUserIds,
    });
    res.status(201).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'GROUP_CREATE_ERROR' },
    });
  }
};

/**
 * @desc    Update Group Metadata
 * @route   PATCH /v1/conversations/:conversationId
 * @access  Private
 */
const handleUpdateGroup = async (req, res) => {
  try {
    const { name, groupName, avatarUri, groupAvatar } = req.body;
    const result = await conversationService.updateGroupMetadata({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      name: name || groupName,
      avatarUri: avatarUri || groupAvatar,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'GROUP_UPDATE_ERROR' },
    });
  }
};

/**
 * @desc    Get Group Members
 * @route   GET /v1/conversations/:conversationId/members
 * @access  Private
 */
const handleGetGroupMembers = async (req, res) => {
  try {
    const result = await conversationService.getGroupMembers({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'GROUP_MEMBERS_ERROR' },
    });
  }
};

/**
 * @desc    Add Members to Group
 * @route   POST /v1/conversations/:conversationId/members
 * @access  Private
 */
const handleAddGroupMembers = async (req, res) => {
  try {
    const { memberUserIds = [] } = req.body;
    const result = await conversationService.addGroupMembers({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      memberUserIds,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'ADD_MEMBERS_ERROR' },
    });
  }
};

/**
 * @desc    Remove Member from Group
 * @route   DELETE /v1/conversations/:conversationId/members/:userId
 * @access  Private
 */
const handleRemoveGroupMember = async (req, res) => {
  try {
    const result = await conversationService.removeGroupMember({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      targetUserId: req.params.userId,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'REMOVE_MEMBER_ERROR' },
    });
  }
};

/**
 * @desc    Update Member Role in Group
 * @route   PATCH /v1/conversations/:conversationId/members/:userId/role
 * @access  Private
 */
const handleUpdateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    const result = await conversationService.updateMemberRole({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      targetUserId: req.params.userId,
      newRole: role,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'ROLE_UPDATE_ERROR' },
    });
  }
};

/**
 * @desc    Transfer Group Ownership
 * @route   POST /v1/conversations/:conversationId/transfer-ownership
 * @access  Private
 */
const handleTransferOwnership = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const result = await conversationService.transferOwnership({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      targetUserId,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'TRANSFER_OWNERSHIP_ERROR' },
    });
  }
};

/**
 * @desc    Leave Group Conversation
 * @route   POST /v1/conversations/:conversationId/leave
 * @access  Private
 */
const handleLeaveGroup = async (req, res) => {
  try {
    const result = await conversationService.leaveGroup({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      ok: false,
      message: error.message,
      error: { code: error.code || 'LEAVE_GROUP_ERROR' },
    });
  }
};

module.exports = {
  getConversations,
  getConversationById,
  ensureDirectConversation,
  createMessage,
  unsendMessage,
  handleCreateGroup,
  handleUpdateGroup,
  handleGetGroupMembers,
  handleAddGroupMembers,
  handleRemoveGroupMember,
  handleUpdateMemberRole,
  handleTransferOwnership,
  handleLeaveGroup,
};

