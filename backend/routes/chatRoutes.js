const express = require('express');
const {
  getChats,
  getMessages,
  sendMessage,
  createPoll,
  votePoll,
  reactMessage,
} = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect);

router.get('/', getChats);
router.get('/:chatId/messages', getMessages);

router.post('/message', upload.single('attachment'), sendMessage);
router.post('/poll', createPoll);
router.post('/poll/:messageId/vote', votePoll);
router.post('/message/:messageId/react', reactMessage);

module.exports = router;
