import api from './api';

let callDiagnosticsService;
try {
  const diag = require('./calling/CallDiagnosticsService');
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

// Safely import react-native-webrtc or fallback to global/browser WebRTC
let RTCPeerConnectionNative = null;
let RTCIceCandidateNative = null;
let RTCSessionDescriptionNative = null;
let mediaDevicesNative = null;
let RTCViewNative = null;
let MediaStreamNative = null;
let MediaStreamTrackNative = null;

let PermissionsAndroidNative = null;
let PlatformNative = { OS: 'unknown' };

try {
  const RNWebRTC = require('react-native-webrtc');
  RTCPeerConnectionNative = RNWebRTC.RTCPeerConnection;
  RTCIceCandidateNative = RNWebRTC.RTCIceCandidate;
  RTCSessionDescriptionNative = RNWebRTC.RTCSessionDescription;
  mediaDevicesNative = RNWebRTC.mediaDevices;
  RTCViewNative = RNWebRTC.RTCView;
  MediaStreamNative = RNWebRTC.MediaStream;
  MediaStreamTrackNative = RNWebRTC.MediaStreamTrack;
  if (typeof RNWebRTC.registerGlobals === 'function') {
    try {
      RNWebRTC.registerGlobals();
    } catch (e) {}
  }
} catch (e) {
  // Graceful fallback for non-native / test / mock environments
  if (typeof global !== 'undefined') {
    RTCPeerConnectionNative = global.RTCPeerConnection || null;
    RTCIceCandidateNative = global.RTCIceCandidate || null;
    RTCSessionDescriptionNative = global.RTCSessionDescription || null;
    mediaDevicesNative = global.navigator?.mediaDevices || null;
    MediaStreamNative = global.MediaStream || null;
    MediaStreamTrackNative = global.MediaStreamTrack || null;
  }
}

try {
  const RN = require('react-native');
  if (RN.PermissionsAndroid) PermissionsAndroidNative = RN.PermissionsAndroid;
  if (RN.Platform) PlatformNative = RN.Platform;
} catch (e) {}

export const RTCView = RTCViewNative;
export const MediaStream = MediaStreamNative;
export const MediaStreamTrack = MediaStreamTrackNative;

const DEFAULT_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

/**
 * Simulated MediaStream for non-native / Expo Go environments
 */
export class SimulatedMediaStream {
  constructor(callType = 'audio') {
    this.id = 'sim_stream_' + Math.random().toString(36).substring(7);
    this._tracks = [
      { id: 'sim_audio_' + Date.now(), kind: 'audio', enabled: true, readyState: 'live', stop: () => {} },
    ];
    if (callType === 'video') {
      this._tracks.push({ id: 'sim_video_' + Date.now(), kind: 'video', enabled: true, readyState: 'live', stop: () => {} });
    }
  }
  toURL() {
    return 'webrtc-stream://' + this.id;
  }
  getTracks() {
    return this._tracks;
  }
  getAudioTracks() {
    return this._tracks.filter((t) => t.kind === 'audio');
  }
  getVideoTracks() {
    return this._tracks.filter((t) => t.kind === 'video');
  }
  release() {}
}

/**
 * Simulated RTCPeerConnection for non-native / Expo Go environments
 */
export class SimulatedRTCPeerConnection {
  constructor(config = {}) {
    this.config = config;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.iceGatheringState = 'new';
    this.signalingState = 'stable';
    this.localDescription = null;
    this.remoteDescription = null;
    this.onicecandidate = null;
    this.onicegatheringstatechange = null;
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
    this.ontrack = null;
    this._closed = false;
  }

  async createOffer(options = {}) {
    this.iceGatheringState = 'gathering';
    if (typeof this.onicegatheringstatechange === 'function') {
      this.onicegatheringstatechange();
    }
    return {
      type: 'offer',
      sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\n',
    };
  }

  async createAnswer(options = {}) {
    this.iceGatheringState = 'gathering';
    if (typeof this.onicegatheringstatechange === 'function') {
      this.onicegatheringstatechange();
    }
    return {
      type: 'answer',
      sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\n',
    };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    if (desc && desc.type === 'offer') {
      this.signalingState = 'have-local-offer';
    } else if (desc && desc.type === 'answer') {
      this.signalingState = 'stable';
    }
    this.iceGatheringState = 'gathering';
    if (typeof this.onicegatheringstatechange === 'function') {
      this.onicegatheringstatechange();
    }
    setTimeout(() => {
      if (this._closed) return;
      if (typeof this.onicecandidate === 'function') {
        this.onicecandidate({
          candidate: {
            candidate: 'candidate:1 1 UDP 2122260223 127.0.0.1 5000 typ host',
            sdpMid: '0',
            sdpMLineIndex: 0,
          },
        });
      }
      this.iceGatheringState = 'complete';
      if (typeof this.onicegatheringstatechange === 'function') {
        this.onicegatheringstatechange();
      }
    }, 50);
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    if (desc && desc.type === 'offer') {
      this.signalingState = 'have-remote-offer';
    } else if (desc && desc.type === 'answer') {
      this.signalingState = 'stable';
    }
    this.connectionState = 'connected';
    this.iceConnectionState = 'connected';
    setTimeout(() => {
      if (this._closed) return;
      if (typeof this.ontrack === 'function') {
        const stream = new SimulatedMediaStream('video');
        this.ontrack({
          track: stream.getAudioTracks()[0],
          streams: [stream],
        });
        if (stream.getVideoTracks().length > 0) {
          this.ontrack({
            track: stream.getVideoTracks()[0],
            streams: [stream],
          });
        }
      }
      if (typeof this.onconnectionstatechange === 'function') {
        this.onconnectionstatechange();
      }
      if (typeof this.oniceconnectionstatechange === 'function') {
        this.oniceconnectionstatechange();
      }
    }, 50);
  }

  async addIceCandidate(candidate) {
    return true;
  }

  addTrack(track, stream) {}
  addStream(stream) {}
  getSenders() {
    return [];
  }

  async getStats() {
    this._statsCallCount = (this._statsCallCount || 0) + 1;
    const count = this._statsCallCount;
    const audioSent = 1500 + count * 50;
    const audioRecv = 1495 + count * 50;
    const videoSent = 3400 + count * 60;
    const videoRecv = 3390 + count * 60;
    const framesRecv = 850 + count * 30;
    const framesDec = 848 + count * 30;

    const reports = new Map();
    reports.set('transport_1', {
      type: 'transport',
      dtlsState: 'connected',
    });
    reports.set('cand_local', {
      id: 'cand_local',
      candidateType: 'host',
      protocol: 'udp',
    });
    reports.set('cand_remote', {
      id: 'cand_remote',
      candidateType: 'host',
      protocol: 'udp',
    });
    reports.set('pair_1', {
      type: 'candidate-pair',
      state: 'succeeded',
      nominated: true,
      protocol: 'UDP',
      currentRoundTripTime: 0.042,
      localCandidateId: 'cand_local',
      remoteCandidateId: 'cand_remote',
    });
    reports.set('audio_out', {
      type: 'outbound-rtp',
      kind: 'audio',
      packetsSent: audioSent,
      bytesSent: audioSent * 80,
    });
    reports.set('audio_in', {
      type: 'inbound-rtp',
      kind: 'audio',
      packetsReceived: audioRecv,
      bytesReceived: audioRecv * 80,
      packetsLost: 2,
    });
    reports.set('video_out', {
      type: 'outbound-rtp',
      kind: 'video',
      packetsSent: videoSent,
      bytesSent: videoSent * 300,
    });
    reports.set('video_in', {
      type: 'inbound-rtp',
      kind: 'video',
      packetsReceived: videoRecv,
      bytesReceived: videoRecv * 300,
      packetsLost: 5,
      framesDecoded: framesDec,
      framesReceived: framesRecv,
      frameWidth: 1280,
      frameHeight: 720,
      framesPerSecond: 30,
    });
    return reports;
  }

  close() {
    this._closed = true;
    this.signalingState = 'closed';
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this.iceGatheringState = 'complete';
  }
}

/**
 * Enterprise WebRTC Media & PeerConnection Client Service for Rubaru Calling
 */
class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.iceServers = [...DEFAULT_STUN_SERVERS];
    this.isAudioMuted = false;
    this.isVideoEnabled = true;
    this.isFrontCamera = true;
    this.listeners = {
      onLocalStream: [],
      onRemoteStream: [],
      onRemoteTrack: [],
      onConnectionStateChange: [],
      onIceCandidate: [],
      onMediaReady: [],
      onConnectionFailed: [],
      onConnectionReconnecting: [],
      onConnectionReconnected: [],
      onQualityReport: [],
      onPoorConnection: [],
    };
    this.pcCreatedCount = 0;
    this.pcClosedCount = 0;
    this.activePCCount = 0;
    this.initializationCount = 0;
    this.currentCallId = null;
    this.pendingCandidates = [];
    this.maxBufferedCandidates = 100;
    this.processedCandidateSignatures = new Set();
    this.isSettingRemoteDescription = false;
    this.currentNegotiationGeneration = 0;
    this.isNegotiating = false;
    this.negotiationQueue = [];
    this.hasRemoteAudio = false;
    this.hasRemoteVideo = false;
    this.mediaReadyEmitted = false;
    this.isReconnecting = false;
    this.expectedCallType = 'audio';
    this.forceRelayOnly = false;
    this.connectionWatchdogTimer = null;
    this.qualityMonitorTimer = null;
    this.lastSelectedCandidatePair = null;
    this.localCandidateCounts = { host: 0, srflx: 0, relay: 0 };
    this.remoteCandidateCounts = { host: 0, srflx: 0, relay: 0 };
    this.iceGatheringHistory = [];
    this.iceConnectionHistory = [];
    this.connectionStateHistory = [];
    this.selectedCandidatePair = null;
    this.dtlsState = null;
    this.rtpStats = {
      audio: { outbound: { packetsSent: 0, bytesSent: 0 }, inbound: { packetsReceived: 0, bytesReceived: 0 } },
      video: {
        outbound: { packetsSent: 0, bytesSent: 0 },
        inbound: {
          packetsReceived: 0,
          bytesReceived: 0,
          framesDecoded: 0,
          framesReceived: 0,
          frameWidth: 0,
          frameHeight: 0,
          framesPerSecond: 0,
        },
      },
    };
  }

  setForceRelayOnly(enabled) {
    this.forceRelayOnly = Boolean(enabled);
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return () => {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
      }
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.warn(`[WEBRTC EVENT ERROR ${event}]:`, e);
        }
      });
    }
  }

  /**
   * Fetch authenticated short-lived TURN credentials from backend
   */
  async fetchIceServers() {
    try {
      const res = await api.get('/calls/turn-credentials');
      const creds = res.data?.data || res.data;
      if (creds?.iceServers && Array.isArray(creds.iceServers) && creds.iceServers.length > 0) {
        this.iceServers = creds.iceServers;
        return this.iceServers;
      }
    } catch (err) {
      console.warn('[WEBRTC] Primary /calls/turn-credentials failed, trying fallback:', err.message);
      try {
        const fallbackRes = await api.get('/calls/ice-servers');
        const fallbackCreds = fallbackRes.data?.data || fallbackRes.data;
        if (fallbackCreds?.iceServers && Array.isArray(fallbackCreds.iceServers) && fallbackCreds.iceServers.length > 0) {
          this.iceServers = fallbackCreds.iceServers;
          return this.iceServers;
        }
      } catch (fallbackErr) {
        console.error('[WEBRTC] Failed to fetch dynamic TURN credentials, using default STUN:', fallbackErr.message);
      }
    }
    return this.iceServers;
  }

  /**
   * Initialize Local Media Stream
   */
  async initializeLocalMedia({ video = false, audio = true } = {}) {
    this.isVideoEnabled = Boolean(video);
    this.isAudioMuted = !audio;
    this.expectedCallType = video ? 'video' : 'audio';

    // Verify and request Android runtime permissions
    if (PlatformNative.OS === 'android' && PermissionsAndroidNative) {
      try {
        const permsToRequest = [PermissionsAndroidNative.PERMISSIONS.RECORD_AUDIO];
        if (video) permsToRequest.push(PermissionsAndroidNative.PERMISSIONS.CAMERA);

        const granted = await PermissionsAndroidNative.requestMultiple(permsToRequest);
        const audioOk = granted[PermissionsAndroidNative.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroidNative.RESULTS.GRANTED;
        if (!audioOk) {
          throw new Error('PERMISSION_DENIED_MICROPHONE: Microphone permission is required for calling.');
        }
        if (video && granted[PermissionsAndroidNative.PERMISSIONS.CAMERA] !== PermissionsAndroidNative.RESULTS.GRANTED) {
          throw new Error('PERMISSION_DENIED_CAMERA: Camera permission is required for video calling.');
        }
      } catch (permErr) {
        if (permErr.message?.startsWith('PERMISSION_DENIED')) throw permErr;
        console.warn('[AUDIO DEBUG] Permissions request check warning:', permErr.message);
      }
    }

    const mediaDevicesObj = mediaDevicesNative || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);

    if (mediaDevicesObj && typeof mediaDevicesObj.getUserMedia === 'function') {
      try {
        const constraints = {
          audio: true,
          video: video ? { facingMode: this.isFrontCamera ? 'user' : 'environment' } : false,
        };
        this.localStream = await mediaDevicesObj.getUserMedia(constraints);

        // Verify local audio and video tracks
        const audioTracks = this.localStream.getAudioTracks ? this.localStream.getAudioTracks() : this.localStream.getTracks().filter((t) => t.kind === 'audio');
        if (audioTracks.length === 0) {
          throw new Error('NO_AUDIO_TRACK: Local media stream contains no audio track.');
        }
        audioTracks[0].enabled = !this.isAudioMuted;

        if (video) {
          const videoTracks = this.localStream.getVideoTracks ? this.localStream.getVideoTracks() : this.localStream.getTracks().filter((t) => t.kind === 'video');
          if (videoTracks.length === 0) {
            throw new Error('NO_VIDEO_TRACK: Local media stream contains no video track for video call.');
          }
          videoTracks[0].enabled = this.isVideoEnabled;
        }

        console.log('[AUDIO DEBUG] Local media initialized:', {
          platform: PlatformNative.OS,
          callType: this.expectedCallType,
          audioTrackExists: audioTracks.length > 0,
          audioTrackEnabled: audioTracks[0].enabled,
          audioTrackState: audioTracks[0].readyState || 'live',
          videoTrackExists: video ? (this.localStream.getVideoTracks ? this.localStream.getVideoTracks().length > 0 : false) : false,
        });

        this.ensureLocalTracksAttached();
        this.emit('onLocalStream', this.localStream);
        return this.localStream;
      } catch (err) {
        if (process.env.EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true') {
          console.warn('[WEBRTC] Hardware media stream capture unavailable, using dev simulation:', err.message);
          this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
          this.ensureLocalTracksAttached();
          this.emit('onLocalStream', this.localStream);
          return this.localStream;
        }
        throw new Error(`MEDIA_CAPTURE_FAILED: ${err.message}. Ensure microphone and camera permissions are granted.`);
      }
    } else {
      if (process.env.EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true') {
        console.log('[WEBRTC] Simulation mode enabled: Initializing simulated media stream.');
        this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
        this.ensureLocalTracksAttached();
        this.emit('onLocalStream', this.localStream);
        return this.localStream;
      }
      throw new Error(
        'NATIVE_WEBRTC_REQUIRED: Real device calling requires an Expo Development Build (npx expo run:android or run:ios). Standard Expo Go does not contain compiled react-native-webrtc native modules.'
      );
    }
  }

  /**
   * Ensure all local tracks (audio and video) are attached to active PeerConnection senders
   */
  ensureLocalTracksAttached() {
    if (!this.peerConnection || !this.localStream || typeof this.localStream.getTracks !== 'function') {
      return;
    }
    const localTracks = this.localStream.getTracks();
    const senders = typeof this.peerConnection.getSenders === 'function' ? this.peerConnection.getSenders() : [];

    localTracks.forEach((track) => {
      const existingSender = senders.find((s) => s.track && s.track.id === track.id);
      if (!existingSender) {
        try {
          if (typeof this.peerConnection.addTrack === 'function') {
            console.log(`[WEBRTC] Attaching local track to peerConnection: kind=${track.kind}, id=${track.id}`);
            this.peerConnection.addTrack(track, this.localStream);
          } else if (typeof this.peerConnection.addStream === 'function') {
            this.peerConnection.addStream(this.localStream);
          }
        } catch (err) {
          console.warn(`[WEBRTC] Error attaching track ${track.kind}:`, err.message);
        }
      } else {
        console.log(`[WEBRTC] Track ${track.kind}:${track.id} already attached to sender.`);
      }
    });
  }

  /**
   * Initialize RTCPeerConnection with dynamic ICE configuration and transport watchdog
   */
  async createPeerConnection({ callType = 'audio', callId = null } = {}) {
    if (callId) this.currentCallId = callId;
    this.expectedCallType = callType;
    this.initializationCount = (this.initializationCount || 0) + 1;

    // Singleton PeerConnection: If an active connection exists, safely close and replace it
    if (this.peerConnection && !this.peerConnection._closed && this.peerConnection.connectionState !== 'closed') {
      console.warn('[CALL_PC_DEBUG] Active PeerConnection already exists; closing prior instance before re-creation:', {
        callId: this.currentCallId ? `${String(this.currentCallId).substring(0, 8)}...` : 'unknown',
        initializationCount: this.initializationCount,
        pcCreated: this.pcCreatedCount || 0,
        pcClosed: (this.pcClosedCount || 0) + 1,
        activePCCount: 0,
      });
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
      this.pcClosedCount = (this.pcClosedCount || 0) + 1;
      this.activePCCount = 0;
    }

    this.mediaReadyEmitted = false;
    this.hasRemoteAudio = false;
    this.hasRemoteVideo = false;
    this.currentNegotiationGeneration += 1;
    this.pendingCandidates = [];
    this.processedCandidateSignatures.clear();
    this.isSettingRemoteDescription = false;
    this.localCandidateCounts = { host: 0, srflx: 0, relay: 0 };
    this.remoteCandidateCounts = { host: 0, srflx: 0, relay: 0 };
    this.iceGatheringHistory = [];
    this.iceConnectionHistory = [];
    this.connectionStateHistory = [];
    this.selectedCandidatePair = null;
    this.dtlsState = null;
    this.isReconnecting = false;
    this.rtpStats = {
      audio: { outbound: { packetsSent: 0, bytesSent: 0 }, inbound: { packetsReceived: 0, bytesReceived: 0 } },
      video: {
        outbound: { packetsSent: 0, bytesSent: 0 },
        inbound: {
          packetsReceived: 0,
          bytesReceived: 0,
          framesDecoded: 0,
          framesReceived: 0,
          frameWidth: 0,
          frameHeight: 0,
          framesPerSecond: 0,
        },
      },
    };

    await this.fetchIceServers();

    const RTCPC = RTCPeerConnectionNative || (typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : null);

    if (!RTCPC) {
      if (process.env.EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true') {
        console.log('[WEBRTC] Simulation mode enabled: Using simulated peer connection.');
        this.peerConnection = new SimulatedRTCPeerConnection({ iceServers: this.iceServers });
      } else {
        throw new Error(
          'NATIVE_WEBRTC_REQUIRED: RTCPeerConnection native binary not loaded. Real calling requires an Expo Development Build (npx expo run:android or run:ios).'
        );
      }
    } else {
      const pcConfig = {
        iceServers: this.iceServers,
        iceCandidatePoolSize: 2,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      };

      if (this.forceRelayOnly && process.env.NODE_ENV !== 'production') {
        pcConfig.iceTransportPolicy = 'relay';
      }

      this.peerConnection = new RTCPC(pcConfig);
    }

    this.pcCreatedCount = (this.pcCreatedCount || 0) + 1;
    this.activePCCount = 1;
    console.log('[CALL_PC_DEBUG] Created active PeerConnection:', {
      callId: this.currentCallId ? `${String(this.currentCallId).substring(0, 8)}...` : 'unknown',
      initializationCount: this.initializationCount,
      pcCreated: this.pcCreatedCount,
      pcClosed: this.pcClosedCount || 0,
      activePCCount: this.activePCCount,
      callType: this.expectedCallType,
    });

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this._recordCandidateTelemetry('local', event.candidate);
        this.emit('onIceCandidate', {
          candidate: event.candidate,
          generation: this.currentNegotiationGeneration,
        });
      }
    };

    // Track ICE Gathering State
    this.peerConnection.onicegatheringstatechange = () => {
      if (!this.peerConnection) return;
      const gatheringState = this.peerConnection.iceGatheringState;
      if (gatheringState) {
        this.iceGatheringHistory.push(gatheringState);
        console.log(`[WEBRTC TELEMETRY] iceGatheringState -> ${gatheringState}`);
        if (gatheringState === 'gathering') {
          callDiagnosticsService.recordTimelineEvent('T8');
        } else if (gatheringState === 'complete') {
          callDiagnosticsService.recordTimelineEvent('T9');
        }
      }
    };

    // Honest Transport Connection State & Media Readiness
    const checkStateAndReadiness = () => {
      if (!this.peerConnection) return;
      const connState = this.peerConnection.connectionState;
      const iceState = this.peerConnection.iceConnectionState;
      if (connState) this.connectionStateHistory.push(connState);
      if (iceState) this.iceConnectionHistory.push(iceState);
      console.log(`[WEBRTC] State changed: connState=${connState}, iceState=${iceState}`);
      this.emit('onConnectionStateChange', { connectionState: connState, iceConnectionState: iceState });

      if (iceState === 'connected' || iceState === 'completed') {
        callDiagnosticsService.recordTimelineEvent('T10');
      }
      if (this.dtlsState === 'connected' || connState === 'connected') {
        callDiagnosticsService.recordTimelineEvent('T11');
      }

      const isTransportReady = connState === 'connected' || iceState === 'connected' || iceState === 'completed';

      if (isTransportReady) {
        if (!this.mediaReadyEmitted) {
          this.mediaReadyEmitted = true;
          callDiagnosticsService.recordTimelineEvent('T16');
          this.clearConnectionWatchdog();
          console.log('[WEBRTC] Real WebRTC transport connection confirmed! Emitting onMediaReady.');
          this.emit('onMediaReady', { ready: true });
          this.startQualityMonitoring();
        } else if (this.isReconnecting) {
          this.isReconnecting = false;
          callDiagnosticsService.recordEvent('reconnect');
          console.log('[WEBRTC] Real WebRTC transport reconnected! Emitting onConnectionReconnected.');
          this.emit('onConnectionReconnected', { connState, iceState });
        }
      }

      if (connState === 'disconnected' || iceState === 'disconnected') {
        this.isReconnecting = true;
        callDiagnosticsService.recordEvent('reconnecting');
        console.warn('[WEBRTC] Connection interrupted: transport disconnected. Attempting ICE recovery...');
        this.emit('onConnectionReconnecting', { connState, iceState });
      }

      if (connState === 'failed' || iceState === 'failed') {
        console.error('[WEBRTC] Connection failed: ICE transport failed to connect.');
        this.clearConnectionWatchdog();
        callDiagnosticsService.recordEvent('failure');
        callDiagnosticsService.classifyFailure('ICE_FAILED');
        this.emit('onConnectionFailed', { reason: 'ICE_FAILED', connState, iceState });
      }
    };

    this.peerConnection.onconnectionstatechange = checkStateAndReadiness;
    this.peerConnection.oniceconnectionstatechange = checkStateAndReadiness;

    // Handle Legacy/Compat Remote Stream via onaddstream
    this.peerConnection.onaddstream = (event) => {
      console.log('[WEBRTC] onaddstream event received:', event.stream?.id);
      if (event.stream) {
        this.remoteStream = event.stream;
        const videoTracks = this.remoteStream.getVideoTracks ? this.remoteStream.getVideoTracks() : [];
        const audioTracks = this.remoteStream.getAudioTracks ? this.remoteStream.getAudioTracks() : [];
        if (videoTracks.length > 0) this.hasRemoteVideo = true;
        if (audioTracks.length > 0) this.hasRemoteAudio = true;

        this.emit('onRemoteStream', this.remoteStream);
        if (videoTracks.length > 0) {
          this.emit('onRemoteTrack', { track: videoTracks[0], kind: 'video', stream: this.remoteStream });
        }
        checkStateAndReadiness();
      }
    };

    // Handle Remote Stream (Standardized OMS Pattern)
    this.peerConnection.ontrack = (event) => {
      const trackKind = event.track?.kind;
      console.log(`[WEBRTC] Remote track received: kind=${trackKind}, id=${event.track?.id}`);

      if (trackKind === 'audio') {
        this.hasRemoteAudio = true;
        callDiagnosticsService.recordTimelineEvent('T14');
        if (event.track) {
          event.track.enabled = true;
          event.track.onended = () => {
            console.log(`[AUDIO DEBUG] Remote audio track ended (id: ${event.track?.id})`);
          };
        }
      } else if (trackKind === 'video') {
        this.hasRemoteVideo = true;
        callDiagnosticsService.recordTimelineEvent('T15');
        if (event.track) {
          event.track.enabled = true;
          event.track.onended = () => {
            console.log(`[WEBRTC] Remote video track ended (id: ${event.track?.id})`);
          };
        }
      }

      const MediaStreamCtor = MediaStreamNative || (typeof MediaStream !== 'undefined' ? MediaStream : null);

      if (event.streams && event.streams[0]) {
        const incomingStream = event.streams[0];
        if (!this.remoteStream) {
          this.remoteStream = incomingStream;
        } else {
          // If incoming stream has video tracks and current doesn't, adopt incoming stream
          const incomingVideo = incomingStream.getVideoTracks ? incomingStream.getVideoTracks() : [];
          const currentVideo = this.remoteStream.getVideoTracks ? this.remoteStream.getVideoTracks() : [];
          if (incomingVideo.length > 0 && currentVideo.length === 0) {
            console.log('[WEBRTC] Adopting incoming stream with video tracks:', incomingStream.id);
            this.remoteStream = incomingStream;
          }
        }
        if (typeof this.remoteStream.addTrack === 'function' && event.track) {
          const existing = this.remoteStream.getTracks ? this.remoteStream.getTracks() : [];
          if (!existing.some((t) => t.id === event.track.id)) {
            try { this.remoteStream.addTrack(event.track); } catch (e) {
              console.warn('[WEBRTC] remoteStream.addTrack warning:', e.message);
            }
          }
        }
      } else if (event.track) {
        // Track delivered without stream wrapper
        if (!this.remoteStream) {
          if (MediaStreamCtor) {
            this.remoteStream = new MediaStreamCtor();
          } else if (process.env.EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true') {
            this.remoteStream = new SimulatedMediaStream(this.expectedCallType);
          } else {
            throw new Error('NATIVE_MEDIA_STREAM_REQUIRED: Failed to construct native MediaStream for remote track.');
          }
        }
        if (typeof this.remoteStream.addTrack === 'function') {
          const existing = this.remoteStream.getTracks ? this.remoteStream.getTracks() : [];
          if (!existing.some((t) => t.id === event.track.id)) {
            this.remoteStream.addTrack(event.track);
          }
        }
      }

      console.log('[WEBRTC] Remote track event diagnostics:', {
        trackKind,
        trackEnabled: event.track?.enabled,
        trackReadyState: event.track?.readyState || 'live',
        remoteStreamId: this.remoteStream?.id || (typeof this.remoteStream?.toURL === 'function' ? this.remoteStream.toURL() : null),
        audioTracksCount: this.remoteStream?.getAudioTracks ? this.remoteStream.getAudioTracks().length : 0,
        videoTracksCount: this.remoteStream?.getVideoTracks ? this.remoteStream.getVideoTracks().length : 0,
      });

      if (this.remoteStream) {
        this.emit('onRemoteStream', this.remoteStream);
      }
      if (event.track) {
        this.emit('onRemoteTrack', { track: event.track, kind: trackKind, stream: this.remoteStream });
      }
      checkStateAndReadiness();
    };

    // Add Local Tracks to PeerConnection
    if (this.localStream && typeof this.localStream.getTracks === 'function') {
      const localTracks = this.localStream.getTracks();
      console.log(`[AUDIO DEBUG] Adding ${localTracks.length} local track(s) to peerConnection:`, localTracks.map((t) => `${t.kind}:${t.id}`));
      localTracks.forEach((track) => {
        if (typeof this.peerConnection.addTrack === 'function') {
          this.peerConnection.addTrack(track, this.localStream);
        } else if (typeof this.peerConnection.addStream === 'function') {
          this.peerConnection.addStream(this.localStream);
        }
      });
    }

    // Set 15-second Connection Watchdog Timeout
    this.armConnectionWatchdog(15000);

    return this.peerConnection;
  }

  armConnectionWatchdog(timeoutMs = 15000) {
    this.clearConnectionWatchdog();
    this.connectionWatchdogTimer = setTimeout(() => {
      if (!this.mediaReadyEmitted && this.peerConnection) {
        const ice = this.peerConnection.iceConnectionState;
        const conn = this.peerConnection.connectionState;
        console.warn(`[WEBRTC] Connection watchdog expired after ${timeoutMs}ms. State: conn=${conn}, ice=${ice}`);
        this.emit('onConnectionFailed', {
          reason: 'CONNECTION_TIMEOUT',
          message: "Couldn't connect — check your connection",
          connState: conn,
          iceState: ice,
        });
      }
    }, timeoutMs);
  }

  clearConnectionWatchdog() {
    if (this.connectionWatchdogTimer) {
      clearTimeout(this.connectionWatchdogTimer);
      this.connectionWatchdogTimer = null;
    }
  }

  /**
   * Helper to serialize negotiation tasks
   */
  async _serializeNegotiation(fn) {
    if (this.isNegotiating) {
      return new Promise((resolve, reject) => {
        this.negotiationQueue.push(async () => {
          try {
            const res = await fn();
            resolve(res);
          } catch (err) {
            reject(err);
          }
        });
      });
    }

    this.isNegotiating = true;
    try {
      const result = await fn();
      return result;
    } finally {
      this.isNegotiating = false;
      if (this.negotiationQueue.length > 0) {
        const next = this.negotiationQueue.shift();
        next();
      }
    }
  }

  /**
   * Create SDP Offer (Caller side)
   */
  async createOffer() {
    return this._serializeNegotiation(async () => {
      if (!this.peerConnection || this.peerConnection._closed || this.peerConnection.connectionState === 'closed') {
        await this.createPeerConnection({ callType: this.expectedCallType });
      }
      this.ensureLocalTracksAttached();
      callDiagnosticsService.recordTimelineEvent('T4');
      const isVideoCall = Boolean(this.isVideoEnabled || this.expectedCallType === 'video');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall,
      });
      await this.peerConnection.setLocalDescription(offer);
      callDiagnosticsService.recordTimelineEvent('T5');
      return {
        sdp: offer.sdp || offer,
        type: offer.type || 'offer',
        generation: this.currentNegotiationGeneration,
      };
    });
  }

  /**
   * Handle Remote SDP Offer and create SDP Answer (Receiver side)
   * Note: Premature fake timers have been removed; onMediaReady is emitted strictly on real transport state
   */
  /**
   * Normalize an incoming ICE candidate from any socket/client wrapper format into a standard
   * RTCIceCandidate-compatible dictionary: { candidate: string, sdpMid: string | null, sdpMLineIndex: number | null }
   * Preserves nulls, ensures non-null sdpMLineIndex fallback (to avoid react-native-webrtc TypeError),
   * and preserves negotiation generation and usernameFragment.
   */
  _normalizeCandidate(candidateData) {
    if (!candidateData) return null;

    let candStr = null;
    let sdpMid = null;
    let sdpMLineIndex = null;
    let ufrag = null;
    let generation = candidateData.generation;

    if (typeof candidateData === 'object') {
      if (candidateData.candidate && typeof candidateData.candidate === 'object') {
        const inner = candidateData.candidate;
        candStr = typeof inner.candidate === 'string' ? inner.candidate : null;
        sdpMid = inner.sdpMid !== undefined ? inner.sdpMid : null;
        sdpMLineIndex = inner.sdpMLineIndex !== undefined ? inner.sdpMLineIndex : null;
        ufrag = inner.usernameFragment || inner.ufrag || null;
        if (generation === undefined) generation = inner.generation;
      } else if (typeof candidateData.candidate === 'string') {
        candStr = candidateData.candidate;
        sdpMid = candidateData.sdpMid !== undefined ? candidateData.sdpMid : null;
        sdpMLineIndex = candidateData.sdpMLineIndex !== undefined ? candidateData.sdpMLineIndex : null;
        ufrag = candidateData.usernameFragment || candidateData.ufrag || null;
      }
    } else if (typeof candidateData === 'string') {
      candStr = candidateData;
    }

    if (sdpMid === null && candidateData && candidateData.sdpMid !== undefined) {
      sdpMid = candidateData.sdpMid;
    }
    if (sdpMLineIndex === null && candidateData && candidateData.sdpMLineIndex !== undefined) {
      sdpMLineIndex = candidateData.sdpMLineIndex;
    }

    if (candStr === null || candStr === undefined) {
      return null;
    }

    if (sdpMLineIndex !== null && sdpMLineIndex !== undefined) {
      const parsed = parseInt(sdpMLineIndex, 10);
      sdpMLineIndex = Number.isNaN(parsed) ? null : parsed;
    } else {
      sdpMLineIndex = null;
    }

    if (sdpMid !== null && sdpMid !== undefined) {
      sdpMid = String(sdpMid);
    } else {
      sdpMid = null;
    }

    // react-native-webrtc requires: sdpMLineIndex and sdpMid must not be both null
    if (candStr && sdpMid === null && sdpMLineIndex === null) {
      sdpMLineIndex = 0;
    }

    const normalized = {
      candidate: candStr,
      sdpMid,
      sdpMLineIndex,
    };
    if (ufrag) {
      normalized.usernameFragment = ufrag;
    }

    return { normalized, generation };
  }

  /**
   * Record sanitized ICE candidate telemetry by type (host, srflx, relay) without exposing IP addresses
   */
  _recordCandidateTelemetry(direction, candidateObj) {
    if (!candidateObj) return;
    const candStr = typeof candidateObj === 'string' ? candidateObj : candidateObj.candidate;
    if (!candStr || typeof candStr !== 'string') return;

    let candType = 'unknown';
    if (candStr.includes(' typ host')) {
      candType = 'host';
    } else if (candStr.includes(' typ srflx')) {
      candType = 'srflx';
    } else if (candStr.includes(' typ relay')) {
      candType = 'relay';
    }

    if (direction === 'local' && this.localCandidateCounts[candType] !== undefined) {
      this.localCandidateCounts[candType] += 1;
      console.log(`[WEBRTC TELEMETRY] Local ICE candidate gathered: type=${candType} (counts: host=${this.localCandidateCounts.host}, srflx=${this.localCandidateCounts.srflx}, relay=${this.localCandidateCounts.relay})`);
    } else if (direction === 'remote' && this.remoteCandidateCounts[candType] !== undefined) {
      this.remoteCandidateCounts[candType] += 1;
      console.log(`[WEBRTC TELEMETRY] Remote ICE candidate received: type=${candType} (counts: host=${this.remoteCandidateCounts.host}, srflx=${this.remoteCandidateCounts.srflx}, relay=${this.remoteCandidateCounts.relay})`);
    }
  }

  /**
   * Return comprehensive sanitized WebRTC media-plane telemetry summary
   */
  getTelemetrySummary() {
    return {
      candidateCounts: {
        local: { ...this.localCandidateCounts },
        remote: { ...this.remoteCandidateCounts },
      },
      states: {
        gathering: this.peerConnection?.iceGatheringState || (this.iceGatheringHistory[this.iceGatheringHistory.length - 1] || null),
        iceConnection: this.peerConnection?.iceConnectionState || (this.iceConnectionHistory[this.iceConnectionHistory.length - 1] || null),
        connection: this.peerConnection?.connectionState || (this.connectionStateHistory[this.connectionStateHistory.length - 1] || null),
        dtls: this.dtlsState || (this.peerConnection?.connectionState === 'connected' ? 'connected' : null),
      },
      selectedCandidatePair: this.selectedCandidatePair,
      rtpStats: {
        audio: {
          outbound: { ...this.rtpStats.audio.outbound },
          inbound: { ...this.rtpStats.audio.inbound },
        },
        video: {
          outbound: { ...this.rtpStats.video.outbound },
          inbound: { ...this.rtpStats.video.inbound },
        },
      },
      diagnostics: callDiagnosticsService.exportEvidenceReport('LIVE_SUMMARY'),
    };
  }

  /**
   * Check if the peer connection has a valid remote description applied and is ready for ICE candidates
   */
  _isRemoteDescriptionReady() {
    if (!this.peerConnection) return false;
    if (this.isSettingRemoteDescription) return false;
    const rd = this.peerConnection.remoteDescription;
    return Boolean(rd && rd.type && rd.sdp);
  }

  /**
   * Handle Remote SDP Offer and create SDP Answer (Receiver side)
   * Note: Premature fake timers have been removed; onMediaReady is emitted strictly on real transport state
   */
  async handleOfferAndCreateAnswer(remoteOffer) {
    return this._serializeNegotiation(async () => {
      if (!this.peerConnection || this.peerConnection._closed || this.peerConnection.connectionState === 'closed') {
        await this.createPeerConnection({ callType: this.expectedCallType });
      }

      let offerInit;
      if (typeof remoteOffer === 'string') {
        offerInit = { type: 'offer', sdp: remoteOffer };
      } else if (remoteOffer && typeof remoteOffer === 'object') {
        offerInit = {
          type: remoteOffer.type || 'offer',
          sdp: remoteOffer.sdp || remoteOffer,
        };
      } else {
        throw new Error('Invalid remoteOffer format');
      }

      // Guard against duplicate offer with identical SDP
      if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.sdp === offerInit.sdp) {
        console.log('[WEBRTC] Duplicate offer received with identical SDP; skipping duplicate setRemoteDescription.');
        return;
      }

      callDiagnosticsService.recordTimelineEvent('T6');
      const RTCSD = RTCSessionDescriptionNative || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
      const sessionDesc = RTCSD ? new RTCSD(offerInit) : offerInit;

      this.isSettingRemoteDescription = true;
      try {
        await this.peerConnection.setRemoteDescription(sessionDesc);
        callDiagnosticsService.recordTimelineEvent('T7');
      } finally {
        this.isSettingRemoteDescription = false;
      }

      // Flush queued candidates after remote description successfully set
      await this._drainPendingCandidates();

      // Ensure local tracks are attached before generating the answer SDP
      this.ensureLocalTracksAttached();

      // Ensure transceivers are configured to sendrecv for two-way video
      if (typeof this.peerConnection.getTransceivers === 'function') {
        const isVideoCall = Boolean(this.isVideoEnabled || this.expectedCallType === 'video');
        this.peerConnection.getTransceivers().forEach((transceiver) => {
          if (transceiver.receiver && transceiver.receiver.track) {
            if (transceiver.receiver.track.kind === 'video') {
              transceiver.direction = isVideoCall ? 'sendrecv' : 'recvonly';
            } else if (transceiver.receiver.track.kind === 'audio') {
              transceiver.direction = 'sendrecv';
            }
          }
        });
      }

      callDiagnosticsService.recordTimelineEvent('T4');
      const isVideoCall = Boolean(this.isVideoEnabled || this.expectedCallType === 'video');
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideoCall,
      });
      await this.peerConnection.setLocalDescription(answer);
      callDiagnosticsService.recordTimelineEvent('T5');

      return {
        sdp: answer.sdp || answer,
        type: answer.type || 'answer',
        generation: this.currentNegotiationGeneration,
      };
    });
  }

  /**
   * Set Remote SDP Answer (Caller side)
   */
  async handleAnswer(remoteAnswer) {
    return this._serializeNegotiation(async () => {
      if (!this.peerConnection) return;

      // Guard against invalid signaling state (e.g. duplicate answer after connection has reached 'stable')
      if (this.peerConnection.signalingState && this.peerConnection.signalingState !== 'have-local-offer') {
        console.log(`[WEBRTC] Ignoring answer: peerConnection signalingState is "${this.peerConnection.signalingState}", expected "have-local-offer"`);
        return;
      }

      let answerInit;
      if (typeof remoteAnswer === 'string') {
        answerInit = { type: 'answer', sdp: remoteAnswer };
      } else if (remoteAnswer && typeof remoteAnswer === 'object') {
        answerInit = {
          type: remoteAnswer.type || 'answer',
          sdp: remoteAnswer.sdp || remoteAnswer,
        };
      } else {
        throw new Error('Invalid remoteAnswer format');
      }

      callDiagnosticsService.recordTimelineEvent('T6');
      const RTCSD = RTCSessionDescriptionNative || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
      const sessionDesc = RTCSD ? new RTCSD(answerInit) : answerInit;

      this.isSettingRemoteDescription = true;
      try {
        await this.peerConnection.setRemoteDescription(sessionDesc);
        callDiagnosticsService.recordTimelineEvent('T7');
      } finally {
        this.isSettingRemoteDescription = false;
      }

      // Flush queued candidates after remote description successfully set
      await this._drainPendingCandidates();
    });
  }

  /**
   * Trigger ICE Restart (WhatsApp/Instagram parity recovery)
   */
  async restartIce() {
    if (!this.peerConnection) return null;
    console.log('[WEBRTC] Triggering ICE restart negotiation...');
    this.currentNegotiationGeneration += 1;
    return this._serializeNegotiation(async () => {
      const offer = await this.peerConnection.createOffer({
        iceRestart: true,
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideoEnabled,
      });
      await this.peerConnection.setLocalDescription(offer);
      return {
        sdp: offer.sdp || offer,
        type: offer.type || 'offer',
        generation: this.currentNegotiationGeneration,
        iceRestart: true,
      };
    });
  }

  /**
   * Add Remote ICE Candidate with generation check, normalization, deduplication, and bounded buffering
   */
  async addIceCandidate(candidateData) {
    if (!candidateData) return;

    const parsed = this._normalizeCandidate(candidateData);
    if (!parsed) {
      console.warn('[WEBRTC] Unable to normalize remote ICE candidate payload:', candidateData);
      return;
    }

    const { normalized, generation } = parsed;
    this._recordCandidateTelemetry('remote', normalized);

    // Drop stale candidate if generation is provided and less than current
    if (generation !== undefined && generation < this.currentNegotiationGeneration) {
      console.log(`[WEBRTC] Dropping stale ICE candidate from generation ${generation} (current: ${this.currentNegotiationGeneration})`);
      return;
    }

    // Deduplicate candidates
    const sig = `${normalized.candidate}|${normalized.sdpMid}|${normalized.sdpMLineIndex}`;
    if (this.processedCandidateSignatures.has(sig)) {
      return;
    }
    this.processedCandidateSignatures.add(sig);

    // If remote description is ready and not currently in-flight, add candidate immediately
    if (this._isRemoteDescriptionReady()) {
      try {
        const RTCIce = RTCIceCandidateNative || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);
        const iceCandidate = RTCIce ? new RTCIce(normalized) : normalized;
        await this.peerConnection.addIceCandidate(iceCandidate);
      } catch (err) {
        console.warn('[WEBRTC] Add ICE candidate warning:', err.message);
      }
    } else {
      // Buffer early candidate until setRemoteDescription completes
      if (this.pendingCandidates.length < this.maxBufferedCandidates) {
        this.pendingCandidates.push(normalized);
        console.log(`[WEBRTC] Queued early ICE candidate (buffer count: ${this.pendingCandidates.length}, mLineIndex: ${normalized.sdpMLineIndex}, sdpMid: ${normalized.sdpMid})`);
      } else {
        console.warn(`[WEBRTC] ICE candidate buffer limit reached (${this.maxBufferedCandidates}), dropping candidate.`);
      }
    }
  }

  async _drainPendingCandidates() {
    if (!this.peerConnection || !this._isRemoteDescriptionReady()) {
      return;
    }

    if (this.pendingCandidates.length === 0) {
      return;
    }

    const candidatesToDrain = [...this.pendingCandidates];
    this.pendingCandidates = [];

    console.log(`[WEBRTC] Flushing ${candidatesToDrain.length} queued ICE candidate(s)...`);

    const RTCIce = RTCIceCandidateNative || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);

    for (const cand of candidatesToDrain) {
      if (!this.peerConnection) break;
      try {
        const iceCandidate = RTCIce ? new RTCIce(cand) : cand;
        await this.peerConnection.addIceCandidate(iceCandidate);
        console.log(`[WEBRTC] Successfully applied queued ICE candidate (mLineIndex: ${cand.sdpMLineIndex}, sdpMid: ${cand.sdpMid})`);
      } catch (err) {
        console.warn('[WEBRTC] Drain addIceCandidate error:', err.message);
      }
    }
  }

  /**
   * Toggle Audio Mute
   */
  toggleAudio(muteState = null) {
    this.isAudioMuted = muteState !== null ? muteState : !this.isAudioMuted;
    if (this.localStream && typeof this.localStream.getAudioTracks === 'function') {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isAudioMuted;
      });
    }
    return this.isAudioMuted;
  }

  /**
   * Toggle Video Camera
   */
  toggleVideo(videoState = null) {
    this.isVideoEnabled = videoState !== null ? videoState : !this.isVideoEnabled;
    if (this.localStream && typeof this.localStream.getVideoTracks === 'function') {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }
    return this.isVideoEnabled;
  }

  /**
   * Switch Camera between Front and Back (OMS native track._switchCamera pattern)
   */
  async switchCamera() {
    if (this.localStream && typeof this.localStream.getVideoTracks === 'function') {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0 && typeof videoTracks[0]._switchCamera === 'function') {
        videoTracks[0]._switchCamera();
        this.isFrontCamera = !this.isFrontCamera;
        return this.isFrontCamera;
      }
    }

    // Fallback: re-acquire camera track and replace on senders
    this.isFrontCamera = !this.isFrontCamera;
    const mediaDevicesObj = mediaDevicesNative || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);

    if (this.localStream && mediaDevicesObj && mediaDevicesObj.getUserMedia) {
      if (typeof this.localStream.getVideoTracks === 'function') {
        this.localStream.getVideoTracks().forEach((track) => track.stop());
      }
      try {
        const newStream = await mediaDevicesObj.getUserMedia({
          audio: false,
          video: { facingMode: this.isFrontCamera ? 'user' : 'environment' },
        });
        const newVideoTrack = newStream.getVideoTracks ? newStream.getVideoTracks()[0] : null;

        if (newVideoTrack && this.peerConnection && typeof this.peerConnection.getSenders === 'function') {
          const senders = this.peerConnection.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender && typeof videoSender.replaceTrack === 'function') {
            await videoSender.replaceTrack(newVideoTrack);
          }
        }
      } catch (err) {
        console.error('[WEBRTC] Switch camera error:', err);
      }
    }
    return this.isFrontCamera;
  }

  /**
   * Start WebRTC Stats & Quality Monitoring (WhatsApp/Instagram parity)
   */
  startQualityMonitoring() {
    this.stopQualityMonitoring();
    this.qualityMonitorTimer = setInterval(async () => {
      if (!this.peerConnection || typeof this.peerConnection.getStats !== 'function') return;
      try {
        const stats = await this.peerConnection.getStats();
        let packetsLost = 0;
        let packetsReceived = 0;
        let currentRtt = null;
        let candidatePairType = null;

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            const isAudio = report.kind === 'audio' || report.mediaType === 'audio';
            const isVideo = report.kind === 'video' || report.mediaType === 'video';
            if (isAudio) {
              packetsLost = report.packetsLost || 0;
              packetsReceived = report.packetsReceived || 0;
              this.rtpStats.audio.inbound.packetsReceived = report.packetsReceived || 0;
              this.rtpStats.audio.inbound.bytesReceived = report.bytesReceived || 0;
            } else if (isVideo) {
              this.rtpStats.video.inbound.packetsReceived = report.packetsReceived || 0;
              this.rtpStats.video.inbound.bytesReceived = report.bytesReceived || 0;
              if (report.framesDecoded !== undefined) this.rtpStats.video.inbound.framesDecoded = report.framesDecoded;
              if (report.framesReceived !== undefined) this.rtpStats.video.inbound.framesReceived = report.framesReceived;
              if (report.frameWidth !== undefined) this.rtpStats.video.inbound.frameWidth = report.frameWidth;
              if (report.frameHeight !== undefined) this.rtpStats.video.inbound.frameHeight = report.frameHeight;
              if (report.framesPerSecond !== undefined) this.rtpStats.video.inbound.framesPerSecond = report.framesPerSecond;
            }
          }

          if (report.type === 'outbound-rtp') {
            const isAudio = report.kind === 'audio' || report.mediaType === 'audio';
            const isVideo = report.kind === 'video' || report.mediaType === 'video';
            if (isAudio) {
              this.rtpStats.audio.outbound.packetsSent = report.packetsSent || 0;
              this.rtpStats.audio.outbound.bytesSent = report.bytesSent || 0;
            } else if (isVideo) {
              this.rtpStats.video.outbound.packetsSent = report.packetsSent || 0;
              this.rtpStats.video.outbound.bytesSent = report.bytesSent || 0;
            }
          }

          if (report.type === 'transport') {
            this.dtlsState = report.dtlsState || 'connected';
          }

          if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated || report.selected)) {
            currentRtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : null;
            let localType = null;
            let remoteType = null;
            let transportProto = report.protocol || 'UDP';

            if (stats.get) {
              if (report.localCandidateId) {
                const localCand = stats.get(report.localCandidateId);
                if (localCand) {
                  localType = localCand.candidateType;
                  if (localCand.protocol) transportProto = localCand.protocol.toUpperCase();
                }
              }
              if (report.remoteCandidateId) {
                const remoteCand = stats.get(report.remoteCandidateId);
                if (remoteCand) {
                  remoteType = remoteCand.candidateType;
                  if (remoteCand.protocol) transportProto = remoteCand.protocol.toUpperCase();
                }
              }
            }

            this.selectedCandidatePair = {
              local: localType,
              remote: remoteType,
              transport: transportProto,
            };
            this.lastSelectedCandidatePair = remoteType || localType;
          }
        });

        if (candidatePairType) {
          this.lastSelectedCandidatePair = candidatePairType;
        }

        callDiagnosticsService.processStatsReport(stats, {
          callId: this.currentCallId,
          sessionId: this.currentCallId,
          callType: this.expectedCallType,
          isMuted: this.isAudioMuted,
          isVideoEnabled: this.isVideoEnabled,
          iceConnectionState: this.peerConnection.iceConnectionState,
          connectionState: this.peerConnection.connectionState,
          dtlsState: this.dtlsState,
        });

        const totalPackets = packetsLost + packetsReceived;
        const lossRate = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;
        const isPoor = lossRate > 15 || (currentRtt !== null && currentRtt > 600);

        this.emit('onQualityReport', {
          packetsLost,
          packetsReceived,
          lossRate: Number(lossRate.toFixed(1)),
          rttMs: currentRtt,
          candidatePairType: this.lastSelectedCandidatePair,
          isPoor,
        });

        if (isPoor) {
          this.emit('onPoorConnection', { lossRate, rttMs: currentRtt });
        }
      } catch (e) {
        // Non-fatal telemetry polling error
      }
    }, 2500);
  }

  stopQualityMonitoring() {
    if (this.qualityMonitorTimer) {
      clearInterval(this.qualityMonitorTimer);
      this.qualityMonitorTimer = null;
    }
  }

  /**
   * Fetch instantaneous RTP statistics and video frame metrics directly from peerConnection
   */
  async getRtpStats() {
    if (this.peerConnection && typeof this.peerConnection.getStats === 'function') {
      try {
        const stats = await this.peerConnection.getStats();
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            const isAudio = report.kind === 'audio' || report.mediaType === 'audio';
            const isVideo = report.kind === 'video' || report.mediaType === 'video';
            if (isAudio) {
              this.rtpStats.audio.inbound.packetsReceived = report.packetsReceived || 0;
              this.rtpStats.audio.inbound.bytesReceived = report.bytesReceived || 0;
            } else if (isVideo) {
              this.rtpStats.video.inbound.packetsReceived = report.packetsReceived || 0;
              this.rtpStats.video.inbound.bytesReceived = report.bytesReceived || 0;
              if (report.framesDecoded !== undefined) this.rtpStats.video.inbound.framesDecoded = report.framesDecoded;
              if (report.framesReceived !== undefined) this.rtpStats.video.inbound.framesReceived = report.framesReceived;
              if (report.frameWidth !== undefined) this.rtpStats.video.inbound.frameWidth = report.frameWidth;
              if (report.frameHeight !== undefined) this.rtpStats.video.inbound.frameHeight = report.frameHeight;
              if (report.framesPerSecond !== undefined) this.rtpStats.video.inbound.framesPerSecond = report.framesPerSecond;
            }
          }
          if (report.type === 'outbound-rtp') {
            const isAudio = report.kind === 'audio' || report.mediaType === 'audio';
            const isVideo = report.kind === 'video' || report.mediaType === 'video';
            if (isAudio) {
              this.rtpStats.audio.outbound.packetsSent = report.packetsSent || 0;
              this.rtpStats.audio.outbound.bytesSent = report.bytesSent || 0;
            } else if (isVideo) {
              this.rtpStats.video.outbound.packetsSent = report.packetsSent || 0;
              this.rtpStats.video.outbound.bytesSent = report.bytesSent || 0;
            }
          }
          if (report.type === 'transport') {
            this.dtlsState = report.dtlsState || 'connected';
          }
        });

        callDiagnosticsService.processStatsReport(stats, {
          callId: this.currentCallId,
          sessionId: this.currentCallId,
          callType: this.expectedCallType,
          isMuted: this.isAudioMuted,
          isVideoEnabled: this.isVideoEnabled,
          iceConnectionState: this.peerConnection.iceConnectionState,
          connectionState: this.peerConnection.connectionState,
          dtlsState: this.dtlsState,
        });
      } catch (e) {}
    }
    return JSON.parse(JSON.stringify(this.rtpStats));
  }

  getPcStats() {
    return {
      callId: this.currentCallId,
      pcCreated: this.pcCreatedCount || 0,
      pcClosed: this.pcClosedCount || 0,
      activePCCount: this.activePCCount || 0,
      initializationCount: this.initializationCount || 0,
    };
  }

  /**
   * Single idempotent cleanup method
   */
  destroy() {
    this.clearConnectionWatchdog();
    this.stopQualityMonitoring();

    if (this.localStream) {
      if (typeof this.localStream.getTracks === 'function') {
        this.localStream.getTracks().forEach((track) => {
          if (typeof track.stop === 'function') track.stop();
        });
      }
      this.localStream = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
      this.pcClosedCount = (this.pcClosedCount || 0) + 1;
      this.activePCCount = 0;
      console.log('[CALL_PC_DEBUG] PeerConnection closed via destroy():', {
        callId: this.currentCallId ? `${String(this.currentCallId).substring(0, 8)}...` : 'unknown',
        pcCreated: this.pcCreatedCount || 0,
        pcClosed: this.pcClosedCount,
        activePCCount: this.activePCCount,
      });
    }
    this.currentCallId = null;

    if (this.remoteStream) {
      if (typeof this.remoteStream.getTracks === 'function') {
        this.remoteStream.getTracks().forEach((track) => {
          if (typeof track.stop === 'function') track.stop();
        });
      }
      if (typeof this.remoteStream.release === 'function') {
        try { this.remoteStream.release(); } catch (e) {}
      }
      this.remoteStream = null;
    }
    this.pendingCandidates = [];
    this.processedCandidateSignatures.clear();
    this.isSettingRemoteDescription = false;
    this.negotiationQueue = [];
    this.isNegotiating = false;
    this.hasRemoteAudio = false;
    this.hasRemoteVideo = false;
    this.mediaReadyEmitted = false;
    this.isReconnecting = false;
    this.localCandidateCounts = { host: 0, srflx: 0, relay: 0 };
    this.remoteCandidateCounts = { host: 0, srflx: 0, relay: 0 };
    this.iceGatheringHistory = [];
    this.iceConnectionHistory = [];
    this.connectionStateHistory = [];
    this.selectedCandidatePair = null;
    this.dtlsState = null;
    this.rtpStats = {
      audio: { outbound: { packetsSent: 0, bytesSent: 0 }, inbound: { packetsReceived: 0, bytesReceived: 0 } },
      video: {
        outbound: { packetsSent: 0, bytesSent: 0 },
        inbound: {
          packetsReceived: 0,
          bytesReceived: 0,
          framesDecoded: 0,
          framesReceived: 0,
          frameWidth: 0,
          frameHeight: 0,
          framesPerSecond: 0,
        },
      },
    };
    console.log('[WEBRTC] All WebRTC resources and tracks cleanly destroyed.');
  }
}

export default new WebRTCService();
