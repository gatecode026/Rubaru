import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import IncomingCallBanner from './IncomingCallBanner';
import { connectSocket, getSocket } from '../../services/socket';

const IncomingCallContext = createContext();

export function IncomingCallProvider({ children }) {
  const router = useRouter();
  const [callData, setCallData] = useState(null);

  // Connect socket on boot if token exists, and run interval to register event listeners once connected
  useEffect(() => {
    async function initSocket() {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          connectSocket(token);
        }
      } catch (e) {
        console.log('[SOCKET] initSocket error:', e.message);
      }
    }
    initSocket();

    const interval = setInterval(() => {
      const socket = getSocket();
      if (socket && !socket._incomingCallRegistered) {
        socket._incomingCallRegistered = true;
        console.log('[SOCKET] Registering incoming_call listeners');

        socket.on('incoming_call', (data) => {
          console.log('[SOCKET] incoming_call received:', data);
          setCallData({
            contactName: data.callerName || 'Rubaru User',
            avatarUri: data.callerAvatar || '',
            callType: data.callType || 'voice',
            callerId: data.callerId,
            callSessionId: data.callSessionId,
          });
        });

        socket.on('call_hungup', () => {
          console.log('[SOCKET] Remote party hung up');
          setCallData(null)
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      const socket = getSocket();
      if (socket) {
        socket.off('incoming_call');
        socket.off('call_hungup');
        socket._incomingCallRegistered = false;
      }
    };
  }, []);

  // Manual trigger for demo / fallback purposes
  const triggerIncomingCall = useCallback((data = {}) => {
    setCallData({
      contactName: data.contactName || 'Rubaru User',
      avatarUri: data.avatarUri || '',
      callType: data.callType || 'voice',
      callerId: data.callerId || null,
      callSessionId: data.callSessionId || null,
    });
  }, []);

  const handleAccept = useCallback(() => {
    if (!callData) return;
    const { contactName, avatarUri, callType, callerId, callSessionId } = callData;

    // Notify the caller that we accepted
    const socket = getSocket();
    if (socket && callerId) {
      socket.emit('call_accepted', { callerId, callSessionId });
    }

    setCallData(null);
    router.push({
      pathname: '/active-call',
      params: {
        contactName,
        avatarUri,
        callType,
        receiverId: callerId,
        callSessionId,
        initialStatus: 'connected',
      },
    });
  }, [callData, router]);

  const handleDecline = useCallback(() => {
    if (!callData) return;
    const { callerId, callSessionId } = callData;

    // Notify the caller that we declined
    const socket = getSocket();
    if (socket && callerId) {
      socket.emit('call_rejected', { callerId, callSessionId });
    }

    setCallData(null);
  }, [callData]);

  return (
    <IncomingCallContext.Provider value={{ triggerIncomingCall }}>
      {children}
      <IncomingCallBanner
        visible={!!callData}
        contactName={callData?.contactName || ''}
        avatarUri={callData?.avatarUri || ''}
        callType={callData?.callType || 'voice'}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  const context = useContext(IncomingCallContext);
  if (!context) {
    return { triggerIncomingCall: () => {} };
  }
  return context;
}
