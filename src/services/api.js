import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
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
    if (error.response && error.response.status === 401) {
      console.log('[API] 401 Unauthorized. Clearing token and redirecting to sign-in...');
      try {
        await AsyncStorage.removeItem('userToken');
        const { router } = require('expo-router');
        router.replace('/sign-in');
      } catch (e) {
        console.log('Error clearing session on 401:', e.message);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
