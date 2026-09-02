const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      index: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED', 'BLOCKED', 'CLOSED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Chat', ChatSchema);
