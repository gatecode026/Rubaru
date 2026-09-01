/**
 * useSocket.js — React hook for listening to socket events.
 *
 * Usage:
 *   useSocket('receive_message', (data) => { ... });
 *
 * Automatically subscribes on mount and unsubscribes on unmount.
 * Returns the current socket instance so you can emit events.
 */

import { useEffect } from 'react';
import { getSocket } from '../services/socket';

/**
 * Subscribe to a Socket.io event for the lifetime of the component.
 * @param {string} event - The socket event name to listen for.
 * @param {function} handler - Callback to invoke when the event fires.
 */
export function useSocketEvent(event, handler) {
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !event) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}

/**
 * Get the raw socket instance. Useful for emitting events imperatively.
 */
export function useSocket() {
  return getSocket();
}
