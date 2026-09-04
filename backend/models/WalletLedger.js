const mongoose = require('mongoose');
const { LedgerEntryTypes, LedgerTransactionTypes, CommunicationTypes } = require('./enums');

const WalletLedgerSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      index: true,
    },
    minuteIndex: {
      type: Number,
      default: null,
      min: 1,
    },
    entryType: {
      type: String,
      enum: Object.values(LedgerEntryTypes),
      required: true,
    },
    transactionType: {
      type: String,
      enum: Object.values(LedgerTransactionTypes),
      default: LedgerTransactionTypes.COMMUNICATION_CHARGE,
      index: true,
    },
    communicationType: {
      type: String,
      enum: Object.values(CommunicationTypes),
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v) => Number.isInteger(v) && v > 0,
        message: 'Ledger amount must be a positive integer (> 0)',
      },
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 0,
        message: 'balanceBefore must be a non-negative integer',
      },
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (v) => Number.isInteger(v) && v >= 0,
        message: 'balanceAfter must be a non-negative integer',
      },
    },
    counterpartyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable: no updatedAt
  }
);

// Compound index to prevent duplicate charges per session minute per entryType
WalletLedgerSchema.index(
  { sessionId: 1, minuteIndex: 1, entryType: 1 },
  { unique: true, partialFilterExpression: { sessionId: { $type: 'string' }, minuteIndex: { $type: 'number' } } }
);

// Filter and sorting indexes for user transaction history
WalletLedgerSchema.index({ userId: 1, createdAt: -1 });

// Strict immutability hooks: Block any update or delete operations on ledger
const rejectMutation = function (next) {
  const err = new Error('IMMUTABLE_RECORD: Wallet ledger entries cannot be updated or deleted.');
  if (typeof next === 'function') {
    return next(err);
  }
  throw err;
};

WalletLedgerSchema.pre('updateOne', rejectMutation);
WalletLedgerSchema.pre('updateMany', rejectMutation);
WalletLedgerSchema.pre('findOneAndUpdate', rejectMutation);
WalletLedgerSchema.pre('replaceOne', rejectMutation);
WalletLedgerSchema.pre('deleteOne', rejectMutation);
WalletLedgerSchema.pre('deleteMany', rejectMutation);
WalletLedgerSchema.pre('findOneAndDelete', rejectMutation);
WalletLedgerSchema.pre('findOneAndRemove', rejectMutation);

module.exports = mongoose.model('WalletLedger', WalletLedgerSchema);
