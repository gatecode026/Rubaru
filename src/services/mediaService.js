import api from './api';

/**
 * Rubaru Frontend Media Service Client
 * Handles authenticated upload session creation, direct upload, finalization, status polling, and deletion.
 */
export const mediaService = {
  /**
   * Create an upload session
   */
  createUploadSession: async (sessionPayload) => {
    const res = await api.post('/v1/media/upload-sessions', sessionPayload);
    return res.data;
  },

  /**
   * Upload binary data directly to the authorized upload target
   */
  uploadDirect: async (uploadUrl, binaryBufferOrBlob, mimeType, onProgress) => {
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.70:5000/api';
    const host = apiBase.replace('/api', '');
    const fullUrl = uploadUrl.startsWith('http') ? uploadUrl : `${host}${uploadUrl}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', fullUrl);
      xhr.setRequestHeader('Content-Type', mimeType);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : { success: true });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error occurred during media upload'));
      xhr.ontimeout = () => reject(new Error('Media upload timed out'));

      xhr.send(binaryBufferOrBlob);
    });
  },

  /**
   * Finalize and independently verify an uploaded session
   */
  finalizeUploadSession: async (sessionId, payload = {}) => {
    const res = await api.post(`/v1/media/upload-sessions/${sessionId}/finalize`, payload);
    return res.data;
  },

  /**
   * Get media processing status
   */
  getMediaStatus: async (mediaId) => {
    const res = await api.get(`/v1/media/${mediaId}/status`);
    return res.data;
  },

  /**
   * Delete an unbound media asset
   */
  deleteMedia: async (mediaId) => {
    const res = await api.delete(`/v1/media/${mediaId}`);
    return res.data;
  },
};

export default mediaService;
