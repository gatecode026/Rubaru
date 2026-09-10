import { useEffect, useRef } from 'react';
import { useCallStore } from '../store/callStore';
import { getSocket } from '../services/socket';
import webRTCService from '../services/webRTCService';

/**
 * useCallController
 * Single application-level calling controller hook
 */
export function useCallController() {
  const store = useCallStore();
  const listenersAttachedRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Attach WebRTC service listeners
    const unsubLocalStream = webRTCService.on('onLocalStream', (stream) => {
      store.setStreams({ localStream: stream });
    });

    const unsubRemoteStream = webRTCService.on('onRemoteStream', (stream) => {
      store.setStreams({ remoteStream: stream });
    });

    const unsubMediaReady = webRTCService.on('onMediaReady', () => {
      store.emitMediaReady();
    });

    const unsubIceCandidate = webRTCService.on('onIceCandidate', ({ candidate, generation }) => {
      const state = useCallStore.getState();
      if (state.callId && socket.connected) {
        socket.emit('call:signal:ice', {
          callId: state.callId,
          candidate,
          generation,
          requestId: `${state.callId}_${Date.now()}`,
        });
      }
    });

    // Attach Socket.IO call listeners
    const onIncoming = (data) => {
      const commType = (data?.communicationType || data?.callType || '').toUpperCase();
      if (commType === 'MESSAGE') return;
      store.handleIncomingCall(data);
    };
    const onRinging = (data) => store.handleRinging(data);
    const onAccepted = (data) => store.handleAccepted(data);
    const onSignalOffer = (data) => store.handleOffer(data);
    const onSignalAnswer = (data) => store.handleAnswer(data);
    const onSignalIce = (data) => store.handleIceCandidate(data);
    const onConnected = (data) => store.handleConnected(data);
    const onReconnecting = (data) => store.handleReconnecting(data);
    const onReconnected = (data) => store.handleReconnected(data);
    const onCallEnded = (data) => store.handleCallEnded(data);
    const onCallRejected = (data) => store.handleCallEnded(data);
    const onCallCancelled = (data) => store.handleCallEnded(data);
    const onCallDismissed = (data) => store.handleDismissed(data);
    const onCallSync = (data) => store.handleSync(data);

    socket.on('call:incoming', onIncoming);
    socket.on('incoming_call', onIncoming);
    socket.on('call:ringing', onRinging);
    socket.on('call:accepted', onAccepted);
    socket.on('call_accepted', onAccepted);
    socket.on('call:signal:offer', onSignalOffer);
    socket.on('call.offer', onSignalOffer);
    socket.on('call:signal:answer', onSignalAnswer);
    socket.on('call.answer', onSignalAnswer);
    socket.on('call:signal:ice', onSignalIce);
    socket.on('call.ice_candidate', onSignalIce);
    socket.on('call:connected', onConnected);
    socket.on('call_connected', (data) => onConnected({ callId: data?.callSessionId || data?.callId, ...data }));
    socket.on('call:reconnecting', onReconnecting);
    socket.on('call:reconnected', onReconnected);
    socket.on('call:ended', onCallEnded);
    socket.on('call_hungup', onCallEnded);
    socket.on('call.ended', onCallEnded);
    socket.on('call:rejected', onCallRejected);
    socket.on('call_declined', onCallRejected);
    socket.on('call:cancelled', onCallCancelled);
    socket.on('call.cancelled', onCallCancelled);
    socket.on('call:dismissed', onCallDismissed);
    socket.on('call:sync', onCallSync);

    listenersAttachedRef.current = true;

    return () => {
      unsubLocalStream();
      unsubRemoteStream();
      unsubMediaReady();
      unsubIceCandidate();

      if (socket) {
        socket.off('call:incoming', onIncoming);
        socket.off('incoming_call', onIncoming);
        socket.off('call:ringing', onRinging);
        socket.off('call:accepted', onAccepted);
        socket.off('call_accepted', onAccepted);
        socket.off('call:signal:offer', onSignalOffer);
        socket.off('call.offer', onSignalOffer);
        socket.off('call:signal:answer', onSignalAnswer);
        socket.off('call.answer', onSignalAnswer);
        socket.off('call:signal:ice', onSignalIce);
        socket.off('call.ice_candidate', onSignalIce);
        socket.off('call:connected', onConnected);
        socket.off('call_connected', onConnected);
        socket.off('call:reconnecting', onReconnecting);
        socket.off('call:reconnected', onReconnected);
        socket.off('call:ended', onCallEnded);
        socket.off('call_hungup', onCallEnded);
        socket.off('call.ended', onCallEnded);
        socket.off('call:rejected', onCallRejected);
        socket.off('call_declined', onCallRejected);
        socket.off('call:cancelled', onCallCancelled);
        socket.off('call.cancelled', onCallCancelled);
        socket.off('call:dismissed', onCallDismissed);
        socket.off('call:sync', onCallSync);
      }
    };
  }, []);

  // Duration timer when ACTIVE
  useEffect(() => {
    let interval = null;
    if (store.callStatus === 'ACTIVE') {
      interval = setInterval(() => {
        store.tickDuration();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [store.callStatus]);

  return store;
}
