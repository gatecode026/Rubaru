import api from './api';

/**
 * Rubaru Stories & Ephemeral Content API Client
 */
export const storyService = {
  /**
   * Create a new story
   * @param {Object} payload - { mediaAssetId, caption, audience, idempotencyKey }
   */
  createStory: async (payload) => {
    const res = await api.post('/v1/stories', payload);
    return res.data;
  },

  /**
   * Get story tray for home feed
   */
  getStoryTray: async () => {
    const res = await api.get('/v1/stories/feed');
    return res.data;
  },

  /**
   * Get single story by ID
   * @param {string} storyId
   */
  getStoryById: async (storyId) => {
    const res = await api.get(`/v1/stories/${storyId}`);
    return res.data;
  },

  /**
   * Get story sequence for target user
   * @param {string} userId
   */
  getUserStories: async (userId) => {
    const res = await api.get(`/v1/users/${userId}/stories`);
    return res.data;
  },

  /**
   * Record a qualified story view
   * @param {string} storyId
   * @param {Object} payload - { eventId, viewedAt }
   */
  recordStoryView: async (storyId, payload = {}) => {
    const res = await api.post(`/v1/stories/${storyId}/view`, payload);
    return res.data;
  },

  /**
   * Get viewers list for story (owner only)
   * @param {string} storyId
   * @param {Object} params - { limit }
   */
  getStoryViewers: async (storyId, params = {}) => {
    const res = await api.get(`/v1/stories/${storyId}/viewers`, { params });
    return res.data;
  },

  /**
   * Delete a story (owner only)
   * @param {string} storyId
   */
  deleteStory: async (storyId) => {
    const res = await api.delete(`/v1/stories/${storyId}`);
    return res.data;
  },
};

export default storyService;
