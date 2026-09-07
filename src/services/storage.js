import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'userToken';
const USER_KEY = 'userData';
const AUTH_STATUS_KEY = 'authStatus';

/**
 * Storage wrapper that provides persistent session management.
 * Persists token and user data across app restarts, backgrounding,
 * and system reloads.
 */
export const storage = {
  /**
   * Save auth token
   */
  async setToken(token) {
    if (!token) return;
    try {
      await AsyncStorage.setItem(TOKEN_KEY, String(token));
    } catch (err) {
      console.warn('[STORAGE] Failed to save token:', err);
    }
  },

  /**
   * Get stored auth token
   */
  async getToken() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      return token || null;
    } catch (err) {
      console.warn('[STORAGE] Failed to get token:', err);
      return null;
    }
  },

  /**
   * Save user session data
   */
  async setUser(user) {
    if (!user) return;
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('[STORAGE] Failed to save user data:', err);
    }
  },

  /**
   * Get cached user session data
   */
  async getUser() {
    try {
      const data = await AsyncStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.warn('[STORAGE] Failed to get user data:', err);
      return null;
    }
  },

  /**
   * Set authentication status string
   */
  async setAuthStatus(status) {
    try {
      await AsyncStorage.setItem(AUTH_STATUS_KEY, status);
    } catch (err) {
      console.warn('[STORAGE] Failed to set auth status:', err);
    }
  },

  /**
   * Get authentication status
   */
  async getAuthStatus() {
    try {
      return await AsyncStorage.getItem(AUTH_STATUS_KEY);
    } catch (err) {
      return null;
    }
  },

  /**
   * Save full authenticated session at once
   */
  async saveSession(token, user = null) {
    try {
      if (token) {
        await AsyncStorage.setItem(TOKEN_KEY, String(token));
      }
      if (user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      await AsyncStorage.setItem(AUTH_STATUS_KEY, 'AUTHENTICATED');
    } catch (err) {
      console.warn('[STORAGE] Error saving session:', err);
    }
  },

  /**
   * Clear auth session completely (explicit user logout)
   */
  async clearSession() {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, AUTH_STATUS_KEY]);
    } catch (err) {
      console.warn('[STORAGE] Failed to clear session:', err);
    }
  },
};

export default storage;
