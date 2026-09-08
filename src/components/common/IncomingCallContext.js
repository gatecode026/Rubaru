import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import IncomingCallBanner from './IncomingCallBanner';
import { connectSocket, getSocket } from '../../services/socket';
import { useCallStore } from '../../store/callStore';
import callPushClientService from '../../services/callPushClientService';
import paidCommunicationClient from '../../services/paidCommunicationService';

const IncomingCallContext = createContext();

export function IncomingCallProvider({ children }) {
  const router = useRouter();
  const coldStartHandledRef = useRef(false);

  const callStore = useCallStore();
  const {
    callId,
    callStatus,
    callType,
    peerId,
    peerName,
    peerAvatar,
    ratePerMinute,
    acceptIncomingCall,
    rejectIncomingCall,
  } = callStore;

  // Cold-Start & Runtime Deep Link Action Handling (R4-C6)
  useEffect(() => {
    callPushClientService.initialize();

    async function handleInitialUrl() {
      if (coldStartHandledRef.current) return;
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('rubaru://call')) {
          coldStartHandledRef.current = true;
          await callPushClientService.parseAndHandleCallDeepLink(initialUrl, router);
        }
      } catch (e) {
        console.warn('[COLD START] Deep link error:', e.message);
      }
    }

    handleInitialUrl();

    // Listen for runtime incoming deep links (when backgrounded)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url && url.includes('rubaru://call')) {
        callPushClientService.parseAndHandleCallDeepLink(url, router);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  // Connect socket and listen to canonical calling events
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
        console.log('[SOCKET] Registering canonical call:incoming & paid_session.requested listeners');

        // Canonical call:incoming
        socket.on('call:incoming', (data) => {
          console.log('[SOCKET] Canonical call:incoming received:', data);
          callStore.handleIncomingCall(data);
        });

        // Legacy / Paid Session Request
        socket.on('paid_session.requested', (data) => {
          console.log('[SOCKET] paid_session.requested received:', data);
          const commType = data.communicationType || 'AUDIO';
          callStore.handleIncomingCall({
            callId: data.sessionId,
            sessionId: data.sessionId,
            callerId: data.initiatorId,
            callerName: data.initiatorName || 'Rubaru User',
            callerAvatar: data.initiatorAvatar || '',
            callType: commType === 'VIDEO' ? 'video' : 'audio',
            communicationType: commType,
            ratePerMinute: data.ratePerMinute || (commType === 'VIDEO' ? 10 : 5),
          });
        });

        socket.on('call:cancelled', (data) => {
          console.log('[SOCKET] Call cancelled by caller or answered elsewhere:', data);
          callStore.handleCallEnded(data);
        });

        socket.on('call:ended', (data) => {
          console.log('[SOCKET] Call ended event received:', data);
          callStore.handleCallEnded(data);
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleAccept = useCallback(async () => {
    if (callStatus !== 'INCOMING') return;

    const result = await acceptIncomingCall();
    if (result && result.success) {
      router.push({
        pathname: '/active-call',
        params: {
          contactName: peerName,
          avatarUri: peerAvatar,
          callType: callType,
          receiverId: peerId,
          callSessionId: callId,
          isPaid: 'true',
          isInitiator: 'false',
          ratePerMinute: String(ratePerMinute),
          initialStatus: 'connected',
        },
      });
    }
  }, [callStatus, acceptIncomingCall, peerName, peerAvatar, callType, peerId, callId, ratePerMinute, router]);

  const handleDecline = useCallback(async () => {
    if (callStatus !== 'INCOMING') return;
    await rejectIncomingCall('DECLINED_BY_RECEIVER');
  }, [callStatus, rejectIncomingCall]);

  return (
    <IncomingCallContext.Provider value={{}}>
      {children}
      <IncomingCallBanner
        visible={callStatus === 'INCOMING'}
        contactName={peerName || 'Rubaru User'}
        avatarUri={peerAvatar || ''}
        callType={callType || 'voice'}
        communicationType={callType === 'video' ? 'VIDEO' : 'AUDIO'}
        ratePerMinute={ratePerMinute || 5}
        isPaid={true}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  const context = useContext(IncomingCallContext);
  return context || {};
}
