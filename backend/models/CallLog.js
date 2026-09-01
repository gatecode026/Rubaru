const mongoose = require('mongoose');

const CallLogSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    callType: {
      type: String,
      enum: ['outgoing', 'incoming', 'missed', 'missed-x'],
      required: true,
    },
    callIconType: {
      type: String,
      enum: ['voice', 'video'],
      default: 'voice',
    },
    duration: {
      type: String,
      default: '---', // e.g., "1:32m" or "32s"
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CallLog', CallLogSchema);
