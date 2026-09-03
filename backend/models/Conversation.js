const mongoose = require('mongoose');
const { ConversationTypes, ConversationStatuses } = require('./enums');

const ConversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: Object.values(ConversationTypes),
      default: ConversationTypes.DIRECT_MATCH,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ConversationStatuses),
      default: ConversationStatuses.ACTIVE,
      required: true,
      index: true,
    },
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
    },
    canonicalParticipantKey: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    memberCount: {
      type: Number,
      default: 2,
      min: 1,
    },
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    closeReason: {
      type: String,
      default: '',
      trim: true,
    },
    schemaVersion: {
      type: String,
      default: '1.0',
      required: true,
    },
    // Backward compatibility fields
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
      default: '',
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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
  },
  { timestamps: true }
);

// Pre-validate hook to synchronize alias fields
ConversationSchema.pre('validate', function () {
  if (this.matchId && !this.match) {
    this.match = this.matchId;
  } else if (this.match && !this.matchId) {
    this.matchId = this.match;
  }

  if (this.lastMessageId && !this.lastMessage) {
    this.lastMessage = this.lastMessageId;
  } else if (this.lastMessage && !this.lastMessageId) {
    this.lastMessageId = this.lastMessage;
  }

  if (this.type === ConversationTypes.GROUP) {
    this.isGroup = true;
  } else if (this.isGroup && this.type !== ConversationTypes.GROUP) {
    this.type = ConversationTypes.GROUP;
  }
});

// Authoritative unique sparse indexes for direct match conversations
ConversationSchema.index(
  { matchId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'uniq_conv_match_id',
  }
);

ConversationSchema.index(
  { canonicalParticipantKey: 1 },
  {
    unique: true,
    sparse: true,
    name: 'uniq_conv_canonical_pair',
  }
);

// High efficiency compound indexes for conversation listing and lifecycle lookups
ConversationSchema.index({ status: 1, lastMessageAt: -1 });
ConversationSchema.index({ participants: 1, status: 1, updatedAt: -1 });
ConversationSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
