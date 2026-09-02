import api from './api';

/**
 * Rubaru Trust, Safety & Moderation Client
 */
export const safetyService = {
  /**
   * Block a user
   * @param {string} userId
   * @param {Object} payload
   */
  blockUser: async (userId, payload = {}) => {
    const res = await api.post(`/v1/users/${userId}/block`, payload);
    return res.data;
  },

  /**
   * Unblock a user
   * @param {string} userId
   */
  unblockUser: async (userId) => {
    const res = await api.delete(`/v1/users/${userId}/block`);
    return res.data;
  },

  /**
   * Report a user profile
   * @param {string} userId
   * @param {Object} payload - { reasonCode, description, blockUser }
   */
  reportUser: async (userId, payload = {}) => {
    const res = await api.post(`/v1/users/${userId}/report`, payload);
    return res.data;
  },

  /**
   * Report content (Post, Reel, Story)
   * @param {string} contentId
   * @param {Object} payload - { reasonCode, description, sourceSurface, originBatchId, blockAuthor }
   */
  reportContent: async (contentId, payload = {}) => {
    const res = await api.post(`/v1/content/${contentId}/report`, payload);
    return res.data;
  },

  /**
   * Report comment
   * @param {string} commentId
   * @param {Object} payload - { reasonCode, description, blockAuthor }
   */
  reportComment: async (commentId, payload = {}) => {
    const res = await api.post(`/v1/comments/${commentId}/report`, payload);
    return res.data;
  },
};

export default safetyService;
