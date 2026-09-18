import { useEffect } from 'react';
import { useCallStore } from '../store/callStore';
import { getSocket } from '../services/socket';
import webRTCService from '../services/webRTCService';

/**
 * useCallController
 * Single application-level calling controller hook.
 *
 * Mounted once at the app root (see IncomingCallProvider) so signaling listeners are live
 * before any call is ever accepted — NOT lazily inside ActiveCallScreen, which only mounts
 * after accept and would race against the caller's near-instant offer emission.
 */
export function useCallController() {
  const store = useCallStore();

  useEffect(() => {
    // --- webRTCService listeners: independent of socket lifecycle, attach immediately ---
    const unsubLocalStream = webRTCService.on('onLocalStream', (stream) => {
      store.setStreams({ localStream: stream });
    });

    const unsubRemoteStream = webRTCService.on('onRemoteStream', (stream) => {
      store.setStreams({ remoteStream: stream });
    });

    const unsubRemoteTrack = webRTCService.on('onRemoteTrack', ({ track, kind, stream }) => {
      store.handleRemoteTrack({ track, kind, stream });
    });

    const unsubMediaReady = webRTCService.on('onMediaReady', () => {
      store.emitMediaReady();
    });

    const unsubConnectionFailed = webRTCService.on('onConnectionFailed', (data) => {
      store.handleConnectionFailed(data?.reason || 'ICE_FAILED');
    });

    const unsubConnectionReconnecting = webRTCService.on('onConnectionReconnecting', () => {
      store.handleConnectionReconnecting();
    });

    const unsubConnectionReconnected = webRTCService.on('onConnectionReconnected', () => {
      const state = useCallStore.getState();
      if (state.callStatus === 'RECONNECTING') {
        store.handleReconnected({ callId: state.callId });
        const socket = getSocket();
        if (socket && socket.connected && state.callId) {
          socket.emit('call:reconnected', { callId: state.callId, requestId: `${state.callId}_${Date.now()}` });
        }
      }
    });

    const unsubQualityReport = webRTCService.on('onQualityReport', (report) => {
      store.handleQualityReport(report);
    });

    const unsubIceCandidate = webRTCService.on('onIceCandidate', ({ candidate, generation }) => {
      const state = useCallStore.getState();
      const socket = getSocket();
      if (state.callId && socket && socket.connected) {
        socket.emit('call:signal:ice', {
          callId: state.callId,
          candidate,
          generation,
          requestId: `${state.callId}_${Date.now()}`,
        });
      }
    });

    // --- Socket.IO call listeners ---
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
    // Legacy 'call_connected' fires immediately on call:accept, before any SDP/ICE exchange —
    // it must NOT drive UI state. The authoritative 'call:connected' (below) is only emitted by
    // the backend once both peers report real WebRTC media-ready, and is the only event allowed
    // to move callStatus to ACTIVE.
    const onCallConnectedLegacy = () => {};
    const onMediaControl = (data) => store.handleRemoteMediaControl(data);
    const onCallEnded = (data) => store.handleCallEnded(data);
    const onCallRejected = (data) => store.handleCallEnded(data);
    const onCallCancelled = (data) => store.handleCallEnded(data);
    const onCallDismissed = (data) => store.handleDismissed(data);
    const onCallSync = (data) => store.handleSync(data);

    // The socket singleton (services/socket.js) may not exist yet when this hook mounts at the
    // app root (e.g. before login/connectSocket resolves), and may be replaced by a brand new
    // instance across a logout/login cycle. Poll until a (possibly new, unregistered) socket
    // instance is available and attach directly to it, rather than bailing out permanently.
    let activeSocket = null;

    const detachSocketListeners = () => {
      if (!activeSocket) return;
      activeSocket.off('call:incoming', onIncoming);
      activeSocket.off('incoming_call', onIncoming);
      activeSocket.off('call:ringing', onRinging);
      activeSocket.off('call:accepted', onAccepted);
      activeSocket.off('call_accepted', onAccepted);
      activeSocket.off('call:signal:offer', onSignalOffer);
      activeSocket.off('call.offer', onSignalOffer);
      activeSocket.off('call:signal:answer', onSignalAnswer);
      activeSocket.off('call.answer', onSignalAnswer);
      activeSocket.off('call:signal:ice', onSignalIce);
      activeSocket.off('call.ice_candidate', onSignalIce);
      activeSocket.off('call:connected', onConnected);
      activeSocket.off('call_connected', onCallConnectedLegacy);
      activeSocket.off('call:media-control', onMediaControl);
      activeSocket.off('call:reconnecting', onReconnecting);
      activeSocket.off('call:reconnected', onReconnected);
      activeSocket.off('call:ended', onCallEnded);
      activeSocket.off('call_hungup', onCallEnded);
      activeSocket.off('call.ended', onCallEnded);
      activeSocket.off('call:rejected', onCallRejected);
      activeSocket.off('call_declined', onCallRejected);
      activeSocket.off('call:cancelled', onCallCancelled);
      activeSocket.off('call.cancelled', onCallCancelled);
      activeSocket.off('call:dismissed', onCallDismissed);
      activeSocket.off('call:sync', onCallSync);
      activeSocket._callControllerRegistered = false;
      activeSocket = null;
    };

    const attachSocketListeners = (socket) => {
      socket._callControllerRegistered = true;
      activeSocket = socket;

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
      socket.on('call_connected', onCallConnectedLegacy);
      socket.on('call:media-control', onMediaControl);
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
    };

    // Attach immediately if the socket already exists (no artificial delay in the common case).
    const initialSocket = getSocket();
    if (initialSocket && !initialSocket._callControllerRegistered) {
      attachSocketListeners(initialSocket);
    }

    const socketPoll = setInterval(() => {
      const socket = getSocket();
      if (socket && socket !== activeSocket && !socket._callControllerRegistered) {
        detachSocketListeners();
        attachSocketListeners(socket);
      } else if (!socket && activeSocket) {
        detachSocketListeners();
      }
    }, 500);

    return () => {
      clearInterval(socketPoll);
      detachSocketListeners();
      unsubLocalStream();
      unsubRemoteStream();
      unsubRemoteTrack();
      unsubMediaReady();
      unsubConnectionFailed();
      unsubConnectionReconnecting();
      unsubConnectionReconnected();
      unsubQualityReport();
      unsubIceCandidate();
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
