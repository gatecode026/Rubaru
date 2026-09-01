import api from './api';

/**
 * Rubaru Frontend Social Interaction Service Client
 */
export const interactionService = {
  /**
   * Like a post
   */
  likeContent: async (contentId) => {
    const res = await api.post(`/v1/content/${contentId}/like`);
    return res.data;
  },

  /**
   * Unlike a post
   */
  unlikeContent: async (contentId) => {
    const res = await api.delete(`/v1/content/${contentId}/like`);
    return res.data;
  },

  /**
   * Create a comment or 1-level reply
   */
  createComment: async (contentId, commentPayload) => {
    const res = await api.post(`/v1/content/${contentId}/comments`, commentPayload);
    return res.data;
  },

  /**
   * Get comments for a post
   */
  getComments: async (contentId, params = {}) => {
    const res = await api.get(`/v1/content/${contentId}/comments`, { params });
    return res.data;
  },

  /**
   * Get replies for a comment
   */
  getCommentReplies: async (commentId, params = {}) => {
    const res = await api.get(`/v1/comments/${commentId}/replies`, { params });
    return res.data;
  },

  /**
   * Delete a comment
   */
  deleteComment: async (commentId) => {
    const res = await api.delete(`/v1/comments/${commentId}`);
    return res.data;
  },

  /**
   * Like a comment
   */
  likeComment: async (commentId) => {
    const res = await api.post(`/v1/comments/${commentId}/like`);
    return res.data;
  },

  /**
   * Unlike a comment
   */
  unlikeComment: async (commentId) => {
    const res = await api.delete(`/v1/comments/${commentId}/like`);
    return res.data;
  },

  /**
   * Save a post privately
   */
  saveContent: async (contentId) => {
    const res = await api.post(`/v1/content/${contentId}/save`);
    return res.data;
  },

  /**
   * Unsave a post
   */
  unsaveContent: async (contentId) => {
    const res = await api.delete(`/v1/content/${contentId}/save`);
    return res.data;
  },

  /**
   * Get user's private saved content list
   */
  getSavedContent: async (params = {}) => {
    const res = await api.get('/v1/users/me/saved-content', { params });
    return res.data;
  },

  /**
   * Record a share event
   */
  recordShare: async (contentId, sharePayload) => {
    const res = await api.post(`/v1/content/${contentId}/share`, sharePayload);
    return res.data;
  },

  /**
   * Mark content not interested
   */
  markNotInterested: async (contentId) => {
    const res = await api.post(`/v1/content/${contentId}/not-interested`);
    return res.data;
  },

  /**
   * Unmark not interested
   */
  unmarkNotInterested: async (contentId) => {
    const res = await api.delete(`/v1/content/${contentId}/not-interested`);
    return res.data;
  },
};

export default interactionService;
