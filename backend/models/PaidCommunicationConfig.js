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
 * Fail-closed loader for active rate configuration
 */
PaidCommunicationConfigSchema.statics.getActiveConfig = async function (session = null) {
  const query = this.findOne({ isActive: true }).sort({ version: -1 });
  if (session) {
    query.session(session);
  }
  const config = await query;
  if (!config) {
    throw new Error('CONFIGURATION_UNAVAILABLE: No active paid communication configuration found.');
  }

  // Validate critical rate and timing boundaries
  if (
    !config.rates ||
    typeof config.rates.MESSAGE !== 'number' ||
    typeof config.rates.AUDIO !== 'number' ||
    typeof config.rates.VIDEO !== 'number' ||
    config.rates.MESSAGE <= 0 ||
    config.rates.AUDIO <= 0 ||
    config.rates.VIDEO <= 0
  ) {
    throw new Error('CONFIGURATION_INVALID: Active rate configuration has invalid coin rates.');
  }

  return config;
};

module.exports = mongoose.model('PaidCommunicationConfig', PaidCommunicationConfigSchema);
