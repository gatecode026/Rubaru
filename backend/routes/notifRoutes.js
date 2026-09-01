const express = require('express');
const {
  getNotifications,
  markAsRead,
} = require('../controllers/notifController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);

module.exports = router;
