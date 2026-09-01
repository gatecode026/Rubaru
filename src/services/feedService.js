import api from './api';

/**
 * Rubaru Connected Social Home Feed API Client
 */
export const feedService = {
  /**
   * Retrieve connected home feed page
   * @param {Object} params - { cursor, limit }
   */
  getConnectedFeed: async (params = {}) => {
    const res = await api.get('/v1/feed', { params });
    return res.data;
  },

  /**
   * Submit batched impressions
   * @param {Object} payload - { batchId, events: [...] }
   */
  recordImpressions: async (payload) => {
    const res = await api.post('/v1/feed/impressions', payload);
    return res.data;
  },
};

export default feedService;
