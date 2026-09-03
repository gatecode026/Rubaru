const express = require('express');
const router = express.Router();
const { getSyncManifest } = require('../controllers/syncController');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /v1/messaging/sync (Manifest endpoint)
router.get('/sync', getSyncManifest);
router.get('/manifest', getSyncManifest);

module.exports = router;
