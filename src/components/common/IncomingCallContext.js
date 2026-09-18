import React, { createContext, useContext, useEffect, useCallback, useRef } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import IncomingCallBanner from './IncomingCallBanner';
import MiniCallOverlay from './MiniCallOverlay';
import { connectSocket, getSocket } from '../../services/socket';
import { useCallStore } from '../../store/callStore';
import { useCallController } from '../../hooks/useCallController';
import callPushClientService from '../../services/callPushClientService';
import paidCommunicationClient from '../../services/paidCommunicationService';

const IncomingCallContext = createContext();

export function IncomingCallProvider({ children }) {
  const router = useRouter();
  const coldStartHandledRef = useRef(false);

  // Registers all WebRTC signaling listeners (call:accepted, call:signal:offer/answer/ice,
  // call:connected, etc.) at app-root mount time so they are live BEFORE any call is
  // accepted. These must not be registered lazily inside ActiveCallScreen: the caller can
  // emit its offer within milliseconds of the receiver's call:accept ack (media is already
  // captured by then), which can race ahead of the receiver navigating to and mounting
  // ActiveCallScreen, silently dropping the offer with no retry.
  useCallController();

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

  // Cold-Start & Runtime Deep Link Action Handling (R4-C6 / R4-C15)
  useEffect(() => {
    callPushClientService.initialize().then(() => {
      callPushClientService.requestNotificationPermissions().catch(() => {});
    });

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
    let activeSocket = null;
    let registeredHandlers = null;

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
        activeSocket = socket;
        console.log('[SOCKET] Registering canonical call:incoming & paid_session.requested listeners');

        const handleEndOrCancel = (data) => {
          const commType = (data?.communicationType || data?.callType || '').toUpperCase();
          if (commType === 'MESSAGE') {
            return;
          }
          console.log('[SOCKET] Incoming call ended/cancelled event received:', data);
          callPushClientService.processCallCancellationPush(data);
          useCallStore.getState().handleCallEnded(data);
        };

        const handleIncoming = (data) => {
          const commType = (data?.communicationType || data?.callType || '').toUpperCase();
          if (commType === 'MESSAGE') return;
          console.log('[SOCKET] Incoming call received:', data);
          const cid = data.sessionId || data.callId;
          if (cid) {
            callPushClientService.markCallProcessed(cid);
          }
          useCallStore.getState().handleIncomingCall(data);
        };

        const handlePaidRequested = (data) => {
          console.log('[SOCKET] paid_session.requested received:', data);
          const commType = (data.communicationType || 'AUDIO').toUpperCase();
          if (commType === 'MESSAGE') {
            console.log('[SOCKET] paid_session.requested is MESSAGE type - not a voice/video call, ignoring in IncomingCallContext');
            return;
          }
          const cid = data.sessionId || data.callId;
          if (cid) {
            callPushClientService.markCallProcessed(cid);
          }
          useCallStore.getState().handleIncomingCall({
            callId: data.sessionId || data.callId,
            sessionId: data.sessionId || data.callId,
            callerId: data.initiatorId || data.callerId,
            callerName: data.caller?.displayName || data.initiatorName || data.callerName || 'Rubaru User',
            callerAvatar: data.caller?.avatarUrl || data.initiatorAvatar || data.callerAvatar || '',
            callType: commType === 'VIDEO' ? 'video' : 'audio',
            communicationType: commType,
            ratePerMinute: data.ratePerMinute || (commType === 'VIDEO' ? 10 : 5),
          });
        };

        const handleDismissed = (data) => {
          console.log('[SOCKET] Call dismissed event:', data);
          useCallStore.getState().handleDismissed(data);
        };

        const handleSync = (data) => {
          console.log('[SOCKET] Call sync event:', data);
          useCallStore.getState().handleSync(data);
        };

        const handleConnect = () => {
          console.log('[SOCKET] Socket connected, syncing calling state with server');
          const currentStore = useCallStore.getState();
          if (currentStore.callStatus === 'RECONNECTING' || currentStore.callStatus === 'ACTIVE') {
            currentStore.reconnectCall();
          }
          currentStore.syncWithServer();
        };

        registeredHandlers = [
          { event: 'connect', handler: handleConnect },
          { event: 'call:incoming', handler: handleIncoming },
          { event: 'incoming_call', handler: handleIncoming },
          { event: 'paid_session.requested', handler: handlePaidRequested },
          { event: 'call:cancelled', handler: handleEndOrCancel },
          { event: 'call.cancelled', handler: handleEndOrCancel },
          { event: 'call:ended', handler: handleEndOrCancel },
          { event: 'call.ended', handler: handleEndOrCancel },
          { event: 'call_hungup', handler: handleEndOrCancel },
          { event: 'call:rejected', handler: handleEndOrCancel },
          { event: 'call_declined', handler: handleEndOrCancel },
          { event: 'call:dismissed', handler: handleDismissed },
          { event: 'call:sync', handler: handleSync },
          { event: 'paid_session.ended', handler: handleEndOrCancel },
          { event: 'paid_session.cancelled', handler: handleEndOrCancel },
          { event: 'paid_session.declined', handler: handleEndOrCancel },
        ];

        registeredHandlers.forEach(({ event, handler }) => {
          socket.on(event, handler);
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      if (activeSocket && registeredHandlers) {
        registeredHandlers.forEach(({ event, handler }) => {
          try {
            activeSocket.off(event, handler);
          } catch (e) {}
        });
        activeSocket._incomingCallRegistered = false;
      }
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
      <MiniCallOverlay />
    </IncomingCallContext.Provider>
  );
}

export function useIncomingCall() {
  const context = useContext(IncomingCallContext);
  return context || {};
}
