const mongoose = require('mongoose');

const PollVoteSchema = new mongoose.Schema(
  {
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    optionIds: {
      type: [String],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

// Enforce one vote document per user per poll (R3-09-REQ-015)
PollVoteSchema.index(
  { pollId: 1, userId: 1 },
  { unique: true, name: 'uniq_poll_user_vote' }
);

module.exports = mongoose.model('PollVote', PollVoteSchema);
