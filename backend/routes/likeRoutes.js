const express = require('express');
const { sendLike, withdrawLike, getIncomingLikes, declineLike, acceptLike } = require('../controllers/likeController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All like endpoints require authenticated session
router.use(protect);

// Send Like, Rose, Priority Like
router.post('/', sendLike);

// Incoming Likes Inbox
router.get('/incoming', getIncomingLikes);

// Accept Incoming Like (Prompt 11)
router.post('/:id/accept', acceptLike);

// Decline Incoming Like
router.post('/:id/decline', declineLike);

// Withdraw pending like
router.delete('/:id', withdrawLike);

module.exports = router;
