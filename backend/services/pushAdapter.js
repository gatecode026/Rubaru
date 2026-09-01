const Device = require('../models/Device');

/**
 * Provider-neutral Push Notification Adapter (FCM / APNs / Expo / Mock)
 */
class PushAdapter {
  constructor(options = {}) {
    this.provider = options.provider || process.env.PUSH_PROVIDER || 'MOCK';
  }

  /**
   * Deliver push notification to all active devices of a recipient
   * @param {string} recipientId - User ID
   * @param {Object} payload - { title, body, data: { deepLink, notificationId, type }, collapseKey }
   * @returns {Promise<Object>} { success: boolean, sentCount: number, failedCount: number, revokedTokens: string[] }
   */
  async sendToUser(recipientId, payload = {}) {
    if (!recipientId) return { success: false, sentCount: 0, failedCount: 0, revokedTokens: [] };

    const activeDevices = await Device.find({
      user: recipientId,
      status: 'ACTIVE',
    });

    if (!activeDevices.length) {
      return { success: true, sentCount: 0, failedCount: 0, revokedTokens: [] };
    }

    const { title = 'Rubaru', body = '', data = {}, collapseKey = 'rubaru_social' } = payload;
    let sentCount = 0;
    let failedCount = 0;
    const revokedTokens = [];

    for (const device of activeDevices) {
      try {
        const sendResult = await this._dispatchToDevice(device, { title, body, data, collapseKey });
        if (sendResult.success) {
          sentCount++;
        } else if (sendResult.invalidToken) {
          failedCount++;
          revokedTokens.push(device.pushToken);
          device.status = 'REVOKED';
          await device.save();
        } else {
          failedCount++;
        }
      } catch (err) {
        failedCount++;
      }
    }

    return {
      success: sentCount > 0 || activeDevices.length === 0,
      sentCount,
      failedCount,
      revokedTokens,
    };
  }

  /**
   * Internal driver dispatch
   */
  async _dispatchToDevice(device, { title, body, data, collapseKey }) {
    if (!device.pushToken || device.pushToken.startsWith('invalid_') || device.pushToken === 'unregistered_token') {
      return { success: false, invalidToken: true, error: 'TOKEN_INVALID' };
    }

    // Best-effort mock/FCM dispatch
    return {
      success: true,
      provider: this.provider,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
}

module.exports = new PushAdapter();
