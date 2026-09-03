/**
 * Message Reactions REST Controller
 * R3-09-REQ-020
 */

const {
  addOrUpdateReaction,
  removeReaction,
  getMessageReactions,
} = require('../services/reactionService');

/**
 * PUT /v1/conversations/:conversationId/messages/:messageId/reaction
 */
async function putReaction(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, messageId } = req.params;
    const { reaction } = req.body;

    if (!reaction) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_REACTION',
        message: 'Reaction field is required',
      });
    }

    const result = await addOrUpdateReaction({
      actorUserId,
      conversationId,
      messageId,
      reaction,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'MESSAGE_NOT_FOUND' ? 404 : 400);
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REACTION_ERROR',
      message: error.message || 'Failed to update reaction',
    });
  }
}

/**
 * DELETE /v1/conversations/:conversationId/messages/:messageId/reaction
 */
async function deleteReaction(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, messageId } = req.params;

    const result = await removeReaction({
      actorUserId,
      conversationId,
      messageId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'MESSAGE_NOT_FOUND' ? 404 : 400);
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REACTION_ERROR',
      message: error.message || 'Failed to remove reaction',
    });
  }
}

/**
 * GET /v1/conversations/:conversationId/messages/:messageId/reactions
 */
async function getReactions(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, messageId } = req.params;
    const { limit } = req.query;

    const result = await getMessageReactions({
      actorUserId,
      conversationId,
      messageId,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REACTION_ERROR',
      message: error.message || 'Failed to retrieve reactions',
    });
  }
}

module.exports = {
  putReaction,
  deleteReaction,
  getReactions,
};
