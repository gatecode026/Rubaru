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

module.exports = {
  getConversations,
  getConversationById,
  ensureDirectConversation,
  createMessage,
  unsendMessage,
};
