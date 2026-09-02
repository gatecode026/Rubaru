import api from './api';

/**
 * Rubaru Frontend Post & Content Service Client
 */
export const postService = {
  /**
   * Create an image/video post or carousel
   */
  createPost: async (postPayload) => {
    const res = await api.post('/v1/posts', postPayload);
    return res.data;
  },

  /**
   * Get single post by ID
   */
  getPost: async (postId) => {
    const res = await api.get(`/v1/posts/${postId}`);
    return res.data;
  },

  /**
   * Get a user's posts
   */
  getUserPosts: async (userId, params = {}) => {
    const res = await api.get(`/v1/users/${userId}/posts`, { params });
    return res.data;
  },

  /**
   * Edit post caption/details
   */
  editPost: async (postId, updates) => {
    const res = await api.patch(`/v1/posts/${postId}`, updates);
    return res.data;
  },

  /**
   * Archive a post
   */
  archivePost: async (postId) => {
    const res = await api.post(`/v1/posts/${postId}/archive`);
    return res.data;
  },

  /**
   * Unarchive a post
   */
  unarchivePost: async (postId) => {
    const res = await api.post(`/v1/posts/${postId}/unarchive`);
    return res.data;
  },

  /**
   * Delete a post
   */
  deletePost: async (postId) => {
    const res = await api.delete(`/v1/posts/${postId}`);
    return res.data;
  },
};

export default postService;
