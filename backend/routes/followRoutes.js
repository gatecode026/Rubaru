const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
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
} = require('../controllers/followController');

// Privacy setting
router.patch('/users/me/social-privacy', protect, updateSocialPrivacy);

// Follow requests management
router.get('/follow-requests', protect, getFollowRequests);
router.post('/follow-requests/:requestId/accept', protect, acceptFollowRequest);
router.post('/follow-requests/:requestId/decline', protect, declineFollowRequest);

// Follow / Unfollow user
router.post('/users/:userId/follow', protect, followUser);
router.delete('/users/:userId/follow', protect, unfollowUser);

// Follower removal
router.delete('/users/:userId/followers', protect, removeFollower);

// Followers & Following lists
router.get('/users/:userId/followers', protect, getFollowersList);
router.get('/users/:userId/following', protect, getFollowingList);

// Relationship status
router.get('/users/:userId/follow-status', protect, getFollowStatus);

module.exports = router;
