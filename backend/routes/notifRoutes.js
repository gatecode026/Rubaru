const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getPreferences,
  updatePreferences,
  registerDevice,
  deleteDevice,
} = require('../controllers/notifController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

// Notifications Core
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.put('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.put('/:id/read', markAsRead);

// Preferences
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);

// Devices
router.post('/devices', registerDevice);
router.delete('/devices/:deviceId', deleteDevice);

module.exports = router;

