/**
 * Presence REST Controller
 * R3-08-REQ-010: Authorized presence snapshot endpoint
 */

const presenceService = require('../services/presenceService');

/**
 * GET /v1/conversations/:conversationId/presence
 * Authorized presence snapshot for a specific conversation
 */
async function getConversationPresence(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId } = req.params;

    if (!actorUserId) {
      return res.status(401).json({
        success: false,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required to view presence',
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        code: 'CONVERSATION_ID_REQUIRED',
        message: 'conversationId parameter is required',
      });
    }

    const snapshot = await presenceService.getAuthorizedPresenceSnapshot({
      actorUserId,
      conversationId,
    });

    return res.status(200).json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'CONVERSATION_NOT_FOUND' ? 404 : 403);
    const code = error.code === 'CONVERSATION_NOT_FOUND' ? 'CONVERSATION_NOT_FOUND' : (error.code || 'PRESENCE_ACCESS_DENIED');

    return res.status(statusCode).json({
      success: false,
      code,
      message: error.message || 'Failed to retrieve presence snapshot',
    });
  }
}

module.exports = {
  getConversationPresence,
};
