const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversationById,
  ensureDirectConversation,
  createMessage,
  unsendMessage,
  handleCreateGroup,
  handleUpdateGroup,
  handleGetGroupMembers,
  handleAddGroupMembers,
  handleRemoveGroupMember,
  handleUpdateMemberRole,
  handleTransferOwnership,
  handleLeaveGroup,
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
router.post('/', handleCreateGroup); // Create Group Conversation
router.get('/:conversationId', getConversationById);
router.patch('/:conversationId', handleUpdateGroup); // Update Group Metadata
router.post('/ensure-direct', ensureDirectConversation);
router.post('/:conversationId/messages', createMessage);
router.delete('/:conversationId/messages/:messageId', unsendMessage);

// Group Membership Management Routes
router.get('/:conversationId/members', handleGetGroupMembers);
router.post('/:conversationId/members', handleAddGroupMembers);
router.delete('/:conversationId/members/:userId', handleRemoveGroupMember);
router.patch('/:conversationId/members/:userId/role', handleUpdateMemberRole);
router.post('/:conversationId/transfer-ownership', handleTransferOwnership);
router.post('/:conversationId/leave', handleLeaveGroup);

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

// Forward Catch-Up Sync Route (R3-07 Canonical: /messages/sync)
router.get('/:conversationId/messages/sync', syncMessages);
// Backward compatibility alias for deprecated /:conversationId/sync
router.get('/:conversationId/sync', (req, res, next) => {
  res.setHeader('Deprecation', '@deprecated Use /v1/conversations/:conversationId/messages/sync instead');
  return syncMessages(req, res, next);
});

// Watermark Receipt Routes (R3-06)
router.post('/:conversationId/receipts/delivered', markDelivered);
router.post('/:conversationId/receipts/read', markRead);
router.get('/:conversationId/receipts', getReceiptState);

module.exports = router;
