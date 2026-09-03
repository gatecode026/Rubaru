const mongoose = require('mongoose');

const MessageAttachmentSchema = new mongoose.Schema(
  {
    mediaAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MediaAsset',
      required: true,
    },
    type: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'AUDIO', 'VOICE_NOTE'],
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    waveform: {
      version: { type: Number, default: 1 },
      samples: [{ type: Number }],
      peaks: [{ type: Number }],
      sampleCount: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
    thumbnailKey: {
      type: String,
      default: '',
    },
    originalObjectKey: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientMessageId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    sequence: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'TEXT',
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'VOICE_NOTE',
        'POLL',
        'text',
        'image',
        'voice',
        'sticker',
        'poll',
      ],
      default: 'TEXT',
      required: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    attachments: {
      type: [MessageAttachmentSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    // R3-09 Additive Fields
    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true,
    },
    replyToSequence: {
      type: Number,
      default: null,
    },
    pollId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Poll',
      default: null,
      index: true,
    },
    reactionSummary: {
      version: {
        type: Number,
        default: 0,
      },
      total: {
        type: Number,
        default: 0,
        min: 0,
      },
      counts: {
        type: Map,
        of: Number,
        default: () => new Map(),
      },
    },
    // Backward compatibility aliases
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    attachmentUri: {
      type: String,
      default: '',
    },
    stickerId: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        emoji: String,
      },
    ],
    isPoll: {
      type: Boolean,
      default: false,
    },
    pollQuestion: {
      type: String,
      default: '',
    },
    pollOptions: [
      {
        optionText: {
          type: String,
          required: true,
        },
        votes: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// Pre-validate hook to synchronize alias fields
MessageSchema.pre('validate', function () {
  if (this.conversationId && !this.chat) {
    this.chat = this.conversationId;
  } else if (this.chat && !this.conversationId) {
    this.conversationId = this.chat;
  }

  if (this.senderId && !this.sender) {
    this.sender = this.senderId;
  } else if (this.sender && !this.senderId) {
    this.senderId = this.sender;
  }
});

// Authoritative unique compound indexes
MessageSchema.index(
  { conversationId: 1, sequence: 1 },
  {
    unique: true,
    sparse: true,
    name: 'uniq_conv_msg_sequence',
  }
);
MessageSchema.index(
  { conversationId: 1, senderId: 1, clientMessageId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'uniq_conv_sender_client_msg_id',
  }
);

// Compound indexes for history queries
MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
