const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  likeContent,
  unlikeContent,
  createComment,
  getComments,
  getCommentReplies,
  deleteComment,
  likeComment,
  unlikeComment,
  saveContent,
  unsaveContent,
  getSavedContent,
  recordShare,
  markNotInterested,
  unmarkNotInterested,
} = require('../controllers/interactionController');

// Content Likes
router.post('/content/:contentId/like', protect, likeContent);
router.delete('/content/:contentId/like', protect, unlikeContent);

// Comments & Replies
router.post('/content/:contentId/comments', protect, createComment);
router.get('/content/:contentId/comments', protect, getComments);
router.get('/comments/:commentId/replies', protect, getCommentReplies);
router.delete('/comments/:commentId', protect, deleteComment);

// Comment Likes
router.post('/comments/:commentId/like', protect, likeComment);
router.delete('/comments/:commentId/like', protect, unlikeComment);

// Saves
router.post('/content/:contentId/save', protect, saveContent);
router.delete('/content/:contentId/save', protect, unsaveContent);
router.get('/users/me/saved-content', protect, getSavedContent);

// Shares
router.post('/content/:contentId/share', protect, recordShare);

// Not Interested
router.post('/content/:contentId/not-interested', protect, markNotInterested);
router.delete('/content/:contentId/not-interested', protect, unmarkNotInterested);

module.exports = router;
