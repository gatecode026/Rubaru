import api from './api';

/**
 * React Native Social Notifications & Device Service
 */
class NotificationClientService {
  /**
   * Fetch paginated user notifications
   */
  async getNotifications(options = {}) {
    const { cursor, limit = 20, category, type } = options;
    const params = {};
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;
    if (category) params.category = category;
    if (type) params.type = type;

    const res = await api.get('/v1/notifications', { params });
    return res.data;
  }

  /**
   * Mark individual notification as read
   */
  async markAsRead(notificationId) {
    const res = await api.patch(`/v1/notifications/${notificationId}/read`);
    return res.data;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const res = await api.patch('/v1/notifications/read-all');
    return res.data;
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount() {
    const res = await api.get('/v1/notifications/unread-count');
    return res.data;
  }

  /**
   * Get user notification preferences
   */
  async getPreferences() {
    const res = await api.get('/v1/users/me/notification-preferences');
    return res.data;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(preferencesPatch) {
    const res = await api.patch('/v1/users/me/notification-preferences', preferencesPatch);
    return res.data;
  }

  /**
   * Register push device token
   */
  async registerDevice(deviceData) {
    const res = await api.post('/v1/devices', deviceData);
    return res.data;
  }

  /**
   * Revoke device token on logout
   */
  async deleteDevice(deviceId) {
    const res = await api.delete(`/v1/devices/${deviceId}`);
    return res.data;
  }
}

export default new NotificationClientService();
