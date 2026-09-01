const reelService = require('../services/reelService');

// @desc    Create a Reel
// @route   POST /v1/reels
// @access  Private
const createReel = async (req, res) => {
  try {
    const authorId = req.user._id;
    const result = await reelService.createReel(authorId, req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REEL_CREATION_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get Single Reel
// @route   GET /v1/reels/:reelId
// @access  Private / Public
const getReelById = async (req, res) => {
  try {
    const viewerId = req.user?._id;
    const { reelId } = req.params;
    const result = await reelService.getReelById(viewerId, reelId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REEL_FETCH_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get User Reels
// @route   GET /v1/users/:userId/reels
// @access  Private
const getUserReels = async (req, res) => {
  try {
    const viewerId = req.user?._id;
    const { userId } = req.params;
    const { cursor, limit } = req.query;
    const result = await reelService.getUserReels(viewerId, userId, { cursor, limit });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'USER_REELS_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get Connected Chronological Reels Feed
// @route   GET /v1/reels/feed
// @access  Private
const getConnectedReelsFeed = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { cursor, limit } = req.query;
    const result = await reelService.getConnectedReelsFeed(viewerId, { cursor, limit });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REELS_FEED_FAILED',
      message: error.message,
    });
  }
};

// @desc    Record Reel Playback Events
// @route   POST /v1/reels/playback-events
// @access  Private
const recordPlaybackEvents = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const result = await reelService.recordPlaybackEvents(viewerId, req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'PLAYBACK_EVENTS_FAILED',
      message: error.message,
    });
  }
};

// @desc    Delete Reel
// @route   DELETE /v1/reels/:reelId
// @access  Private
const deleteReel = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { reelId } = req.params;
    const result = await reelService.deleteReel(viewerId, reelId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REEL_DELETE_FAILED',
      message: error.message,
    });
  }
};

// @desc    Archive Reel
// @route   POST /v1/reels/:reelId/archive
// @access  Private
const archiveReel = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { reelId } = req.params;
    const result = await reelService.archiveReel(viewerId, reelId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REEL_ARCHIVE_FAILED',
      message: error.message,
    });
  }
};

// @desc    Unarchive Reel
// @route   POST /v1/reels/:reelId/unarchive
// @access  Private
const unarchiveReel = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { reelId } = req.params;
    const result = await reelService.unarchiveReel(viewerId, reelId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REEL_UNARCHIVE_FAILED',
      message: error.message,
    });
  }
};

module.exports = {
  createReel,
  getReelById,
  getUserReels,
  getConnectedReelsFeed,
  recordPlaybackEvents,
  deleteReel,
  archiveReel,
  unarchiveReel,
};
