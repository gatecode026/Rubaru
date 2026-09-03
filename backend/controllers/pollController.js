/**
 * In-Chat Poll REST Controller
 * R3-09-REQ-020
 */

const {
  votePoll,
  removePollVote,
  closePoll,
  getPollDetail,
} = require('../services/pollService');

/**
 * PUT /v1/conversations/:conversationId/polls/:pollId/vote
 */
async function submitPollVote(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, pollId } = req.params;
    const { optionIds } = req.body;

    const result = await votePoll({
      actorUserId,
      conversationId,
      pollId,
      optionIds,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'POLL_NOT_FOUND' ? 404 : 400);
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'POLL_VOTE_ERROR',
      message: error.message || 'Failed to submit vote',
    });
  }
}

/**
 * DELETE /v1/conversations/:conversationId/polls/:pollId/vote
 */
async function deletePollVote(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, pollId } = req.params;

    const result = await removePollVote({
      actorUserId,
      conversationId,
      pollId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'POLL_NOT_FOUND' ? 404 : 400);
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'POLL_VOTE_ERROR',
      message: error.message || 'Failed to remove vote',
    });
  }
}

/**
 * POST /v1/conversations/:conversationId/polls/:pollId/close
 */
async function handleClosePoll(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, pollId } = req.params;

    const result = await closePoll({
      actorUserId,
      conversationId,
      pollId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'POLL_NOT_FOUND' ? 404 : 400);
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'POLL_CLOSE_ERROR',
      message: error.message || 'Failed to close poll',
    });
  }
}

/**
 * GET /v1/conversations/:conversationId/polls/:pollId
 */
async function getPoll(req, res) {
  try {
    const actorUserId = req.user && (req.user._id || req.user.id || req.user.userId);
    const { conversationId, pollId } = req.params;

    const result = await getPollDetail({
      actorUserId,
      conversationId,
      pollId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || (error.code === 'POLL_NOT_FOUND' ? 404 : 400);
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'POLL_ERROR',
      message: error.message || 'Failed to retrieve poll',
    });
  }
}

module.exports = {
  submitPollVote,
  deletePollVote,
  handleClosePoll,
  getPoll,
};
