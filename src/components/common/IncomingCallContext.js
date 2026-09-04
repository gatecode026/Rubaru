import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import IncomingCallBanner from './IncomingCallBanner';
import { connectSocket, getSocket } from '../../services/socket';
import paidCommunicationClient from '../../services/paidCommunicationService';

const IncomingCallContext = createContext();

export function IncomingCallProvider({ children }) {
  const router = useRouter();
  const [callData, setCallData] = useState(null);
  const coldStartHandledRef = useRef(false);

  // Cold-Start Push Deep Link & Action Restoration
  useEffect(() => {
    async function handleColdStartCallAction() {
      if (coldStartHandledRef.current) return;
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl && initialUrl.includes('rubaru://call/')) {
          coldStartHandledRef.current = true;
          const urlObj = new URL(initialUrl);
          const sessionId = urlObj.searchParams.get('sessionId') || initialUrl.split('rubaru://call/')[1]?.split('?')[0];
          const action = urlObj.searchParams.get('action') || 'ANSWER';

          if (sessionId) {
            const token = await AsyncStorage.getItem('userToken');
            if (token) {
              // Validate session from authoritative backend before navigating
              try {
                const session = await paidCommunicationClient.getSession(sessionId);
                if (session && (session.status === 'PENDING' || session.status === 'ACCEPTED')) {
                  if (action === 'ANSWER') {
                    await paidCommunicationClient.acceptSession(sessionId);
                    router.push({
                      pathname: '/active-call',
                      params: {
                        contactName: session.initiatorId?.displayName || 'Rubaru User',
                        avatarUri: session.initiatorId?.avatarUrl || '',
                        callType: session.communicationType === 'VIDEO' ? 'video' : 'voice',
                        receiverId: session.initiatorId?._id || session.initiatorId,
                        paidSessionId: sessionId,
                        isPaid: 'true',
                        isInitiator: 'false',
                        ratePerMinute: String(session.ratePerMinuteSnapshot || 5),
                        initialStatus: 'connected',
                      },
                    });
                  } else if (action === 'DECLINE') {
                    await paidCommunicationClient.declineSession(sessionId, 'DECLINED_FROM_NOTIFICATION');
                  }
                }
              } catch (sessErr) {
                console.warn('[COLD START] Session validation failed or expired:', sessErr.message);
              }
            }
          }
        }
      } catch (e) {
        console.log('[COLD START] Deep link parse info:', e.message);
      }
    }

    handleColdStartCallAction();
  }, [router]);

  // Connect socket on boot and register authoritative events
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
        console.log('[SOCKET] Registering incoming_call, paid_session.requested, and call.cancelled listeners');

        // Canonical Paid Communication Session Request Listener
        socket.on('paid_session.requested', (data) => {
          console.log('[SOCKET] paid_session.requested received:', data);
          const commType = data.communicationType || 'AUDIO';
          const rate = data.ratePerMinute || (commType === 'VIDEO' ? 10 : commType === 'MESSAGE' ? 1 : 5);
          setCallData({
            contactName: data.initiatorName || 'Rubaru User',
            avatarUri: data.initiatorAvatar || '',
            callType: commType === 'VIDEO' ? 'video' : (commType === 'MESSAGE' ? 'message' : 'voice'),
            communicationType: commType,
            ratePerMinute: rate,
            callerId: data.initiatorId,
            callSessionId: data.sessionId,
            paidSessionId: data.sessionId,
            isPaid: true,
          });
        });

        // Remote party hung up or cancelled (Multi-device ring cancellation)
        socket.on('call_hungup', () => {
          console.log('[SOCKET] Remote party hung up');
          setCallData(null);
        });

        socket.on('call.cancelled', () => {
          console.log('[SOCKET] Call cancelled by caller or answered on another device');
          setCallData(null);
        });

        socket.on('paid_session.ended', () => {
          console.log('[SOCKET] Paid session ended');
          setCallData(null);
        });

        socket.on('paid_session.declined', () => {
          console.log('[SOCKET] Paid session declined');
          setCallData(null);
        });
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      const socket = getSocket();
      if (socket) {
        socket.off('paid_session.requested');
        socket.off('call_hungup');
        socket.off('call.cancelled');
        socket.off('paid_session.ended');
        socket.off('paid_session.declined');
        socket._incomingCallRegistered = false;
      }
    };
  }, []);

  const handleAccept = useCallback(async () => {
    if (!callData) return;
    const { contactName, avatarUri, callType, callerId, callSessionId, isPaid, paidSessionId, communicationType, ratePerMinute } = callData;

    if (isPaid && paidSessionId) {
      try {
        await paidCommunicationClient.acceptSession(paidSessionId);
      } catch (err) {
        console.warn('[INCOMING CALL] Failed to accept paid session:', err.message);
      }
    }

    setCallData(null);

    if (communicationType === 'MESSAGE') {
      router.push({
        pathname: `/chat/${callerId}`,
        params: {
          id: callerId,
          name: contactName,
          avatarUrl: avatarUri,
          paidSessionId,
          isPaid: 'true',
          isInitiator: 'false',
        },
      });
    } else {
      router.push({
        pathname: '/active-call',
        params: {
          contactName,
          avatarUri,
          callType: callType || 'voice',
          receiverId: callerId,
          callSessionId,
          paidSessionId: paidSessionId || null,
          isPaid: isPaid ? 'true' : 'false',
          isInitiator: 'false',
          ratePerMinute: ratePerMinute ? String(ratePerMinute) : (callType === 'video' ? '10' : '5'),
          initialStatus: 'connected',
        },
      });
    }
  }, [callData, router]);

  const handleDecline = useCallback(async () => {
    if (!callData) return;
    const { callerId, callSessionId, isPaid, paidSessionId } = callData;

    if (isPaid && paidSessionId) {
      try {
        await paidCommunicationClient.declineSession(paidSessionId, 'DECLINED_BY_RECEIVER');
      } catch (err) {
        console.warn('[INCOMING CALL] Failed to decline paid session:', err.message);
      }
    }

    setCallData(null);
  }, [callData]);

  return (
    <IncomingCallContext.Provider value={{}}>
      {children}
      <IncomingCallBanner
        visible={!!callData}
        contactName={callData?.contactName || ''}
        avatarUri={callData?.avatarUri || ''}
        callType={callData?.callType || 'voice'}
        communicationType={callData?.communicationType || 'AUDIO'}
        ratePerMinute={callData?.ratePerMinute || 5}
        isPaid={Boolean(callData?.isPaid)}
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
