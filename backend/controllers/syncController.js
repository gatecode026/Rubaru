const syncService = require('../services/syncService');

/**
 * @desc    Get synchronization manifest for reconnecting client
 * @route   GET /v1/messaging/sync
 * @access  Private
 */
const getSyncManifest = async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const result = await syncService.getConversationSyncManifest({
      actorUserId: req.user._id,
      cursor,
      limit,
    });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'SYNC_MANIFEST_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Forward sequence-based catch-up query for a conversation
 * @route   GET /v1/conversations/:conversationId/messages/sync
 * @access  Private
 */
const syncMessages = async (req, res) => {
  try {
    const { afterSequence, cursor, limit } = req.query;
    const result = await syncService.syncConversationMessages({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      afterSequence,
      cursor,
      limit,
    });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'CONVERSATION_SYNC_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  getSyncManifest,
  syncMessages,
};
