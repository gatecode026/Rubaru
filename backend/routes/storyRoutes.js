const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createStory,
  getStoryTray,
  getStoryById,
  getUserStories,
  recordStoryView,
  getStoryViewers,
  deleteStory,
} = require('../controllers/storyController');

// Story Creation & Feed Tray
router.post('/stories', protect, createStory);
router.get('/stories/feed', protect, getStoryTray);
router.get('/stories/tray', protect, getStoryTray);

// Story Details & View Recording
router.get('/stories/:storyId', protect, getStoryById);
router.post('/stories/:storyId/view', protect, recordStoryView);
router.get('/stories/:storyId/viewers', protect, getStoryViewers);
router.delete('/stories/:storyId', protect, deleteStory);

// User Story Sequence
router.get('/users/:userId/stories', protect, getUserStories);

module.exports = router;
