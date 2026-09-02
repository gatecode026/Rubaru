const mongoose = require('mongoose');

const BlockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    blocked: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      validate: {
        validator: function (blockedId) {
          if (!this.blocker || !blockedId) return true;
          return this.blocker.toString() !== blockedId.toString();
        },
        message: 'Users cannot block themselves',
      },
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Unique constraint to avoid duplicate block entries
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

// Reverse index for fast bilateral block queries during candidate discovery
BlockSchema.index({ blocked: 1, blocker: 1 });

module.exports = mongoose.model('Block', BlockSchema);
