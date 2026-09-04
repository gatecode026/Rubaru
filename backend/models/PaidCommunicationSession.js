const mongoose = require('mongoose');
const { PaidSessionStatuses, CommunicationTypes, PaidSessionEndReasons } = require('./enums');

const ALLOWED_STATE_TRANSITIONS = {
  [PaidSessionStatuses.PENDING]: [
    PaidSessionStatuses.ACCEPTED,
    PaidSessionStatuses.DECLINED,
    PaidSessionStatuses.CANCELLED,
    PaidSessionStatuses.MISSED,
    PaidSessionStatuses.EXPIRED,
    PaidSessionStatuses.BLOCKED,
    PaidSessionStatuses.FAILED,
  ],
  [PaidSessionStatuses.ACCEPTED]: [
    PaidSessionStatuses.CONNECTING,
    PaidSessionStatuses.ACTIVE,
    PaidSessionStatuses.ENDING,
    PaidSessionStatuses.ENDED,
    PaidSessionStatuses.CANCELLED,
    PaidSessionStatuses.MISSED,
    PaidSessionStatuses.EXPIRED,
    PaidSessionStatuses.FAILED,
  ],
  [PaidSessionStatuses.CONNECTING]: [
    PaidSessionStatuses.ACTIVE,
    PaidSessionStatuses.ENDING,
    PaidSessionStatuses.ENDED,
    PaidSessionStatuses.CANCELLED,
    PaidSessionStatuses.MISSED,
    PaidSessionStatuses.EXPIRED,
    PaidSessionStatuses.FAILED,
  ],
  [PaidSessionStatuses.ACTIVE]: [
    PaidSessionStatuses.ENDING,
    PaidSessionStatuses.ENDED,
    PaidSessionStatuses.INSUFFICIENT_BALANCE,
    PaidSessionStatuses.FAILED,
  ],
  [PaidSessionStatuses.ENDING]: [
    PaidSessionStatuses.ENDED,
    PaidSessionStatuses.FAILED,
  ],
  // Terminal states cannot transition to anything
  [PaidSessionStatuses.ENDED]: [],
  [PaidSessionStatuses.DECLINED]: [],
  [PaidSessionStatuses.CANCELLED]: [],
  [PaidSessionStatuses.MISSED]: [],
  [PaidSessionStatuses.EXPIRED]: [],
  [PaidSessionStatuses.FAILED]: [],
  [PaidSessionStatuses.INSUFFICIENT_BALANCE]: [],
  [PaidSessionStatuses.BLOCKED]: [],
};

const PaidCommunicationSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    initiatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },
    communicationType: {
      type: String,
      enum: Object.values(CommunicationTypes),
      required: true,
    },
    ratePerMinuteSnapshot: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: (v) => Number.isInteger(v) && v > 0,
        message: 'ratePerMinuteSnapshot must be a positive integer',
      },
    },
    billingIncrementSecondsSnapshot: {
      type: Number,
      required: true,
      default: 60,
      min: 1,
    },
    configurationVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(PaidSessionStatuses),
      default: PaidSessionStatuses.PENDING,
      index: true,
    },
    requestExpiresAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    initiatorConnectedAt: {
      type: Date,
      default: null,
    },
    receiverConnectedAt: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastInitiatorHeartbeatAt: {
      type: Date,
      default: null,
    },
    lastReceiverHeartbeatAt: {
      type: Date,
      default: null,
    },
    nextChargeAt: {
      type: Date,
      default: null,
      index: true,
    },
    billedMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCoinsCharged: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCoinsEarned: {
      type: Number,
      default: 0,
      min: 0,
    },
    endReason: {
      type: String,
      default: null,
    },
    latestBillingError: {
      type: String,
      default: null,
    },
    billingLeaseOwner: {
      type: String,
      default: null,
    },
    billingLeaseExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
PaidCommunicationSessionSchema.index({ initiatorId: 1, status: 1 });
PaidCommunicationSessionSchema.index({ receiverId: 1, status: 1 });
PaidCommunicationSessionSchema.index({ conversationId: 1, createdAt: -1 });
PaidCommunicationSessionSchema.index({ status: 1, nextChargeAt: 1 });
PaidCommunicationSessionSchema.index({ status: 1, requestExpiresAt: 1 });

/**
 * Validate State Machine Transition
 */
PaidCommunicationSessionSchema.methods.canTransitionTo = function (nextStatus) {
  const allowed = ALLOWED_STATE_TRANSITIONS[this.status] || [];
  return allowed.includes(nextStatus);
};

PaidCommunicationSessionSchema.statics.ALLOWED_STATE_TRANSITIONS = ALLOWED_STATE_TRANSITIONS;

module.exports = mongoose.model('PaidCommunicationSession', PaidCommunicationSessionSchema);
