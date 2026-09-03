const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createReel,
  getReelById,
  getUserReels,
  getConnectedReelsFeed,
  recordPlaybackEvents,
  deleteReel,
  archiveReel,
  unarchiveReel,
} = require('../controllers/reelController');

// Reel Creation & Feed
router.post('/reels', protect, upload.single('video'), createReel);
router.post('/', protect, upload.single('video'), createReel);
router.get('/reels/feed', protect, getConnectedReelsFeed);
router.get('/feed', protect, getConnectedReelsFeed);
router.get('/reels', protect, getConnectedReelsFeed);
router.get('/', protect, getConnectedReelsFeed);

// Playback Ingestion
router.post('/reels/playback-events', protect, recordPlaybackEvents);
router.post('/playback-events', protect, recordPlaybackEvents);

// Reel Single Operations (Explicit /reels and 24-hex ID pattern)
router.get('/reels/:reelId', protect, getReelById);
router.get('/:reelId([0-9a-fA-F]{24})', protect, getReelById);
router.delete('/reels/:reelId', protect, deleteReel);
router.delete('/:reelId([0-9a-fA-F]{24})', protect, deleteReel);
router.post('/reels/:reelId/archive', protect, archiveReel);
router.post('/:reelId([0-9a-fA-F]{24})/archive', protect, archiveReel);
router.post('/reels/:reelId/unarchive', protect, unarchiveReel);
router.post('/:reelId([0-9a-fA-F]{24})/unarchive', protect, unarchiveReel);

// User Reels List
router.get('/users/:userId/reels', protect, getUserReels);
router.get('/user/:userId', protect, getUserReels);
router.get('/users/me/reels', protect, getUserReels);
router.get('/user/me', protect, getUserReels);
router.get('/reels/user/me', protect, getUserReels);
router.get('/reels/user/:userId', protect, getUserReels);

module.exports = router;
