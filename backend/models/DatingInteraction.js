const mongoose = require('mongoose');
const { InteractionTypes, InteractionStatuses, TargetElementTypes } = require('./enums');

const DatingInteractionSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    target: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      validate: {
        validator: function (targetId) {
          if (!this.actor || !targetId) return true;
          return this.actor.toString() !== targetId.toString();
        },
        message: 'Actor and target cannot be the same user',
      },
    },
    type: {
      type: String,
      enum: Object.values(InteractionTypes),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(InteractionStatuses),
      default: InteractionStatuses.PENDING,
      index: true,
    },
    targetElement: {
      elementType: {
        type: String,
        enum: Object.values(TargetElementTypes),
        default: TargetElementTypes.PROFILE,
      },
      elementId: {
        type: String,
        default: '',
        trim: true,
      },
      contentSnapshot: {
        type: String,
        default: '',
      },
    },
    comment: {
      type: String,
      default: '',
      maxLength: [280, 'Like comment cannot exceed 280 characters'],
      trim: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    recommendationId: {
      type: String,
      default: '',
      trim: true,
    },
    batchId: {
      type: String,
      default: '',
      trim: true,
    },
    suppressedUntil: {
      type: Date,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    declinedAt: {
      type: Date,
    },
    withdrawnAt: {
      type: Date,
    },
    undoneAt: {
      type: Date,
    },
    expiredAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

// Indexes for high-frequency queries
DatingInteractionSchema.index({ actor: 1, target: 1, type: 1 });
DatingInteractionSchema.index({ target: 1, status: 1, createdAt: -1 });
DatingInteractionSchema.index({ actor: 1, type: 1, suppressedUntil: 1 });

module.exports = mongoose.model('DatingInteraction', DatingInteractionSchema);
