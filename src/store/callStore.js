import { create } from 'zustand';
import { getSocket } from '../services/socket';
import webRTCService from '../services/webRTCService';
import callSoundService from '../services/callSoundService';
import paidCommunicationClient from '../services/paidCommunicationService';
import { usePointsStore } from './pointsStore';

let callDiagnosticsService;
try {
  const diag = require('../services/calling/CallDiagnosticsService');
  callDiagnosticsService = diag && diag.default ? diag.default : diag;
} catch (e) {
  callDiagnosticsService = {
    recordTimelineEvent: () => {},
    recordEvent: () => {},
    processStatsReport: () => null,
    classifyFailure: () => 'UNKNOWN FAILURE',
    exportEvidenceReport: () => ({ summary: 'FALLBACK' }),
    startSession: () => {},
    reset: () => {},
  };
}

let api;
try {
  const apiModule = require('../services/api');
  api = apiModule.default || apiModule;
} catch (e) {
  api = null;
}

const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  const v = c === 'x' ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});

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

  // Remote Peer Media States (WhatsApp/Instagram parity)
  isRemoteAudioMuted: false,
  isRemoteVideoDisabled: false,

  // Network Quality & Telemetry (WhatsApp/Instagram parity)
  networkQuality: 'excellent', // 'excellent' | 'good' | 'poor'
  candidatePairType: null,     // 'relay' | 'srflx' | 'host'
  isReconnecting: false,

  // Device & Track Controls
  isAudioMuted: false,
  isVideoEnabled: true,
  isFrontCamera: true,
  isSpeakerOn: true,
  audioRoute: 'speaker', // 'speaker' | 'earpiece' | 'bluetooth' | 'wired'

  // Transient stream references (never persisted to storage)
  localStream: null,
  remoteStream: null,
  remoteStreamVersion: 0,

  // Minimization / PiP State
  isCallMinimized: false,

  // Idempotency tracking
  activeRequestId: null,
  isHandlingAction: false,

  // Watchdog Timers (transient)
  _ringTimeoutTimer: null,
  _ringbackTimeoutTimer: null,
  _reconnectTimeoutTimer: null,

  // Actions
  _clearTimers: () => {
    const s = get();
    if (s._ringTimeoutTimer) clearTimeout(s._ringTimeoutTimer);
    if (s._ringbackTimeoutTimer) clearTimeout(s._ringbackTimeoutTimer);
    if (s._reconnectTimeoutTimer) clearTimeout(s._reconnectTimeoutTimer);
    set({
      _ringTimeoutTimer: null,
      _ringbackTimeoutTimer: null,
      _reconnectTimeoutTimer: null,
    });
  },

  setMinimized: (minimized) => set({ isCallMinimized: Boolean(minimized) }),
  setStreams: ({ localStream, remoteStream }) => set((state) => ({
    localStream: localStream !== undefined ? localStream : state.localStream,
    remoteStream: remoteStream !== undefined ? remoteStream : state.remoteStream,
    remoteStreamVersion: (state.remoteStreamVersion || 0) + 1,
  })),
  handleRemoteTrack: ({ track, kind, stream }) => set((state) => ({
    remoteStream: stream || state.remoteStream,
    remoteStreamVersion: (state.remoteStreamVersion || 0) + 1,
    isRemoteVideoDisabled: kind === 'video' ? !track?.enabled : state.isRemoteVideoDisabled,
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

    // Reject stale incoming calls where request has already expired
    const expiresAt = data.expiresAt || data.requestExpiresAt;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      console.log('[CALL STORE] Incoming call is already expired, ignoring stale call:', data.callId || data.sessionId);
      return;
    }

    current._clearTimers();

    const type = data.callType === 'video' || data.callType === 'VIDEO' || data.communicationType === 'VIDEO' ? 'video' : 'audio';
    const rate = Number(data.ratePerMinute) || (type === 'video' ? 10 : 5);
    const callerName = data.caller?.displayName || data.callerName || data.initiatorName || data.contactName || 'Rubaru User';
    const callerAvatar = data.caller?.avatarUrl || data.callerAvatar || data.initiatorAvatar || data.avatarUri || '';

    callDiagnosticsService.startSession(data.callId || data.sessionId, {
      isInitiator: false,
      callType: type,
      peerId: data.callerId || data.initiatorId || data.caller?.id,
    });
    callDiagnosticsService.recordTimelineEvent('T2');

    callSoundService.playRingtone();

    // Client-side ringing watchdog fallback: server timeout is 45s, watchdog allows +2s buffer
    const timeoutMs = expiresAt
      ? Math.max(5000, new Date(expiresAt).getTime() - Date.now() + 2000)
      : 47000;

    const ringTimer = setTimeout(() => {
      const s = get();
      if (s.callStatus === 'INCOMING') {
        console.log('[CALL STORE] Incoming call ring timeout watchdog fired; resetting to IDLE');
        callSoundService.stopAll();
        get().resetToIdle();
      }
    }, timeoutMs);

    set({
      _ringTimeoutTimer: ringTimer,
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
    if (state.isHandlingAction) {
      console.warn('[CALL STORE] Action in progress, ignoring duplicate initiate');
      return { success: false, error: 'ACTION_IN_PROGRESS' };
    }
    if (state.callStatus !== 'IDLE' && state.callStatus !== 'ENDED') {
      console.warn('[CALL STORE] Cannot initiate: call already active.');
      return { success: false, error: 'CALL_ALREADY_ACTIVE' };
    }

    const socket = getSocket();
    if (!socket || !socket.connected) {
      return { success: false, error: 'SOCKET_DISCONNECTED' };
    }

    state._clearTimers();

    const requestId = uuidv4();
    const isVideo = callType === 'video';

    set({
      callStatus: 'INITIATING',
      isHandlingAction: true,
      callType: isVideo ? 'video' : 'audio',
      peerId: receiverId,
      peerName: contactName,
      peerAvatar: avatarUri,
      isInitiator: true,
      ratePerMinute: isVideo ? 10 : 5,
      isSpeakerOn: isVideo,
      activeRequestId: requestId,
      endReason: null,
      errorMessage: null,
      billingSummary: null,
      durationSeconds: 0,
      audioRoute: isVideo ? 'speaker' : 'earpiece',
    });
    callSoundService.setAudioRoute(isVideo);

    callDiagnosticsService.startSession(null, {
      isInitiator: true,
      callType: isVideo ? 'video' : 'audio',
      peerId: receiverId,
    });
    callDiagnosticsService.recordTimelineEvent('T0');

    try {
      // 1. Capture local media tracks
      const stream = await webRTCService.initializeLocalMedia({ video: isVideo, audio: true });
      set({ localStream: stream });

      // 2. Emit canonical call:initiate
      return new Promise((resolve) => {
        callDiagnosticsService.recordTimelineEvent('T1');
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
            set({ isHandlingAction: false });
            const isOk = ack?.ok === true || ack?.success === true;
            if (isOk) {
              const session = ack.data;
              callDiagnosticsService.callId = session.callId;
              callDiagnosticsService.sessionId = session.sessionId || session.callId;
              const ringbackTimer = setTimeout(() => {
                const s = get();
                if (s.callStatus === 'RINGING' || s.callStatus === 'INITIATING') {
                  console.log('[CALL STORE] Caller ringback watchdog fired; cancelling call');
                  get().cancelCall('RING_TIMEOUT');
                }
              }, 50000);
              set({
                callId: session.callId,
                callStatus: 'RINGING',
                errorMessage: null,
                ratePerMinute: session.ratePerMinuteSnapshot || (isVideo ? 10 : 5),
                _ringbackTimeoutTimer: ringbackTimer,
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
      set({ isHandlingAction: false });
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
    if (state.isHandlingAction) {
      console.warn('[CALL STORE] Action in progress, ignoring duplicate accept');
      return { success: false, error: 'ACTION_IN_PROGRESS' };
    }
    if (state.callStatus !== 'INCOMING' || !state.callId) {
      return { success: false, error: 'NO_INCOMING_CALL' };
    }

    state._clearTimers();

    const socket = getSocket();
    if (!socket || !socket.connected) {
      return { success: false, error: 'SOCKET_DISCONNECTED' };
    }

    callSoundService.stopAll();
    callDiagnosticsService.recordTimelineEvent('T3');
    const requestId = uuidv4();
    const isVideo = state.callType === 'video';

    set({
      callStatus: 'CONNECTING',
      isHandlingAction: true,
      isSpeakerOn: isVideo,
      audioRoute: isVideo ? 'speaker' : 'earpiece',
    });
    callSoundService.setAudioRoute(isVideo);

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
    if (state.isHandlingAction) {
      console.warn('[CALL STORE] Action in progress, ignoring duplicate reject');
      return;
    }
    if (state.callStatus !== 'INCOMING' || !state.callId) {
      console.warn('[CALL STORE] Cannot reject: no incoming call');
      return;
    }
    set({ isHandlingAction: true });
    state._clearTimers();
    callSoundService.stopAll();
    webRTCService.destroy();

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

    get().resetToIdle();
  },

  /**
   * Cancel Outgoing Call
   */
  cancelCall: async (reason = 'CALLER_CANCELLED') => {
    const state = get();
    if (state.isHandlingAction) {
      console.warn('[CALL STORE] Action in progress, ignoring duplicate cancel');
      return;
    }
    if (state.callStatus === 'IDLE' || state.callStatus === 'ENDED') {
      console.warn('[CALL STORE] Cannot cancel: call is not active');
      return;
    }
    set({ isHandlingAction: true });
    state._clearTimers();
    callSoundService.stopAll();

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
    if (state.isHandlingAction) {
      console.warn('[CALL STORE] Action in progress, ignoring duplicate hangup');
      return;
    }
    if (state.callStatus === 'IDLE' || state.callStatus === 'ENDED') {
      console.warn('[CALL STORE] Cannot hangup: call is not active');
      return;
    }
    set({ isHandlingAction: true });
    state._clearTimers();
    callSoundService.stopAll();

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
            type: offer.type || 'offer',
            requestId: uuidv4(),
          });
        }
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
      const offerPayload = (data.sdp && typeof data.sdp === 'object') ? data.sdp : { type: data.type || 'offer', sdp: data.sdp };
      const answer = await webRTCService.handleOfferAndCreateAnswer(offerPayload);
      const socket = getSocket();
      if (socket && socket.connected) {
        socket.emit('call:signal:answer', {
          callId: state.callId,
          sdp: answer.sdp,
          type: answer.type || 'answer',
          requestId: uuidv4(),
        });
      }
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
      const answerPayload = (data.sdp && typeof data.sdp === 'object') ? data.sdp : { type: data.type || 'answer', sdp: data.sdp };
      await webRTCService.handleAnswer(answerPayload);
    } catch (err) {
      console.error('[CALL STORE] Handle answer error:', err);
    }
  },

  /**
   * Handle Connection Failure from WebRTC
   */
  handleConnectionFailed: (reason = 'ICE_CONNECTION_FAILED') => {
    const state = get();
    console.error('[CALL STORE] WebRTC connection failed:', reason);
    callSoundService.stopAll();
    callSoundService.playDisconnect();
    set({
      callStatus: 'ENDED',
      endReason: reason,
      errorMessage: 'Connection failed. Please check your network.',
    });
    get().cleanup(reason);
  },

  /**
   * Handle ICE Candidate Event
   */
  handleIceCandidate: async (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    try {
      await webRTCService.addIceCandidate(data.candidate ? { ...data.candidate, generation: data.generation } : data);
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

    state._clearTimers();
    callSoundService.stopAll();
    callSoundService.playConnect();

    const connectedAtTime = data.connectedAt ? new Date(data.connectedAt).getTime() : Date.now();
    set({
      callStatus: 'ACTIVE',
      connectedAt: connectedAtTime,
      ratePerMinute: data.ratePerMinuteSnapshot || state.ratePerMinute,
      isHandlingAction: false,
      isReconnecting: false,
      reconnectGraceExpiresAt: null,
    });
  },

  /**
   * Handle Call Reconnecting Event
   */
  handleReconnecting: (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    state._clearTimers();
    callSoundService.playReconnect();

    const deadline = data.gracePeriodExpiresAt ? new Date(data.gracePeriodExpiresAt).getTime() : Date.now() + 20000;
    const reconnectTimer = setTimeout(() => {
      const s = get();
      if (s.callStatus === 'RECONNECTING') {
        console.log('[CALL STORE] Reconnect grace period watchdog fired; cleaning up');
        get().cleanup('RECONNECT_TIMEOUT');
      }
    }, Math.max(5000, deadline - Date.now() + 2000));

    set({
      callStatus: 'RECONNECTING',
      isReconnecting: true,
      reconnectGraceExpiresAt: deadline,
      _reconnectTimeoutTimer: reconnectTimer,
    });
  },

  /**
   * Handle Call Reconnected Event
   */
  handleReconnected: (data) => {
    const state = get();
    if (state.callId !== data.callId) return;

    state._clearTimers();
    callSoundService.stopAll();
    callSoundService.playConnect();

    set({
      callStatus: 'ACTIVE',
      isReconnecting: false,
      reconnectGraceExpiresAt: null,
    });
  },

  /**
   * Handle Remote Peer Media Control Sync (WhatsApp/Instagram parity)
   */
  handleRemoteMediaControl: (data) => {
    const state = get();
    if (state.callId && data?.callId && state.callId !== data.callId) return;
    if (data?.isAudioMuted !== undefined) {
      set({ isRemoteAudioMuted: Boolean(data.isAudioMuted) });
    }
    if (data?.isVideoEnabled !== undefined) {
      set({ isRemoteVideoDisabled: !data.isVideoEnabled });
    }
  },

  /**
   * Handle WebRTC Network Quality Telemetry
   */
  handleQualityReport: (report) => {
    if (!report) return;
    set((state) => ({
      networkQuality: report.isPoor ? 'poor' : report.lossRate > 5 ? 'good' : 'excellent',
      candidatePairType: report.candidatePairType || state.candidatePairType,
    }));
  },

  /**
   * Handle WebRTC Transport Disconnection & Trigger ICE Restart
   */
  handleConnectionReconnecting: () => {
    const state = get();
    if (state.callStatus === 'ACTIVE') {
      callSoundService.playReconnect();
      set({ callStatus: 'RECONNECTING', isReconnecting: true });

      const socket = getSocket();
      if (socket && socket.connected && state.callId) {
        socket.emit('call:reconnecting', {
          callId: state.callId,
          reason: 'ICE_DISCONNECTED',
          requestId: uuidv4(),
        });
      }

      if (state.isInitiator) {
        webRTCService.restartIce().then((offer) => {
          if (offer && socket && socket.connected) {
            socket.emit('call:signal:offer', {
              callId: state.callId,
              sdp: offer.sdp,
              type: offer.type || 'offer',
              generation: offer.generation,
              requestId: uuidv4(),
            });
          }
        }).catch((err) => console.warn('[CALL STORE] ICE restart failed:', err));
      }
    }
  },

  /**
   * Handle Call Dismissed (Losing Device Dismissal)
   */
  handleDismissed: (data) => {
    const current = get();
    if (current.callId === data?.callId || current.callStatus === 'INCOMING') {
      current._clearTimers();
      callSoundService.stopAll();
      get().resetToIdle();
    }
  },

  /**
   * Handle Call Sync from Server
   */
  handleSync: (data) => {
    if (!data) return;
    const current = get();

    // Support both direct session object and wrapped { hasActiveCall, call }
    const hasActiveCall = data.hasActiveCall !== undefined ? Boolean(data.hasActiveCall) : Boolean(data.call || data.status);
    const session = data.call || (data.status ? data : null);

    if (data.handledByOtherDevice || session?.handledByOtherDevice) {
      if (current.callStatus === 'INCOMING') {
        current._clearTimers();
        callSoundService.stopAll();
        get().resetToIdle();
      }
      return;
    }

    if (!hasActiveCall || !session) {
      // Server authoritatively indicates no active call exists for this user.
      if (current.callStatus !== 'IDLE' && current.callStatus !== 'ENDED') {
        console.log('[CALL STORE] Server reports no active call; tearing down local call state');
        current._clearTimers();
        callSoundService.stopAll();
        get().cleanup('SESSION_EXPIRED');
      }
      return;
    }

    // Call is active on server
    if (session.status === 'ACTIVE') {
      current._clearTimers();
      callSoundService.stopAll();
      set({
        callId: session.callId,
        callStatus: 'ACTIVE',
        connectedAt: session.connectedAt ? new Date(session.connectedAt).getTime() : current.connectedAt || Date.now(),
        ratePerMinute: session.ratePerMinuteSnapshot || current.ratePerMinute,
        reconnectGraceExpiresAt: null,
        isReconnecting: false,
      });
    } else if (session.status === 'RECONNECTING') {
      callSoundService.playReconnect();
      const deadline = session.reconnectionDeadline ? new Date(session.reconnectionDeadline).getTime() : Date.now() + 15000;
      current._clearTimers();
      const reconnectTimer = setTimeout(() => {
        const s = get();
        if (s.callStatus === 'RECONNECTING') {
          console.log('[CALL STORE] Sync reconnect timeout fired');
          get().cleanup('RECONNECT_TIMEOUT');
        }
      }, Math.max(5000, deadline - Date.now() + 2000));
      set({
        callId: session.callId,
        callStatus: 'RECONNECTING',
        isReconnecting: true,
        reconnectGraceExpiresAt: deadline,
        _reconnectTimeoutTimer: reconnectTimer,
      });
    } else if (session.status === 'RINGING' || session.status === 'INITIATED') {
      if (current.isInitiator && current.callId === session.callId) {
        set({ callStatus: 'RINGING' });
      }
    } else if (['ENDED', 'COMPLETED', 'FAILED', 'CANCELLED', 'REJECTED', 'MISSED', 'EXPIRED', 'DECLINED'].includes(session.status)) {
      current._clearTimers();
      get().cleanup(session.endReason || session.status, session.billingSummary || null);
    }
  },

  /**
   * Proactively request call state synchronization from server
   */
  syncWithServer: () => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('call:sync', { requestId: uuidv4() }, (ack) => {
        if (ack?.ok || ack?.success) {
          get().handleSync(ack.data);
        }
      });
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

    if (state.callStatus === 'IDLE' || state.callStatus === 'ENDED') {
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
   * Toggle Microphones with remote socket synchronization
   */
  toggleAudio: () => {
    const muted = webRTCService.toggleAudio();
    set({ isAudioMuted: muted });
    const state = get();
    const socket = getSocket();
    if (socket && socket.connected && state.callId) {
      socket.emit('call:media-control', {
        callId: state.callId,
        isAudioMuted: muted,
        requestId: uuidv4(),
      });
    }
    return muted;
  },

  /**
   * Toggle Video Camera with remote socket synchronization
   */
  toggleVideo: () => {
    const enabled = webRTCService.toggleVideo();
    set({ isVideoEnabled: enabled });
    const state = get();
    const socket = getSocket();
    if (socket && socket.connected && state.callId) {
      socket.emit('call:media-control', {
        callId: state.callId,
        isVideoEnabled: enabled,
        requestId: uuidv4(),
      });
    }
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
  toggleSpeaker: async () => {
    const nextSpeaker = !get().isSpeakerOn;
    const nextRoute = nextSpeaker ? 'speaker' : 'earpiece';
    set({ isSpeakerOn: nextSpeaker, audioRoute: nextRoute });
    await callSoundService.setAudioRoute(nextSpeaker);
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
    const currentState = get();
    const isAlreadyEnded = currentState.callStatus === 'ENDED' || currentState.callStatus === 'IDLE';

    currentState._clearTimers();
    callDiagnosticsService.classifyFailure(reason);
    callDiagnosticsService.recordEvent('cleanup');
    webRTCService.destroy();
    callSoundService.stopAll();
    callSoundService.restoreAudioMode();

    if (!isAlreadyEnded && reason && reason !== 'IDLE' && reason !== 'INITIAL' && reason !== 'RESET') {
      callSoundService.playEnd();
    }

    set((state) => ({
      callStatus: 'ENDED',
      endReason: reason,
      billingSummary: billingSummary || state.billingSummary,
      localStream: null,
      remoteStream: null,
      remoteStreamVersion: 0,
      isHandlingAction: false,
      isCallMinimized: false,
      isReconnecting: false,
      isRemoteAudioMuted: false,
      isRemoteVideoDisabled: false,
      audioRoute: 'speaker',
    }));

    // Asynchronously submit sanitized evidence report without blocking local cleanup
    const endingCallId = currentState.callId;
    if (endingCallId && api && typeof api.post === 'function') {
      try {
        const report = callDiagnosticsService && typeof callDiagnosticsService.exportEvidenceReport === 'function'
          ? callDiagnosticsService.exportEvidenceReport(reason)
          : null;
        if (report) {
          api.post(`/calls/${endingCallId}/diagnostics`, { callId: endingCallId, diagnostics: report }).catch(() => {});
        }
      } catch (uploadErr) {
        // Non-blocking
      }
    }

    console.log(`[CALL STORE] Cleaned up with reason: ${reason}`);
  },

  /**
   * Reset to IDLE
   */
  resetToIdle: () => {
    get()._clearTimers();
    callDiagnosticsService.reset();
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
      remoteStreamVersion: 0,
      reconnectGraceExpiresAt: null,
      isCallMinimized: false,
      isReconnecting: false,
      isRemoteAudioMuted: false,
      isRemoteVideoDisabled: false,
      isHandlingAction: false,
      networkQuality: 'excellent',
      candidatePairType: null,
      audioRoute: 'speaker',
    });
  },
}));
