import { create } from 'zustand';
import { getSocket } from '../services/socket';
import webRTCService from '../services/webRTCService';
import callSoundService from '../services/callSoundService';
import paidCommunicationClient from '../services/paidCommunicationService';
import { usePointsStore } from './pointsStore';

/**
 * Single Application-Level Call Store for Rubaru Calling (R4-C4)
 * Authoritative client state controller synchronized with Socket.IO backend
 */
export const useCallStore = create((set, get) => ({
  // State
  callId: null,
  callStatus: 'IDLE', // IDLE | INITIATING | RINGING | INCOMING | CONNECTING | ACTIVE | RECONNECTING | ENDED
  callType: 'audio',  // 'audio' | 'video'
  peerId: null,
  peerName: 'Rubaru User',
  peerAvatar: '',
  isInitiator: false,
  ratePerMinute: 5,
  connectedAt: null,
  durationSeconds: 0,
  reconnectGraceExpiresAt: null,
  endReason: null,
  billingSummary: null,

  // Device & Track Controls
  isAudioMuted: false,
  isVideoEnabled: true,
  isFrontCamera: true,
  isSpeakerOn: true,

  // Transient stream references (never persisted to storage)
  localStream: null,
  remoteStream: null,

  // Minimization / PiP State
  isCallMinimized: false,

  // Idempotency tracking
  activeRequestId: null,
  isHandlingAction: false,

  // Actions
  setMinimized: (minimized) => set({ isCallMinimized: Boolean(minimized) }),
  setStreams: ({ localStream, remoteStream }) => set((state) => ({
    localStream: localStream !== undefined ? localStream : state.localStream,
    remoteStream: remoteStream !== undefined ? remoteStream : state.remoteStream,
  })),

  /**
   * Set incoming call event from server
   */
  handleIncomingCall: (data) => {
    if (!data) return;
    const commType = (data.communicationType || data.callType || '').toUpperCase();
    if (commType === 'MESSAGE') {
      console.log('[CALL STORE] Ignoring incoming call for MESSAGE communication type');
      return;
    }
    const current = get();
    // If already in an active or outgoing call, ignore
    if (current.callStatus !== 'IDLE' && current.callStatus !== 'ENDED') {
      return;
    }

    const type = data.callType === 'video' || data.callType === 'VIDEO' || data.communicationType === 'VIDEO' ? 'video' : 'audio';
    const rate = Number(data.ratePerMinute) || (type === 'video' ? 10 : 5);
    const callerName = data.caller?.displayName || data.callerName || data.initiatorName || data.contactName || 'Rubaru User';
    const callerAvatar = data.caller?.avatarUrl || data.callerAvatar || data.initiatorAvatar || data.avatarUri || '';

    callSoundService.playRingtone();

    set({
      callId: data.callId || data.sessionId,
      callStatus: 'INCOMING',
      callType: type,
      peerId: data.callerId || data.initiatorId || data.caller?.id,
      peerName: callerName,
      peerAvatar: callerAvatar,
      isInitiator: false,
      ratePerMinute: rate,
      connectedAt: null,
      durationSeconds: 0,
      endReason: null,
      billingSummary: null,
      localStream: null,
      remoteStream: null,
    });
  },

  /**
   * Initiate Outgoing Call
   */
  initiateCall: async ({ receiverId, callType = 'audio', contactName = 'User', avatarUri = '' }) => {
    const state = get();
    if (state.callStatus !== 'IDLE' && state.callStatus !== 'ENDED') {
      console.warn('[CALL STORE] Cannot initiate: call already active.');
      return { success: false, error: 'CALL_ALREADY_ACTIVE' };
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      return { success: false, error: 'SOCKET_DISCONNECTED' };
    }

    const requestId = uuidv4();
    const isVideo = callType === 'video';

    set({
      callStatus: 'INITIATING',
      callType: isVideo ? 'video' : 'audio',
      peerId: receiverId,
      peerName: contactName,
      peerAvatar: avatarUri,
      isInitiator: true,
      ratePerMinute: isVideo ? 10 : 5,
      activeRequestId: requestId,
      endReason: null,
      errorMessage: null,
      billingSummary: null,
      durationSeconds: 0,
    });

    try {
      // 1. Capture local media tracks
      const stream = await webRTCService.initializeLocalMedia({ video: isVideo, audio: true });
      set({ localStream: stream });

      // 2. Emit canonical call:initiate
      return new Promise((resolve) => {
        socket.emit(
          'call:initiate',
          {
            recipientId: receiverId,
            receiverId,
            callType: isVideo ? 'VIDEO' : 'AUDIO',
            idempotencyKey: requestId,
            requestId,
          },
          (ack) => {
            const isOk = ack?.ok === true || ack?.success === true;
            if (isOk) {
              const session = ack.data;
              set({
                callId: session.callId,
                callStatus: 'RINGING',
                errorMessage: null,
                ratePerMinute: session.ratePerMinuteSnapshot || (isVideo ? 10 : 5),
              });
              callSoundService.playRingback();
              resolve({ success: true, callId: session.callId });
            } else {
              const errMsg = ack?.error?.message || 'Initiation failed';
              set({ errorMessage: errMsg });
              get().cleanup('INITIATION_FAILED');
              resolve({ success: false, error: errMsg });
            }
          }
        );
      });
    } catch (err) {
      console.error('[CALL STORE] Initiation error:', err);
      set({ errorMessage: err.message });
      get().cleanup('CAPTURE_FAILED');
      return { success: false, error: err.message };
    }
  },

  /**
   * Accept Incoming Call (Winning Device)
   */
  acceptIncomingCall: async () => {
    const state = get();
    if (state.callStatus !== 'INCOMING' || !state.callId) {
      return { success: false, error: 'NO_INCOMING_CALL' };
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      return { success: false, error: 'SOCKET_DISCONNECTED' };
    }

    callSoundService.stopAll();
    const requestId = uuidv4();
    const isVideo = state.callType === 'video';

    set({ callStatus: 'CONNECTING', isHandlingAction: true });

    try {
      // 1. Request permissions and capture local tracks only on acceptance
      const stream = await webRTCService.initializeLocalMedia({ video: isVideo, audio: true });
      set({ localStream: stream });

      // 2. Emit canonical call:accept
      return new Promise((resolve) => {
        socket.emit(
          'call:accept',
          {
            callId: state.callId,
            requestId,
          },
          (ack) => {
            set({ isHandlingAction: false });
            const isOk = ack?.ok === true || ack?.success === true;
            if (isOk) {
              console.log('[CALL STORE] Call accept acknowledged by server');
              setTimeout(() => {
                get().emitMediaReady();
              }, 400);
              resolve({ success: true });
            } else {
              const errMsg = ack?.error?.message || 'Accept failed';
              get().cleanup('ACCEPT_FAILED');
              resolve({ success: false, error: errMsg });
            }
          }
        );
      });
    } catch (err) {
      set({ isHandlingAction: false });
      console.error('[CALL STORE] Accept media capture error:', err);
      get().cleanup('CAPTURE_FAILED');
      return { success: false, error: err.message };
    }
  },

  /**
   * Reject Incoming Call
   */
  rejectIncomingCall: async (reason = 'USER_BUSY') => {
    const state = get();
    const socket = getSocket();
    const callId = state.callId;

    if (socket && socket.connected && callId) {
      socket.emit('call:reject', {
        callId,
        reason,
        requestId: uuidv4(),
      });
    }

    if (callId) {
      paidCommunicationClient.declineSession(callId, reason).catch(() => {});
    }

    get().cleanup(reason);
  },

  /**
   * Cancel Outgoing Call
   */
  cancelCall: async (reason = 'CALLER_CANCELLED') => {
    const state = get();
    const socket = getSocket();
    const callId = state.callId;

    if (socket && socket.connected && callId) {
      socket.emit('call:cancel', {
        callId,
        reason,
        requestId: uuidv4(),
      });
    }

    if (callId) {
      paidCommunicationClient.cancelSession(callId).catch(() => {});
    }

    get().cleanup(reason);
  },

  /**
   * Hang up Active Call
   */
  hangupCall: async (reason = 'USER_HUNG_UP') => {
    const state = get();
    const socket = getSocket();
    const callId = state.callId;

    if (socket && socket.connected && callId) {
      socket.emit('call:hangup', {
        callId,
        reason,
        requestId: uuidv4(),
      });
    }

    if (callId) {
      paidCommunicationClient.endSession(callId, reason).catch(() => {});
    }

    get().cleanup(reason);
  },

  /**
   * Handle Ringing Event
   */
  handleRinging: (data) => {
    const state = get();
    if (state.callId === data.callId) {
      set({ callStatus: 'RINGING' });
      if (state.isInitiator) {
        callSoundService.playRingback();
      }
    }
  },

  /**
   * Handle Accepted Event (Caller side) -> Create Offer
   */
  handleAccepted: async (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    callSoundService.stopAll();
    set({ callStatus: 'CONNECTING' });

    if (state.isInitiator) {
      try {
        const offer = await webRTCService.createOffer();
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('call:signal:offer', {
            callId: state.callId,
            sdp: offer.sdp,
            requestId: uuidv4(),
          });
        }
        setTimeout(() => {
          get().emitMediaReady();
        }, 500);
      } catch (err) {
        console.error('[CALL STORE] Create offer error:', err);
      }
    }
  },

  /**
   * Handle SDP Offer Event (Receiver side) -> Create Answer
   */
  handleOffer: async (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    try {
      const answer = await webRTCService.handleOfferAndCreateAnswer(data.sdp);
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('call:signal:answer', {
          callId: state.callId,
          sdp: answer.sdp,
          requestId: uuidv4(),
        });
      }
      setTimeout(() => {
        get().emitMediaReady();
      }, 300);
    } catch (err) {
      console.error('[CALL STORE] Handle offer and create answer error:', err);
    }
  },

  /**
   * Handle SDP Answer Event (Caller side)
   */
  handleAnswer: async (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    try {
      await webRTCService.handleAnswer(data.sdp);
      setTimeout(() => {
        get().emitMediaReady();
      }, 300);
    } catch (err) {
      console.error('[CALL STORE] Handle answer error:', err);
    }
  },

  /**
   * Handle ICE Candidate Event
   */
  handleIceCandidate: async (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    try {
      await webRTCService.addIceCandidate(data.candidate);
    } catch (err) {
      console.error('[CALL STORE] Handle ICE candidate error:', err);
    }
  },

  /**
   * Handle Media Ready Confirmation from WebRTC Service
   */
  emitMediaReady: () => {
    const state = get();
    const socket = getSocket();
    if (socket && socket.connected && state.callId) {
      socket.emit('call:media-ready', {
        callId: state.callId,
        requestId: uuidv4(),
      });
    }
  },

  /**
   * Handle Authoritative Call Connected Event (Server ACTIVE)
   */
  handleConnected: (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    callSoundService.stopAll();
    callSoundService.playConnect();

    const connectedAtTime = data.connectedAt ? new Date(data.connectedAt).getTime() : Date.now();
    set({
      callStatus: 'ACTIVE',
      connectedAt: connectedAtTime,
      ratePerMinute: data.ratePerMinuteSnapshot || state.ratePerMinute,
    });
  },

  /**
   * Handle Call Reconnecting Event
   */
  handleReconnecting: (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    callSoundService.playReconnect();

    set({
      callStatus: 'RECONNECTING',
      reconnectGraceExpiresAt: data.gracePeriodExpiresAt ? new Date(data.gracePeriodExpiresAt).getTime() : Date.now() + 15000,
    });
  },

  /**
   * Handle Call Reconnected Event
   */
  handleReconnected: (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    callSoundService.stopAll();
    callSoundService.playConnect();

    set({
      callStatus: 'ACTIVE',
      reconnectGraceExpiresAt: null,
    });
  },

  /**
   * Handle Call Dismissed (Losing Device Dismissal)
   */
  handleDismissed: (data) => {
    const current = get();
    if (current.callId === data?.callId || current.callStatus === 'INCOMING') {
      callSoundService.stopAll();
      get().resetToIdle();
    }
  },

  /**
   * Handle Call Sync from Server
   */
  handleSync: (session) => {
    if (!session) return;
    const current = get();

    if (session.handledByOtherDevice) {
      if (current.callStatus === 'INCOMING') {
        callSoundService.stopAll();
        get().resetToIdle();
      }
      return;
    }

    if (session.status === 'ACTIVE') {
      callSoundService.stopAll();
      set({
        callId: session.callId,
        callStatus: 'ACTIVE',
        connectedAt: session.connectedAt ? new Date(session.connectedAt).getTime() : current.connectedAt || Date.now(),
        ratePerMinute: session.ratePerMinuteSnapshot || current.ratePerMinute,
        reconnectGraceExpiresAt: null,
      });
    } else if (session.status === 'RECONNECTING') {
      callSoundService.playReconnect();
      set({
        callId: session.callId,
        callStatus: 'RECONNECTING',
        reconnectGraceExpiresAt: session.reconnectionDeadline ? new Date(session.reconnectionDeadline).getTime() : null,
      });
    } else if (['ENDED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'MISSED', 'EXPIRED'].includes(session.status)) {
      get().cleanup(session.endReason || session.status, session.billingSummary || null);
    }
  },

  /**
   * Reconnect Call after Socket Reconnection (Rebinding Sequence)
   */
  reconnectCall: async () => {
    const state = get();
    const socket = getSocket();
    if (!socket || !socket.connected || !state.callId) return;

    return new Promise((resolve) => {
      socket.emit('call:reconnect', { callId: state.callId, requestId: uuidv4() }, async (ack) => {
        const isOk = ack?.ok === true || ack?.success === true;
        if (isOk) {
          console.log('[CALL STORE] Socket rebound to call session successfully');
          resolve({ success: true });
        } else {
          console.warn('[CALL STORE] Reconnection rebind failed:', ack?.error?.message);
          resolve({ success: false, error: ack?.error?.message });
        }
      });
    });
  },

  /**
   * Handle Terminal Call Ended Event
   */
  handleCallEnded: (data) => {
    const state = get();
    const commType = (data?.communicationType || data?.callType || '').toUpperCase();
    if (commType === 'MESSAGE') {
      if (data?.remainingBalance !== undefined && data?.remainingBalance !== null) {
        usePointsStore.getState().setBalance(data.remainingBalance);
      } else if (data?.walletBalance !== undefined && data?.walletBalance !== null) {
        usePointsStore.getState().setBalance(data.walletBalance);
      } else {
        usePointsStore.getState().fetchBalance();
      }
      return;
    }

    if (state.callStatus === 'IDLE') {
      return;
    }

    const eventCallId = data?.callId || data?.sessionId;
    if (state.callId && eventCallId && state.callId !== eventCallId) {
      return;
    }

    if (!eventCallId || !state.callId || state.callId === eventCallId) {
      if (data?.remainingBalance !== undefined && data?.remainingBalance !== null) {
        usePointsStore.getState().setBalance(data.remainingBalance);
      } else if (data?.walletBalance !== undefined && data?.walletBalance !== null) {
        usePointsStore.getState().setBalance(data.walletBalance);
      } else {
        usePointsStore.getState().fetchBalance();
      }

      const summary = data?.billingSummary || (data && (data.totalCoinsCharged !== undefined || data.totalCoinsEarned !== undefined) ? data : null);

      if (state.callStatus === 'INCOMING') {
        callSoundService.stopAll();
        get().resetToIdle();
      } else {
        get().cleanup(data?.reason || data?.endReason || 'CALL_ENDED', summary);
      }
    }
  },

  /**
   * Toggle Microphones
   */
  toggleAudio: () => {
    const muted = webRTCService.toggleAudio();
    set({ isAudioMuted: muted });
    return muted;
  },

  /**
   * Toggle Video Camera
   */
  toggleVideo: () => {
    const enabled = webRTCService.toggleVideo();
    set({ isVideoEnabled: enabled });
    return enabled;
  },

  /**
   * Switch Camera
   */
  switchCamera: async () => {
    const isFront = await webRTCService.switchCamera();
    set({ isFrontCamera: isFront });
    return isFront;
  },

  /**
   * Toggle Speakerphone
   */
  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  /**
   * Update Elapsed Duration
   */
  tickDuration: () => {
    const state = get();
    if (state.callStatus === 'ACTIVE' && state.connectedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - state.connectedAt) / 1000));
      set({ durationSeconds: elapsed });
    }
  },

  /**
   * Single Idempotent Cleanup Path
   */
  cleanup: (reason = 'TERMINATED', billingSummary = null) => {
    webRTCService.destroy();
    callSoundService.stopAll();

    if (reason && reason !== 'IDLE' && reason !== 'INITIAL' && reason !== 'RESET') {
      callSoundService.playEnd();
    }

    set((state) => ({
      callStatus: 'ENDED',
      endReason: reason,
      billingSummary: billingSummary || state.billingSummary,
      localStream: null,
      remoteStream: null,
      isHandlingAction: false,
      isCallMinimized: false,
    }));

    console.log(`[CALL STORE] Cleaned up with reason: ${reason}`);
  },

  /**
   * Reset to IDLE
   */
  resetToIdle: () => {
    callSoundService.stopAll();
    set({
      callId: null,
      callStatus: 'IDLE',
      peerId: null,
      peerName: 'Rubaru User',
      peerAvatar: '',
      isInitiator: false,
      connectedAt: null,
      durationSeconds: 0,
      endReason: null,
      billingSummary: null,
      localStream: null,
      remoteStream: null,
      reconnectGraceExpiresAt: null,
      isCallMinimized: false,
    });
  },
}));
