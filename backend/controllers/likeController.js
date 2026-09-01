const likeService = require('../services/likeService');
const incomingLikeService = require('../services/incomingLikeService');
const matchService = require('../services/matchService');

/**
 * @desc    Send a Like, Comment, Rose or Priority Like
 * @route   POST /v1/likes
 * @access  Private
 */
const sendLike = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const result = await likeService.createLike(userId, req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred while sending like',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Withdraw a sent pending like
 * @route   DELETE /v1/likes/:id
 * @access  Private
 */
const withdrawLike = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await likeService.withdrawLike(userId, id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred while withdrawing like',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Get incoming pending likes inbox
 * @route   GET /v1/likes/incoming
 * @access  Private
 */
const getIncomingLikes = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const result = await incomingLikeService.getIncomingLikes(userId, req.query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred while fetching incoming likes',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Decline an incoming like
 * @route   POST /v1/likes/:id/decline
 * @access  Private
 */
const declineLike = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await incomingLikeService.declineIncomingLike(userId, id, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred while declining like',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Accept an incoming like and create mutual match
 * @route   POST /v1/likes/:id/accept
 * @access  Private
 */
const acceptLike = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await matchService.acceptIncomingLike(userId, id, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred while accepting like',
        details: error.details || null,
      },
    });
  }
};

module.exports = {
  sendLike,
  withdrawLike,
  getIncomingLikes,
  declineLike,
  acceptLike,
};
