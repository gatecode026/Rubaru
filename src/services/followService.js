import api from './api';

/**
 * Rubaru Frontend Follow & Social Privacy Client
 */
export const followService = {
  /**
   * Follow a user or send a follow request
   */
  followUser: async (userId) => {
    const res = await api.post(`/v1/users/${userId}/follow`);
    return res.data;
  },

  /**
   * Unfollow a user or cancel an outgoing request
   */
  unfollowUser: async (userId) => {
    const res = await api.delete(`/v1/users/${userId}/follow`);
    return res.data;
  },

  /**
   * Get pending follow requests
   */
  getPendingRequests: async (params = {}) => {
    const res = await api.get('/v1/follow-requests', { params });
    return res.data;
  },

  /**
   * Accept a pending follow request
   */
  acceptRequest: async (requestId) => {
    const res = await api.post(`/v1/follow-requests/${requestId}/accept`);
    return res.data;
  },

  /**
   * Decline a pending follow request
   */
  declineRequest: async (requestId) => {
    const res = await api.post(`/v1/follow-requests/${requestId}/decline`);
    return res.data;
  },

  /**
   * Remove an existing follower from your account
   */
  removeFollower: async (userId) => {
    const res = await api.delete(`/v1/users/${userId}/followers`);
    return res.data;
  },

  /**
   * Get followers list of a user
   */
  getFollowers: async (userId, params = {}) => {
    const res = await api.get(`/v1/users/${userId}/followers`, { params });
    return res.data;
  },

  /**
   * Get following list of a user
   */
  getFollowing: async (userId, params = {}) => {
    const res = await api.get(`/v1/users/${userId}/following`, { params });
    return res.data;
  },

  /**
   * Get viewer's relationship status with a target user
   */
  getFollowStatus: async (userId) => {
    const res = await api.get(`/v1/users/${userId}/follow-status`);
    return res.data;
  },

  /**
   * Update social account visibility (PUBLIC / PRIVATE)
   */
  updateSocialPrivacy: async (socialAccountVisibility) => {
    const res = await api.patch('/v1/users/me/social-privacy', {
      socialAccountVisibility,
    });
    return res.data;
  },
};

export default followService;
