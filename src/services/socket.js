/**
 * socket.js — Singleton Socket.io client connection
 *
 * Usage:
 *   import { getSocket, connectSocket, disconnectSocket } from './socket';
 *
 * Call connectSocket(token) once after login (in _layout.js / auth flow).
 * Call disconnectSocket() on logout.
 * Call getSocket() anywhere to get the active socket instance.
 */

import { io } from 'socket.io-client';
import Constants from 'expo-constants';

const getSocketUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace('/api', '');
  }
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }
  return 'http://192.168.1.33:5000';
};

const SOCKET_URL = getSocketUrl();

let socket = null;

/**
 * Connect to the Socket.io server with the user's JWT token.
 * Safe to call multiple times — only connects once.
 */
export function connectSocket(token) {
  if (socket && socket.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 5000,
  });

  socket.on('connect', () => {
    console.log('[SOCKET] Connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.log('[SOCKET] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[SOCKET] Disconnected:', reason);
  });

  return socket;
}

/**
 * Get the current socket instance (may be null if not yet connected).
 */
export function getSocket() {
  return socket;
}

/**
 * Disconnect and clean up the socket connection (call on logout).
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
