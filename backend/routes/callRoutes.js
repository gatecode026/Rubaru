const express = require('express');
const {
  getCallLogs,
  createCallLog,
} = require('../controllers/callController');
const { protect } = require('../middleware/auth');
const turnService = require('../services/turnService');

const router = express.Router();

router.use(protect);

router.get('/logs', getCallLogs);
router.post('/logs', createCallLog);

/**
 * GET /api/calls/turn-credentials and /api/calls/ice-servers
 * Return short-lived HMAC-authenticated STUN/TURN configuration
 */
const getIceServersHandler = async (req, res) => {
  try {
    const creds = turnService.generateTurnCredentials(req.user._id.toString());
    return res.json({
      ok: true,
      data: creds,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, code: 'TURN_ERROR', message: err.message });
  }
};

router.get('/turn-credentials', getIceServersHandler);
router.get('/ice-servers', getIceServersHandler);

module.exports = router;
