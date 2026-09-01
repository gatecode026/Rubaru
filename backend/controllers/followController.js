const followService = require('../services/followService');

// @desc    Follow a user (or request to follow if private)
// @route   POST /v1/users/:userId/follow
// @access  Private
const followUser = async (req, res) => {
  try {
    const result = await followService.followUser(req.user._id, req.params.userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FOLLOW_ERROR',
      message: error.message,
    });
  }
};

// @desc    Unfollow a user or cancel pending request
// @route   DELETE /v1/users/:userId/follow
// @access  Private
const unfollowUser = async (req, res) => {
  try {
    const result = await followService.unfollowUser(req.user._id, req.params.userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UNFOLLOW_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get pending follow requests
// @route   GET /v1/follow-requests
// @access  Private
const getFollowRequests = async (req, res) => {
  try {
    const result = await followService.getPendingFollowRequests(req.user._id, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FOLLOW_REQUESTS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Accept a follow request
// @route   POST /v1/follow-requests/:requestId/accept
// @access  Private
const acceptFollowRequest = async (req, res) => {
  try {
    const result = await followService.acceptFollowRequest(req.user._id, req.params.requestId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'ACCEPT_REQUEST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Decline a follow request
// @route   POST /v1/follow-requests/:requestId/decline
// @access  Private
const declineFollowRequest = async (req, res) => {
  try {
    const result = await followService.declineFollowRequest(req.user._id, req.params.requestId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'DECLINE_REQUEST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Remove an existing follower
// @route   DELETE /v1/users/:userId/followers
// @access  Private
const removeFollower = async (req, res) => {
  try {
    const result = await followService.removeFollower(req.user._id, req.params.userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'REMOVE_FOLLOWER_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get user's followers list
// @route   GET /v1/users/:userId/followers
// @access  Private
const getFollowersList = async (req, res) => {
  try {
    const result = await followService.getFollowersList(req.user._id, req.params.userId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FOLLOWERS_LIST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get user's following list
// @route   GET /v1/users/:userId/following
// @access  Private
const getFollowingList = async (req, res) => {
  try {
    const result = await followService.getFollowingList(req.user._id, req.params.userId, req.query);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FOLLOWING_LIST_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get viewer relationship status to target
// @route   GET /v1/users/:userId/follow-status
// @access  Private
const getFollowStatus = async (req, res) => {
  try {
    const result = await followService.getFollowStatus(req.user._id, req.params.userId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FOLLOW_STATUS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Update social account privacy setting (PUBLIC / PRIVATE)
// @route   PATCH /v1/users/me/social-privacy
// @access  Private
const updateSocialPrivacy = async (req, res) => {
  try {
    const result = await followService.updateSocialPrivacy(req.user._id, req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UPDATE_PRIVACY_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowRequests,
  acceptFollowRequest,
  declineFollowRequest,
  removeFollower,
  getFollowersList,
  getFollowingList,
  getFollowStatus,
  updateSocialPrivacy,
};
