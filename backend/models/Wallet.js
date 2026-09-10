const mongoose = require('mongoose');
const { WalletStatuses } = require('./enums');

const WalletSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    availableBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 0,
        message: 'availableBalance must be a non-negative integer',
      },
    },
    lifetimeEarned: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Lifetime earned cannot be negative'],
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 0,
        message: 'lifetimeEarned must be a non-negative integer',
      },
    },
    lifetimeSpent: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Lifetime spent cannot be negative'],
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 0,
        message: 'lifetimeSpent must be a non-negative integer',
      },
    },
    status: {
      type: String,
      enum: Object.values(WalletStatuses),
      default: WalletStatuses.ACTIVE,
      index: true,
    },
    version: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Prevent balance corruption before saving
WalletSchema.pre('save', function (next) {
  if (this.availableBalance < 0) {
    return next(new Error('INVALID_BALANCE: Wallet available balance cannot be negative'));
  }
  if (!Number.isInteger(this.availableBalance) || !Number.isInteger(this.lifetimeEarned) || !Number.isInteger(this.lifetimeSpent)) {
    return next(new Error('INVALID_BALANCE: Wallet amounts must be positive integers'));
  }
  next();
});

module.exports = mongoose.model('Wallet', WalletSchema);
