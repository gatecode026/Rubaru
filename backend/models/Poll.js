const mongoose = require('mongoose');
const { PollStatuses } = require('./enums');

const PollOptionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    order: {
      type: Number,
      default: 0,
    },
    voteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const PollSchema = new mongoose.Schema(
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
      unique: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    options: {
      type: [PollOptionSchema],
      required: true,
      validate: [
        (val) => Array.isArray(val) && val.length >= 2 && val.length <= 10,
        'Poll must have between 2 and 10 options',
      ],
    },
    allowMultiple: {
      type: Boolean,
      default: false,
    },
    maxSelections: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    status: {
      type: String,
      enum: Object.values(PollStatuses),
      default: PollStatuses.OPEN,
      index: true,
    },
    closesAt: {
      type: Date,
      default: null,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    totalVoters: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Poll', PollSchema);
