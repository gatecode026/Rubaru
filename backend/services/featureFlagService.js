const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const AdminAuditLog = require('../models/AdminAuditLog');

/**
 * Feature Flags & Safe Staged Rollout Management Service
 */
class FeatureFlagService {
  /**
   * Get all active feature flags from database-backed configuration
   */
  async getFeatureFlags() {
    const config = await PaidCommunicationConfig.getActiveConfig();
    return {
      version: config.version,
      flags: {
        PAID_MESSAGING: config.enabled.MESSAGE === true,
        PAID_AUDIO: config.enabled.AUDIO === true,
        PAID_VIDEO: config.enabled.VIDEO === true,
        BACKGROUND_CALL_NOTIFICATIONS: config.enabled.BACKGROUND_CALLS !== false,
        AUTOMATIC_BILLING_WORKER: config.enabled.BILLING_WORKER !== false,
        RECEIVER_COIN_EARNING: config.enabled.RECEIVER_EARNING !== false,
        emergencyStop: Boolean(config.enabled.EMERGENCY_STOP),
        EMERGENCY_STOP: Boolean(config.enabled.EMERGENCY_STOP),
      },
      rolloutStage: config.metadata && config.metadata.rolloutStage ? config.metadata.rolloutStage : 'STAGE_1_INTERNAL_TESTING',
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update feature flags with strict admin authorization & audit log
   */
  async updateFeatureFlags({ adminUserId, flags, rolloutStage, reason, ipAddress }) {
    if (!adminUserId) {
      throw new Error('ADMIN_USER_REQUIRED: Admin user ID is required to modify feature flags');
    }

    const config = await PaidCommunicationConfig.getActiveConfig();
    const previousFlags = { ...config.enabled };

    if (flags) {
      if (flags.PAID_MESSAGING !== undefined) config.enabled.MESSAGE = Boolean(flags.PAID_MESSAGING);
      if (flags.PAID_AUDIO !== undefined) config.enabled.AUDIO = Boolean(flags.PAID_AUDIO);
      if (flags.PAID_VIDEO !== undefined) config.enabled.VIDEO = Boolean(flags.PAID_VIDEO);
      if (flags.BACKGROUND_CALL_NOTIFICATIONS !== undefined) config.enabled.BACKGROUND_CALLS = Boolean(flags.BACKGROUND_CALL_NOTIFICATIONS);
      if (flags.AUTOMATIC_BILLING_WORKER !== undefined) config.enabled.BILLING_WORKER = Boolean(flags.AUTOMATIC_BILLING_WORKER);
      if (flags.RECEIVER_COIN_EARNING !== undefined) config.enabled.RECEIVER_EARNING = Boolean(flags.RECEIVER_COIN_EARNING);
      if (flags.emergencyStop !== undefined) config.enabled.EMERGENCY_STOP = Boolean(flags.emergencyStop);
      if (flags.EMERGENCY_STOP !== undefined) config.enabled.EMERGENCY_STOP = Boolean(flags.EMERGENCY_STOP);
    }

    if (rolloutStage) {
      config.metadata = config.metadata || {};
      config.metadata.rolloutStage = rolloutStage;
    }

    config.updatedBy = adminUserId;
    await config.save();

    await AdminAuditLog.create({
      adminUserId,
      action: 'UPDATE_FEATURE_FLAGS',
      targetType: 'FEATURE_FLAGS',
      targetId: config._id.toString(),
      changes: {
        previousFlags,
        newFlags: config.enabled,
        rolloutStage: config.metadata ? config.metadata.rolloutStage : null,
      },
      reason: reason || 'Admin updated feature flags',
      ipAddress: ipAddress || null,
    });

    return {
      success: true,
      flags: config.enabled,
      rolloutStage: config.metadata ? config.metadata.rolloutStage : null,
    };
  }
}

const featureFlagService = new FeatureFlagService();

module.exports = featureFlagService;
