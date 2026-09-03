import api from './api';

/**
 * Rubaru Reels & Short-Form Video Playback API Client
 */
export const reelService = {
  /**
   * Create a new Reel
   * @param {Object} payload - { videoMediaAssetId, coverMediaAssetId, caption, audience, idempotencyKey }
   */
  createReel: async (payload) => {
    if (
      payload.videoUri &&
      (payload.videoUri.startsWith('file://') || payload.videoUri.startsWith('content://'))
    ) {
      const formData = new FormData();
      const localUri = payload.videoUri;
      const filename = localUri.split('/').pop() || `reel_${Date.now()}.mp4`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : 'mp4';
      const type = ext === 'mov' ? 'video/quicktime' : 'video/mp4';

      formData.append('video', {
        uri: localUri,
        name: filename,
        type,
      });

      if (payload.caption) formData.append('caption', payload.caption);
      if (payload.durationMs) formData.append('durationMs', String(payload.durationMs));
      if (payload.audience) formData.append('audience', payload.audience);

      const res = await api.post('/v1/reels', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data;
    }

    const res = await api.post('/v1/reels', payload);
    return res.data;
  },

  /**
   * Get single Reel by ID
   * @param {string} reelId
   */
  getReelById: async (reelId) => {
    const res = await api.get(`/v1/reels/${reelId}`);
    return res.data;
  },

  /**
   * Get connected chronological Reels feed
   * @param {Object} params - { cursor, limit }
   */
  getConnectedReelsFeed: async (params = {}) => {
    const res = await api.get('/v1/reels/feed', { params });
    return res.data;
  },

  /**
   * Alias for getConnectedReelsFeed
   */
  getReelFeed: async (params = {}) => {
    const res = await api.get('/v1/reels/feed', { params });
    return res.data;
  },

  /**
   * Get user reels
   * @param {string} userId
   * @param {Object} params - { cursor, limit }
   */
  getUserReels: async (userId, params = {}) => {
    const res = await api.get(`/v1/users/${userId}/reels`, { params });
    return res.data;
  },

  /**
   * Ingest batched playback events
   * @param {Object} payload - { batchId, events: [...] }
   */
  recordPlaybackEvents: async (payload) => {
    const res = await api.post('/v1/reels/playback-events', payload);
    return res.data;
  },

  /**
   * Alias for single reel playback event
   */
  recordPlayback: async (reelId, payload = {}) => {
    if (!reelId) return null;
    const event = {
      reelId,
      watchDurationMs: payload.watchDurationMs || 0,
      completed: !!payload.completed,
      timestamp: new Date().toISOString(),
    };
    const res = await api.post('/v1/reels/playback-events', {
      batchId: `batch_${Date.now()}`,
      events: [event],
    });
    return res.data;
  },

  /**
   * Delete Reel (author only)
   * @param {string} reelId
   */
  deleteReel: async (reelId) => {
    const res = await api.delete(`/v1/reels/${reelId}`);
    return res.data;
  },

  /**
   * Archive Reel (author only)
   * @param {string} reelId
   */
  archiveReel: async (reelId) => {
    const res = await api.post(`/v1/reels/${reelId}/archive`);
    return res.data;
  },

  /**
   * Unarchive Reel (author only)
   * @param {string} reelId
   */
  unarchiveReel: async (reelId) => {
    const res = await api.post(`/v1/reels/${reelId}/unarchive`);
    return res.data;
  },
};

export default reelService;
