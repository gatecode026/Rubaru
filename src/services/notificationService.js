import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * React Native Social Notifications & Device Service
 */
class NotificationClientService {
  async _getAuthHeaders() {
    const token = await AsyncStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  }

  /**
   * Fetch paginated user notifications
   */
  async getNotifications(options = {}) {
    const { cursor, limit = 20, category, type } = options;
    const params = new URLSearchParams();
    if (cursor) params.append('cursor', cursor);
    if (limit) params.append('limit', limit.toString());
    if (category) params.append('category', category);
    if (type) params.append('type', type);

    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/notifications?${params.toString()}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch notifications');
    }
    return data;
  }

  /**
   * Mark individual notification as read
   */
  async markAsRead(notificationId) {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to mark notification as read');
    }
    return data;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/notifications/read-all`, {
      method: 'PATCH',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to mark all as read');
    }
    return data;
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount() {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/notifications/unread-count`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to get unread count');
    }
    return data;
  }

  /**
   * Get user notification preferences
   */
  async getPreferences() {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/users/me/notification-preferences`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to get notification preferences');
    }
    return data;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(preferencesPatch) {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/users/me/notification-preferences`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(preferencesPatch),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update notification preferences');
    }
    return data;
  }

  /**
   * Register push device token
   */
  async registerDevice(deviceData) {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/devices`, {
      method: 'POST',
      headers,
      body: JSON.stringify(deviceData),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to register device');
    }
    return data;
  }

  /**
   * Revoke device token on logout
   */
  async deleteDevice(deviceId) {
    const headers = await this._getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/v1/devices/${deviceId}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to revoke device token');
    }
    return data;
  }
}

export default new NotificationClientService();
