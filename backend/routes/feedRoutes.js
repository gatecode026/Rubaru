const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getConnectedFeed, recordImpressions } = require('../controllers/feedController');

// Connected Home Feed Endpoints
router.get('/feed', protect, getConnectedFeed);
router.post('/feed/impressions', protect, recordImpressions);

module.exports = router;
