/**
 * Automated Moderation Provider Adapter Interface
 * Provides vendor-neutral abstraction for AI / automated safety classifiers.
 */

class ModerationProviderAdapter {
  constructor() {
    this.providerName = process.env.MODERATION_PROVIDER || 'TEST_ADAPTER';
  }

  /**
   * Analyze text content
   * @param {string} text
   * @returns {Promise<Object>}
   */
  async analyzeText(text) {
    if (!text || typeof text !== 'string') {
      return {
        provider: this.providerName,
        recommendedAction: 'NO_ACTION',
        categoryScores: {},
        assessedAt: new Date(),
      };
    }

    const lower = text.toLowerCase();
    const highRiskTerms = ['kill', 'suicide', 'bomb', 'terror', 'child porn', 'abuse'];
    const isHighRisk = highRiskTerms.some((term) => lower.includes(term));

    return {
      provider: this.providerName,
      providerRequestId: `req_txt_${Date.now()}`,
      recommendedAction: isHighRisk ? 'FLAG_CRITICAL' : 'APPROVE',
      categoryScores: {
        toxicity: isHighRisk ? 0.95 : 0.05,
        violence: isHighRisk ? 0.9 : 0.01,
        selfHarm: lower.includes('suicide') ? 0.99 : 0.0,
      },
      assessedAt: new Date(),
    };
  }

  /**
   * Analyze image media item
   * @param {Object} mediaItem
   * @returns {Promise<Object>}
   */
  async analyzeImage(mediaItem) {
    return {
      provider: this.providerName,
      providerRequestId: `req_img_${Date.now()}`,
      recommendedAction: 'APPROVE',
      categoryScores: {
        adult: 0.02,
        racy: 0.05,
        violence: 0.01,
      },
      assessedAt: new Date(),
    };
  }

  /**
   * Analyze video media item
   * @param {Object} mediaItem
   * @returns {Promise<Object>}
   */
  async analyzeVideo(mediaItem) {
    return {
      provider: this.providerName,
      providerRequestId: `req_vid_${Date.now()}`,
      recommendedAction: 'APPROVE',
      categoryScores: {
        adult: 0.01,
        racy: 0.04,
        violence: 0.02,
      },
      assessedAt: new Date(),
    };
  }
}

const moderationProviderAdapter = new ModerationProviderAdapter();
module.exports = moderationProviderAdapter;
