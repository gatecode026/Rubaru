const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createPost,
  getPost,
  getUserPosts,
  editPost,
  archivePost,
  unarchivePost,
  deletePost,
} = require('../controllers/postController');

// Post creation
router.post('/posts', protect, createPost);

// Single post operations
router.get('/posts/:postId', protect, getPost);
router.patch('/posts/:postId', protect, editPost);
router.delete('/posts/:postId', protect, deletePost);

// Archive / Unarchive
router.post('/posts/:postId/archive', protect, archivePost);
router.post('/posts/:postId/unarchive', protect, unarchivePost);

// User post list
router.get('/users/:userId/posts', protect, getUserPosts);

module.exports = router;
