const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversationById,
  ensureDirectConversation,
  createMessage,
  unsendMessage,
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

const {
  markDelivered,
  markRead,
  getReceiptState,
} = require('../controllers/receiptController');
const { syncMessages } = require('../controllers/syncController');
const { getConversationPresence } = require('../controllers/presenceController');
const {
  putReaction,
  deleteReaction,
  getReactions,
} = require('../controllers/reactionController');
const {
  submitPollVote,
  deletePollVote,
  handleClosePoll,
  getPoll,
} = require('../controllers/pollController');

router.use(protect);

router.get('/', getConversations);
router.get('/:conversationId', getConversationById);
router.post('/ensure-direct', ensureDirectConversation);
router.post('/:conversationId/messages', createMessage);
router.delete('/:conversationId/messages/:messageId', unsendMessage);

// Message Reaction Routes (R3-09)
router.put('/:conversationId/messages/:messageId/reaction', putReaction);
router.delete('/:conversationId/messages/:messageId/reaction', deleteReaction);
router.get('/:conversationId/messages/:messageId/reactions', getReactions);

// In-Chat Poll Routes (R3-09)
router.put('/:conversationId/polls/:pollId/vote', submitPollVote);
router.delete('/:conversationId/polls/:pollId/vote', deletePollVote);
router.post('/:conversationId/polls/:pollId/close', handleClosePoll);
router.get('/:conversationId/polls/:pollId', getPoll);

// Presence Snapshot Route (R3-08)
router.get('/:conversationId/presence', getConversationPresence);

// Forward Catch-Up Sync Route (R3-07)
router.get('/:conversationId/messages/sync', syncMessages);

// Watermark Receipt Routes (R3-06)
router.post('/:conversationId/receipts/delivered', markDelivered);
router.post('/:conversationId/receipts/read', markRead);
router.get('/:conversationId/receipts', getReceiptState);

module.exports = router;
