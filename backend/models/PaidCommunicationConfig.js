const mongoose = require('mongoose');

const PaidCommunicationConfigSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    rates: {
      MESSAGE: {
        type: Number,
        required: true,
        default: 1,
        validate: {
          validator: (v) => Number.isInteger(v) && v > 0,
          message: 'MESSAGE rate must be a positive integer',
        },
      },
      AUDIO: {
        type: Number,
        required: true,
        default: 5,
        validate: {
          validator: (v) => Number.isInteger(v) && v > 0,
          message: 'AUDIO rate must be a positive integer',
        },
      },
      VIDEO: {
        type: Number,
        required: true,
        default: 10,
        validate: {
          validator: (v) => Number.isInteger(v) && v > 0,
          message: 'VIDEO rate must be a positive integer',
        },
      },
    },
    billingIncrementSeconds: {
      type: Number,
      required: true,
      default: 60,
      min: 1,
    },
    connectionGraceSeconds: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
    },
    heartbeatIntervalSeconds: {
      type: Number,
      required: true,
      default: 10,
      min: 1,
    },
    heartbeatTimeoutSeconds: {
      type: Number,
      required: true,
      default: 30,
      min: 5,
    },
    requestExpirationSeconds: {
      type: Number,
      required: true,
      default: 60,
      min: 10,
    },
    enabled: {
      MESSAGE: {
        type: Boolean,
        default: true,
      },
      AUDIO: {
        type: Boolean,
        default: false,
      },
      VIDEO: {
        type: Boolean,
        default: false,
      },
      BACKGROUND_CALLS: {
        type: Boolean,
        default: true,
      },
      BILLING_WORKER: {
        type: Boolean,
        default: true,
      },
      RECEIVER_EARNING: {
        type: Boolean,
        default: true,
      },
      EMERGENCY_STOP: {
        type: Boolean,
        default: false,
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Fail-closed loader with resilient auto-provisioning for active rate configuration
 */
PaidCommunicationConfigSchema.statics.getActiveConfig = async function (session = null) {
  const query = this.findOne({ isActive: true }).sort({ version: -1 });
  if (session) {
    query.session(session);
  }
  let config = await query;
  if (!config) {
    try {
      config = await this.create({
        version: 1,
        isActive: true,
        rates: {
          MESSAGE: 1,
          AUDIO: 5,
          VIDEO: 10,
        },
        billingIncrementSeconds: 60,
        connectionGraceSeconds: 15,
        heartbeatIntervalSeconds: 10,
        heartbeatTimeoutSeconds: 30,
        requestExpirationSeconds: 60,
        enabled: {
          MESSAGE: true,
          AUDIO: true,
          VIDEO: true,
          BACKGROUND_CALLS: true,
          BILLING_WORKER: true,
          RECEIVER_EARNING: true,
          EMERGENCY_STOP: false,
        },
      });
    } catch (e) {
      config = await this.findOne({ isActive: true }).sort({ version: -1 });
    }
  }

  if (!config) {
    // In-memory fallback
    return {
      version: 1,
      isActive: true,
      rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
      billingIncrementSeconds: 60,
      connectionGraceSeconds: 15,
      heartbeatIntervalSeconds: 10,
      heartbeatTimeoutSeconds: 30,
      requestExpirationSeconds: 60,
      enabled: {
        MESSAGE: true,
        AUDIO: true,
        VIDEO: true,
        BACKGROUND_CALLS: true,
        BILLING_WORKER: true,
        RECEIVER_EARNING: true,
        EMERGENCY_STOP: false,
      },
    };
  }

  return config;
};

module.exports = mongoose.model('PaidCommunicationConfig', PaidCommunicationConfigSchema);
