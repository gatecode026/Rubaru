const mongoose = require('mongoose');
const { MemberRoles, MemberStates, MemberNotificationPreferences } = require('./enums');

const ConversationMemberSchema = new mongoose.Schema(
  {
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
    // Alias fields for flexible query compatibility
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    role: {
      type: String,
      enum: Object.values(MemberRoles),
      default: MemberRoles.MEMBER,
      required: true,
    },
    state: {
      type: String,
      enum: Object.values(MemberStates),
      default: MemberStates.ACTIVE,
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    joinedSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    leftAt: {
      type: Date,
    },
    removedAt: {
      type: Date,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    mutedUntil: {
      type: Date,
      default: null,
    },
    lastDeliveredSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReadSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveredThroughSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    readThroughSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    receiptVersion: {
      type: Number,
      default: 1,
    },
    notificationPreference: {
      type: String,
      enum: Object.values(MemberNotificationPreferences),
      default: MemberNotificationPreferences.ALL,
      required: true,
    },
  },
  { timestamps: true }
);

// Pre-validate hook to synchronize alias and watermark fields
ConversationMemberSchema.pre('validate', function () {
  if (this.conversationId && !this.conversation) {
    this.conversation = this.conversationId;
  } else if (this.conversation && !this.conversationId) {
    this.conversationId = this.conversation;
  }

  if (this.userId && !this.user) {
    this.user = this.userId;
  } else if (this.user && !this.userId) {
    this.userId = this.user;
  }

  // Synchronize delivery watermarks
  if (this.deliveredThroughSequence !== undefined && this.lastDeliveredSequence === undefined) {
    this.lastDeliveredSequence = this.deliveredThroughSequence;
  } else if (this.lastDeliveredSequence !== undefined && (this.deliveredThroughSequence === undefined || this.deliveredThroughSequence === 0)) {
    this.deliveredThroughSequence = this.lastDeliveredSequence;
  }

  // Synchronize read watermarks
  if (this.readThroughSequence !== undefined && this.lastReadSequence === undefined) {
    this.lastReadSequence = this.readThroughSequence;
  } else if (this.lastReadSequence !== undefined && (this.readThroughSequence === undefined || this.readThroughSequence === 0)) {
    this.readThroughSequence = this.lastReadSequence;
  }
});

// Unique compound constraint: A user can have only one membership record per conversation
ConversationMemberSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

// Compound indexes for high-frequency queries
ConversationMemberSchema.index({ userId: 1, state: 1, updatedAt: -1 });
ConversationMemberSchema.index({ conversationId: 1, state: 1 });
ConversationMemberSchema.index({ conversationId: 1, userId: 1, state: 1 });

module.exports = mongoose.model('ConversationMember', ConversationMemberSchema);
