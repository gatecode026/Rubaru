import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const FALLBACK_URLS = [
  process.env.EXPO_PUBLIC_API_URL,
  'http://192.168.1.104:5000/api',
  'http://127.0.0.1:5000/api',
  'http://10.0.2.2:5000/api',
].filter(Boolean);

let activeBaseUrlIndex = 0;
let currentBaseUrl = FALLBACK_URLS[0] || 'http://192.168.1.104:5000/api';

export const getBaseUrl = () => currentBaseUrl;

export const setBaseUrl = (newUrl) => {
  currentBaseUrl = newUrl;
  api.defaults.baseURL = newUrl;
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      if (config.baseURL && config.baseURL.includes('loca.lt')) {
        config.baseURL = getBaseUrl();
      }
      console.log(`[API REQUEST] ${config.method?.toUpperCase()} ${config.baseURL || ''}${config.url}`);
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (e) {
      console.error('Error fetching token from storage', e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      console.warn(`[API ERROR ${error.response.status}] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, error.response.data);
    } else {
      console.warn(`[API NETWORK ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url}:`, error.message);
      if (!error.config?._failoverRetried && activeBaseUrlIndex < FALLBACK_URLS.length - 1) {
        activeBaseUrlIndex++;
        currentBaseUrl = FALLBACK_URLS[activeBaseUrlIndex];
        console.log(`[API FAILOVER] Switching baseUrl to ${currentBaseUrl} and retrying...`);
        api.defaults.baseURL = currentBaseUrl;
        error.config.baseURL = currentBaseUrl;
        error.config._failoverRetried = true;
        return api(error.config);
      }
    }
    if (error.response && error.response.status === 401) {
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint =
        requestUrl.includes('/auth/login') ||
        requestUrl.includes('/auth/register') ||
        requestUrl.includes('/auth/verify') ||
        requestUrl.includes('/auth/verify-otp') ||
        requestUrl.includes('/auth/me');
      
      const errMsg = error.response?.data?.message || '';
      const isExplicitAuthFailure = errMsg.includes('token') || errMsg.includes('Not authorized') || errMsg.includes('jwt');

      if (!isAuthEndpoint && isExplicitAuthFailure) {
        console.log('[API] Explicit 401 Unauthorized. Clearing session and redirecting to sign-in...');
        try {
          const storage = require('./storage').default;
          await storage.clearSession();
          const { router } = require('expo-router');
          router.replace('/sign-in');
        } catch (e) {
          console.log('Error clearing session on 401:', e.message);
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
