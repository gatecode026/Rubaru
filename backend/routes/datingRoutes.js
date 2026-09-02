const express = require('express');
const { getPreferences, updatePreferences } = require('../controllers/preferenceController');
const { updateLocation } = require('../controllers/locationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All dating routes require authenticated session
router.use(protect);

// Preferences routes
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

// Location routes
router.put('/location', updateLocation);

module.exports = router;
