import api from './api';

/**
 * Rubaru Dating Service - Connects React Native frontend to Research 1 Dating Core APIs
 */
export const datingService = {
  // 1. Preferences
  getPreferences: async () => {
    const res = await api.get('/v1/dating/preferences');
    return res.data;
  },

  updatePreferences: async (preferencesData) => {
    const res = await api.patch('/v1/dating/preferences', preferencesData);
    return res.data;
  },

  // 2. Protected Location
  updateLocation: async (coordinates, accuracy = null) => {
    const res = await api.put('/v1/dating/location', {
      coordinates,
      accuracy,
    });
    return res.data;
  },

  // 3. Discovery Candidates
  getDiscoveryCandidates: async ({ cursor, limit = 10, targetIntent } = {}) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());
    if (targetIntent) params.append('targetIntent', targetIntent);

    const res = await api.get(`/v1/discovery/candidates?${params.toString()}`);
    return res.data;
  },

  // 4. Impressions
  trackImpressions: async (batchId, impressions) => {
    const res = await api.post('/v1/discovery/impressions', {
      batchId,
      impressions,
    });
    return res.data;
  },

  // 5. Pass & Undo
  passCandidate: async (recommendationId, { idempotencyKey } = {}) => {
    const res = await api.post('/v1/discovery/pass', {
      recommendationId,
      idempotencyKey,
    });
    return res.data;
  },

  undoPass: async ({ idempotencyKey } = {}) => {
    const res = await api.post('/v1/discovery/undo', {
      idempotencyKey,
    });
    return res.data;
  },

  // 6. Outgoing Likes & Roses
  sendLike: async ({ recommendationId, type = 'LIKE', comment = '', targetElement, idempotencyKey }) => {
    const res = await api.post('/v1/likes', {
      recommendationId,
      type,
      comment,
      targetElement,
      idempotencyKey,
    });
    return res.data;
  },

  // 7. Incoming Likes
  getIncomingLikes: async ({ cursor, limit = 10, sort = 'PRIORITY' } = {}) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());
    if (sort) params.append('sort', sort);

    const res = await api.get(`/v1/likes/incoming?${params.toString()}`);
    return res.data;
  },

  declineLike: async (likeId, { idempotencyKey } = {}) => {
    const res = await api.post(`/v1/likes/${likeId}/decline`, {
      idempotencyKey,
    });
    return res.data;
  },

  acceptLike: async (likeId, { idempotencyKey } = {}) => {
    const res = await api.post(`/v1/likes/${likeId}/accept`, {
      idempotencyKey,
    });
    return res.data;
  },

  // 8. Matches
  getMatches: async ({ cursor, limit = 10, status = 'ACTIVE' } = {}) => {
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());
    if (status) params.append('status', status);

    const res = await api.get(`/v1/matches?${params.toString()}`);
    return res.data;
  },

  getMatchDetails: async (matchId) => {
    const res = await api.get(`/v1/matches/${matchId}`);
    return res.data;
  },

  // 9. Safety & Lifecycle
  unmatch: async (matchId, { reason, details } = {}) => {
    const res = await api.post(`/v1/matches/${matchId}/unmatch`, {
      reason,
      details,
    });
    return res.data;
  },

  blockUser: async (userId, { reason } = {}) => {
    const res = await api.post(`/v1/users/${userId}/block`, {
      reason,
    });
    return res.data;
  },

  unblockUser: async (userId) => {
    const res = await api.delete(`/v1/users/${userId}/block`);
    return res.data;
  },

  reportUser: async (userId, { category, description, evidenceUrls, alsoBlock = false } = {}) => {
    const res = await api.post(`/v1/users/${userId}/report`, {
      category,
      description,
      evidenceUrls,
      alsoBlock,
    });
    return res.data;
  },
};

export default datingService;
