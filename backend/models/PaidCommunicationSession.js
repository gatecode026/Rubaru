const mongoose = require('mongoose');
const { CallStatuses, PaidSessionStatuses, CommunicationTypes, CallEndReasons, PaidSessionEndReasons } = require('./enums');

/**
 * Authoritative Call & Paid Communication State Transition Matrix
 */
const ALLOWED_STATE_TRANSITIONS = {
  [CallStatuses.INITIATED]: [
    CallStatuses.RINGING,
    CallStatuses.ACCEPTED,
    CallStatuses.REJECTED,
    CallStatuses.DECLINED,
    CallStatuses.CANCELLED,
    CallStatuses.FAILED,
    CallStatuses.MISSED,
  ],
  [CallStatuses.PENDING]: [
    CallStatuses.RINGING,
    CallStatuses.ACCEPTED,
    CallStatuses.DECLINED,
    CallStatuses.REJECTED,
    CallStatuses.CANCELLED,
    CallStatuses.MISSED,
    CallStatuses.EXPIRED,
    CallStatuses.BLOCKED,
    CallStatuses.FAILED,
  ],
  [CallStatuses.RINGING]: [
    CallStatuses.ACCEPTED,
    CallStatuses.REJECTED,
    CallStatuses.DECLINED,
    CallStatuses.CANCELLED,
    CallStatuses.MISSED,
    CallStatuses.BUSY,
    CallStatuses.FAILED,
  ],
  [CallStatuses.ACCEPTED]: [
    CallStatuses.CONNECTING,
    CallStatuses.ACTIVE,
    CallStatuses.CANCELLED,
    CallStatuses.FAILED,
    CallStatuses.ENDED,
    CallStatuses.ENDING,
  ],
  [CallStatuses.CONNECTING]: [
    CallStatuses.ACTIVE,
    CallStatuses.CANCELLED,
    CallStatuses.FAILED,
    CallStatuses.ENDED,
    CallStatuses.ENDING,
  ],
  [CallStatuses.ACTIVE]: [
    CallStatuses.RECONNECTING,
    CallStatuses.ENDED,
    CallStatuses.FAILED,
    CallStatuses.INSUFFICIENT_BALANCE,
    CallStatuses.ENDING,
  ],
  [CallStatuses.RECONNECTING]: [
    CallStatuses.ACTIVE,
    CallStatuses.ENDED,
    CallStatuses.FAILED,
  ],
  [CallStatuses.ENDING]: [
    CallStatuses.ENDED,
    CallStatuses.FAILED,
  ],
  // Terminal states cannot transition to anything
  [CallStatuses.REJECTED]: [],
  [CallStatuses.DECLINED]: [],
  [CallStatuses.CANCELLED]: [],
  [CallStatuses.MISSED]: [],
  [CallStatuses.EXPIRED]: [],
  [CallStatuses.BUSY]: [],
  [CallStatuses.FAILED]: [],
  [CallStatuses.ENDED]: [],
  [CallStatuses.INSUFFICIENT_BALANCE]: [],
  [CallStatuses.BLOCKED]: [],
};

const PaidCommunicationSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    callId: {
      type: String,
      unique: true,
      index: true,
      sparse: true,
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
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(PaidSessionStatuses),
      default: CallStatuses.INITIATED,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: true,
      sparse: true,
      trim: true,
    },
    billingParty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    requestExpiresAt: {
      type: Date,
      default: null,
    },
    initiatedAt: {
      type: Date,
      default: null,
    },
    ringingAt: {
      type: Date,
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    connectingAt: {
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
    reconnectingAt: {
      type: Date,
      default: null,
    },
    reconnectionDeadline: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    billableSeconds: {
      type: Number,
      default: 0,
      min: 0,
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
    coinsReserved: {
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
    coinsRefunded: {
      type: Number,
      default: 0,
      min: 0,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    endReason: {
      type: String,
      default: null,
    },
    failureCode: {
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    schemaVersion: {
      type: Number,
      default: 2,
    },
  },
  { timestamps: true }
);

// Synchronize caller/receiver aliases before save
PaidCommunicationSessionSchema.pre('validate', function () {
  if (this.sessionId && !this.callId) {
    this.callId = this.sessionId;
  }
  if (this.callId && !this.sessionId) {
    this.sessionId = this.callId;
  }
  if (this.initiatorId && !this.caller) {
    this.caller = this.initiatorId;
  }
  if (this.caller && !this.initiatorId) {
    this.initiatorId = this.caller;
  }
  if (this.receiverId && !this.receiver) {
    this.receiver = this.receiverId;
  }
  if (this.receiver && !this.receiverId) {
    this.receiverId = this.receiver;
  }
  if (!this.billingParty && this.initiatorId) {
    this.billingParty = this.initiatorId;
  }
  if (!this.initiatedAt && this.createdAt) {
    this.initiatedAt = this.createdAt;
  }
});

// Indexes
PaidCommunicationSessionSchema.index({ initiatorId: 1, status: 1 });
PaidCommunicationSessionSchema.index({ receiverId: 1, status: 1 });
PaidCommunicationSessionSchema.index({ caller: 1, createdAt: -1 });
PaidCommunicationSessionSchema.index({ receiver: 1, createdAt: -1 });
PaidCommunicationSessionSchema.index({ conversationId: 1, createdAt: -1 });
PaidCommunicationSessionSchema.index({ status: 1, nextChargeAt: 1 });
PaidCommunicationSessionSchema.index({ status: 1, requestExpiresAt: 1 });
PaidCommunicationSessionSchema.index({ status: 1, reconnectionDeadline: 1 });
PaidCommunicationSessionSchema.index(
  { caller: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

/**
 * Validate State Machine Transition
 */
PaidCommunicationSessionSchema.methods.canTransitionTo = function (nextStatus) {
  const allowed = ALLOWED_STATE_TRANSITIONS[this.status] || [];
  return allowed.includes(nextStatus);
};

PaidCommunicationSessionSchema.statics.ALLOWED_STATE_TRANSITIONS = ALLOWED_STATE_TRANSITIONS;

module.exports = mongoose.model('PaidCommunicationSession', PaidCommunicationSessionSchema);
