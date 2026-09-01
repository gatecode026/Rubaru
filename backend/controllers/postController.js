const postService = require('../services/postService');

// @desc    Create a new post or carousel
// @route   POST /v1/posts
// @access  Private
const createPost = async (req, res) => {
  try {
    const result = await postService.createPost(req.user._id, req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'POST_CREATION_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get single post by ID
// @route   GET /v1/posts/:postId
// @access  Private / Public-aware
const getPost = async (req, res) => {
  try {
    const viewerId = req.user ? req.user._id : null;
    const result = await postService.getPostById(viewerId, req.params.postId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'POST_GET_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get user's posts
// @route   GET /v1/users/:userId/posts
// @access  Private / Public-aware
const getUserPosts = async (req, res) => {
  try {
    const viewerId = req.user ? req.user._id : null;
    const result = await postService.getUserPosts(viewerId, req.params.userId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'USER_POSTS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Edit post details
// @route   PATCH /v1/posts/:postId
// @access  Private (Owner only)
const editPost = async (req, res) => {
  try {
    const result = await postService.editPost(req.user._id, req.params.postId, req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'EDIT_POST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Archive a post
// @route   POST /v1/posts/:postId/archive
// @access  Private (Owner only)
const archivePost = async (req, res) => {
  try {
    const result = await postService.archivePost(req.user._id, req.params.postId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'ARCHIVE_POST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Unarchive a post
// @route   POST /v1/posts/:postId/unarchive
// @access  Private (Owner only)
const unarchivePost = async (req, res) => {
  try {
    const result = await postService.unarchivePost(req.user._id, req.params.postId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UNARCHIVE_POST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Delete a post
// @route   DELETE /v1/posts/:postId
// @access  Private (Owner only)
const deletePost = async (req, res) => {
  try {
    const result = await postService.deletePost(req.user._id, req.params.postId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'DELETE_POST_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  createPost,
  getPost,
  getUserPosts,
  editPost,
  archivePost,
  unarchivePost,
  deletePost,
};
