import api from './api';

// Safely import react-native-webrtc or fallback to global/browser WebRTC
let RTCPeerConnectionNative = null;
let RTCIceCandidateNative = null;
let RTCSessionDescriptionNative = null;
let mediaDevicesNative = null;
let RTCViewNative = null;

try {
  const RNWebRTC = require('react-native-webrtc');
  RTCPeerConnectionNative = RNWebRTC.RTCPeerConnection;
  RTCIceCandidateNative = RNWebRTC.RTCIceCandidate;
  RTCSessionDescriptionNative = RNWebRTC.RTCSessionDescription;
  mediaDevicesNative = RNWebRTC.mediaDevices;
  RTCViewNative = RNWebRTC.RTCView;
} catch (e) {
  // Graceful fallback for non-native / test / mock environments
  if (typeof global !== 'undefined') {
    RTCPeerConnectionNative = global.RTCPeerConnection || null;
    RTCIceCandidateNative = global.RTCIceCandidate || null;
    RTCSessionDescriptionNative = global.RTCSessionDescription || null;
    mediaDevicesNative = global.navigator?.mediaDevices || null;
  }
}

export const RTCView = RTCViewNative;

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
      { id: 'sim_audio_' + Date.now(), kind: 'audio', enabled: true, stop: () => {} },
    ];
    if (callType === 'video') {
      this._tracks.push({ id: 'sim_video_' + Date.now(), kind: 'video', enabled: true, stop: () => {} });
    }
  }
  toURL() {
    return '';
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
    this.localDescription = null;
    this.remoteDescription = null;
    this.onicecandidate = null;
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
    this.ontrack = null;
    this._closed = false;
  }

  async createOffer(options = {}) {
    return {
      type: 'offer',
      sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\n',
    };
  }

  async createAnswer(options = {}) {
    return {
      type: 'answer',
      sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 VP8/90000\r\n',
    };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
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
    }, 50);
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
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

  close() {
    this._closed = true;
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
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
      onConnectionStateChange: [],
      onIceCandidate: [],
      onMediaReady: [],
      onConnectionFailed: [],
      onConnectionReconnecting: [],
      onQualityReport: [],
      onPoorConnection: [],
    };
    this.pendingCandidates = [];
    this.maxBufferedCandidates = 100;
    this.currentNegotiationGeneration = 0;
    this.isNegotiating = false;
    this.negotiationQueue = [];
    this.hasRemoteAudio = false;
    this.hasRemoteVideo = false;
    this.mediaReadyEmitted = false;
    this.expectedCallType = 'audio';
    this.forceRelayOnly = false;
    this.connectionWatchdogTimer = null;
    this.qualityMonitorTimer = null;
    this.lastSelectedCandidatePair = null;
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

    const mediaDevicesObj = mediaDevicesNative || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);

    if (mediaDevicesObj && typeof mediaDevicesObj.getUserMedia === 'function') {
      try {
        const constraints = {
          audio: true,
          video: video ? { facingMode: this.isFrontCamera ? 'user' : 'environment' } : false,
        };
        this.localStream = await mediaDevicesObj.getUserMedia(constraints);
        this.emit('onLocalStream', this.localStream);
        return this.localStream;
      } catch (err) {
        if (process.env.EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true') {
          console.warn('[WEBRTC] Hardware media stream capture unavailable, using dev simulation:', err.message);
          this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
          this.emit('onLocalStream', this.localStream);
          return this.localStream;
        }
        throw new Error(`MEDIA_CAPTURE_FAILED: ${err.message}. Ensure microphone and camera permissions are granted.`);
      }
    } else {
      if (process.env.EXPO_PUBLIC_ENABLE_CALL_SIMULATION === 'true') {
        console.log('[WEBRTC] Simulation mode enabled: Initializing simulated media stream.');
        this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
        this.emit('onLocalStream', this.localStream);
        return this.localStream;
      }
      throw new Error(
        'NATIVE_WEBRTC_REQUIRED: Real device calling requires an Expo Development Build (npx expo run:android or run:ios). Standard Expo Go does not contain compiled react-native-webrtc native modules.'
      );
    }
  }

  /**
   * Initialize RTCPeerConnection with dynamic ICE configuration and transport watchdog
   */
  async createPeerConnection({ callType = 'audio' } = {}) {
    this.expectedCallType = callType;
    this.mediaReadyEmitted = false;
    this.hasRemoteAudio = false;
    this.hasRemoteVideo = false;
    this.currentNegotiationGeneration += 1;

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
      };

      if (this.forceRelayOnly && process.env.NODE_ENV !== 'production') {
        pcConfig.iceTransportPolicy = 'relay';
      }

      this.peerConnection = new RTCPC(pcConfig);
    }

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('onIceCandidate', {
          candidate: event.candidate,
          generation: this.currentNegotiationGeneration,
        });
      }
    };

    // Honest Transport Connection State & Media Readiness
    const checkStateAndReadiness = () => {
      if (!this.peerConnection) return;
      const connState = this.peerConnection.connectionState;
      const iceState = this.peerConnection.iceConnectionState;
      console.log(`[WEBRTC] State changed: connState=${connState}, iceState=${iceState}`);
      this.emit('onConnectionStateChange', { connectionState: connState, iceConnectionState: iceState });

      const isTransportReady = connState === 'connected' || iceState === 'connected' || iceState === 'completed';

      if (isTransportReady && !this.mediaReadyEmitted) {
        this.mediaReadyEmitted = true;
        this.clearConnectionWatchdog();
        console.log('[WEBRTC] Real WebRTC transport connection confirmed! Emitting onMediaReady.');
        this.emit('onMediaReady', { ready: true });
        this.startQualityMonitoring();
      }

      if (connState === 'disconnected' || iceState === 'disconnected') {
        console.warn('[WEBRTC] Connection interrupted: transport disconnected. Attempting ICE recovery...');
        this.emit('onConnectionReconnecting', { connState, iceState });
      }

      if (connState === 'failed' || iceState === 'failed') {
        console.error('[WEBRTC] Connection failed: ICE transport failed to connect.');
        this.clearConnectionWatchdog();
        this.emit('onConnectionFailed', { reason: 'ICE_FAILED', connState, iceState });
      }
    };

    this.peerConnection.onconnectionstatechange = checkStateAndReadiness;
    this.peerConnection.oniceconnectionstatechange = checkStateAndReadiness;

    // Handle Remote Stream (Standardized OMS Pattern)
    this.peerConnection.ontrack = (event) => {
      console.log('[WEBRTC] Remote track received:', event.track?.kind);
      if (event.track?.kind === 'audio') {
        this.hasRemoteAudio = true;
        if (event.track) event.track.enabled = true;
      }
      if (event.track?.kind === 'video') this.hasRemoteVideo = true;

      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else if (event.track) {
        if (!this.remoteStream) {
          const MediaStreamCtor = global.MediaStream;
          if (MediaStreamCtor) {
            this.remoteStream = new MediaStreamCtor();
          } else {
            this.remoteStream = new SimulatedMediaStream(this.expectedCallType);
          }
        }
        if (typeof this.remoteStream.addTrack === 'function') {
          this.remoteStream.addTrack(event.track);
        }
      }

      if (this.remoteStream) {
        this.emit('onRemoteStream', this.remoteStream);
      }
      checkStateAndReadiness();
    };

    // Add Local Tracks to PeerConnection
    if (this.localStream && typeof this.localStream.getTracks === 'function') {
      this.localStream.getTracks().forEach((track) => {
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
      if (!this.peerConnection) await this.createPeerConnection({ callType: this.expectedCallType });
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideoEnabled,
      });
      await this.peerConnection.setLocalDescription(offer);
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
  async handleOfferAndCreateAnswer(remoteOffer) {
    return this._serializeNegotiation(async () => {
      if (!this.peerConnection) await this.createPeerConnection({ callType: this.expectedCallType });

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

      const RTCSD = RTCSessionDescriptionNative || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
      const sessionDesc = RTCSD ? new RTCSD(offerInit) : offerInit;

      await this.peerConnection.setRemoteDescription(sessionDesc);
      await this._drainPendingCandidates();

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

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

      const RTCSD = RTCSessionDescriptionNative || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
      const sessionDesc = RTCSD ? new RTCSD(answerInit) : answerInit;

      await this.peerConnection.setRemoteDescription(sessionDesc);
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
   * Add Remote ICE Candidate with generation check and bounded buffering
   */
  async addIceCandidate(candidateData) {
    if (!candidateData) return;

    const candidateObj = candidateData.candidate || candidateData;
    const generation = candidateData.generation;

    if (generation !== undefined && generation < this.currentNegotiationGeneration) {
      console.log(`[WEBRTC] Dropping stale ICE candidate from generation ${generation} (current: ${this.currentNegotiationGeneration})`);
      return;
    }

    if (this.peerConnection && this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
      try {
        const RTCIce = RTCIceCandidateNative || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);
        const iceCandidate = RTCIce ? new RTCIce(candidateObj) : candidateObj;
        await this.peerConnection.addIceCandidate(iceCandidate);
      } catch (err) {
        console.warn('[WEBRTC] Add ICE candidate warning:', err.message);
      }
    } else {
      if (this.pendingCandidates.length < this.maxBufferedCandidates) {
        this.pendingCandidates.push(candidateObj);
      }
    }
  }

  async _drainPendingCandidates() {
    if (this.pendingCandidates.length > 0 && this.peerConnection) {
      const candidates = [...this.pendingCandidates];
      this.pendingCandidates = [];
      const RTCIce = RTCIceCandidateNative || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);

      for (const cand of candidates) {
        try {
          const iceCandidate = RTCIce ? new RTCIce(cand) : cand;
          await this.peerConnection.addIceCandidate(iceCandidate);
        } catch (err) {
          console.warn('[WEBRTC] Drain addIceCandidate error:', err.message);
        }
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
          if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.mediaType === 'audio')) {
            packetsLost = report.packetsLost || 0;
            packetsReceived = report.packetsReceived || 0;
          }
          if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
            currentRtt = report.currentRoundTripTime ? Math.round(report.currentRoundTripTime * 1000) : null;
            if (report.remoteCandidateId && stats.get) {
              const remoteCand = stats.get(report.remoteCandidateId);
              if (remoteCand) candidatePairType = remoteCand.candidateType;
            }
          }
        });

        if (candidatePairType) {
          this.lastSelectedCandidatePair = candidatePairType;
        }

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
    }

    this.remoteStream = null;
    this.pendingCandidates = [];
    this.negotiationQueue = [];
    this.isNegotiating = false;
    this.hasRemoteAudio = false;
    this.hasRemoteVideo = false;
    this.mediaReadyEmitted = false;
    console.log('[WEBRTC] All WebRTC resources and tracks cleanly destroyed.');
  }
}

export default new WebRTCService();
