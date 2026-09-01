const express = require('express');
const {
  getCallLogs,
  createCallLog,
} = require('../controllers/callController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/logs', getCallLogs);
router.post('/logs', createCallLog);

module.exports = router;
