const express = require('express');
const { getMatches, getMatchById } = require('../controllers/matchController');
const { unmatchMatch } = require('../controllers/safetyController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All match routes require authenticated session
router.use(protect);

// GET /v1/matches
router.get('/', getMatches);

// GET /v1/matches/:id
router.get('/:id', getMatchById);

// POST /v1/matches/:id/unmatch
router.post('/:id/unmatch', unmatchMatch);

module.exports = router;
