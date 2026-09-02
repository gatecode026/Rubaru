const express = require('express');
const { getCandidates, recordImpressions } = require('../controllers/discoveryController');
const { passCandidate, removeCandidate, undoPass } = require('../controllers/interactionController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All discovery endpoints require authenticated session
router.use(protect);

// Candidates feed
router.get('/candidates', getCandidates);

// Confirmed profile impressions
router.post('/impressions', recordImpressions);

// Negative Discovery Interactions
router.post('/pass', passCandidate);
router.post('/remove', removeCandidate);
router.post('/undo', undoPass);

module.exports = router;
