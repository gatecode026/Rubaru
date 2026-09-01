const storyService = require('../services/storyService');

// @desc    Create a Story
// @route   POST /v1/stories
// @access  Private
const createStory = async (req, res) => {
  try {
    const authorId = req.user._id;
    const result = await storyService.createStory(authorId, req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'STORY_CREATION_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get Story Tray for Authenticated Viewer
// @route   GET /v1/stories/feed
// @access  Private
const getStoryTray = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const result = await storyService.getStoryTray(viewerId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'STORY_TRAY_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get Single Story
// @route   GET /v1/stories/:storyId
// @access  Private
const getStoryById = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { storyId } = req.params;
    const result = await storyService.getStoryById(viewerId, storyId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'STORY_FETCH_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get User Story Sequence
// @route   GET /v1/users/:userId/stories
// @access  Private
const getUserStories = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { userId } = req.params;
    const result = await storyService.getUserStories(viewerId, userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'USER_STORIES_FETCH_FAILED',
      message: error.message,
    });
  }
};

// @desc    Record Story View
// @route   POST /v1/stories/:storyId/view
// @access  Private
const recordStoryView = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { storyId } = req.params;
    const result = await storyService.recordStoryView(viewerId, storyId, req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'STORY_VIEW_FAILED',
      message: error.message,
    });
  }
};

// @desc    Get Story Viewers (Story Owner Only)
// @route   GET /v1/stories/:storyId/viewers
// @access  Private
const getStoryViewers = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { storyId } = req.params;
    const result = await storyService.getStoryViewers(viewerId, storyId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'STORY_VIEWERS_FAILED',
      message: error.message,
    });
  }
};

// @desc    Delete Story
// @route   DELETE /v1/stories/:storyId
// @access  Private
const deleteStory = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { storyId } = req.params;
    const result = await storyService.deleteStory(viewerId, storyId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'STORY_DELETE_FAILED',
      message: error.message,
    });
  }
};

module.exports = {
  createStory,
  getStoryTray,
  getStoryById,
  getUserStories,
  recordStoryView,
  getStoryViewers,
  deleteStory,
};
