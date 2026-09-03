const mongoose = require('mongoose');
const { MessageReactions } = require('./enums');

const MessageReactionSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reaction: {
      type: String,
      required: true,
      enum: Object.values(MessageReactions),
    },
  },
  { timestamps: true }
);

// Enforce one active reaction per user per message (R3-09-REQ-001, R3-09-REQ-005)
MessageReactionSchema.index(
  { messageId: 1, userId: 1 },
  { unique: true, name: 'uniq_message_user_reaction' }
);

// Index for reactor lookups and counts
MessageReactionSchema.index(
  { conversationId: 1, messageId: 1, reaction: 1 }
);

module.exports = mongoose.model('MessageReaction', MessageReactionSchema);
