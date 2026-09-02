const mongoose = require('mongoose');

const UserEntitlementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    dailyFreeLikesLimit: {
      type: Number,
      default: 25,
      min: 0,
    },
    likesUsedToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    likesResetsAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    hasUnlimitedLikes: {
      type: Boolean,
      default: false,
    },
    rosesBalance: {
      type: Number,
      default: 1, // 1 free weekly rose by default
      min: 0,
    },
    priorityLikesBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    undoPassEntitlement: {
      type: Boolean,
      default: true,
    },
    dailyUndoAllowance: {
      type: Number,
      default: 3, // 3 free undos per 24 hours
      min: 0,
    },
    undoUsedToday: {
      type: Number,
      default: 0,
      min: 0,
    },
    undoResetsAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    premiumTier: {
      type: String,
      enum: ['FREE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'],
      default: 'FREE',
    },
    premiumExpiresAt: {
      type: Date,
    },
    boostActiveUntil: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserEntitlement', UserEntitlementSchema);
