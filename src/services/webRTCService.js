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
      sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=simulated\r\n',
    };
  }

  async createAnswer(options = {}) {
    return {
      type: 'answer',
      sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=simulated\r\n',
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
      if (typeof this.onconnectionstatechange === 'function') {
        this.onconnectionstatechange();
      }
      if (typeof this.oniceconnectionstatechange === 'function') {
        this.oniceconnectionstatechange();
      }
      if (typeof this.ontrack === 'function') {
        const stream = new SimulatedMediaStream('video');
        this.ontrack({
          track: stream.getAudioTracks()[0],
          streams: [stream],
        });
      }
    }, 100);
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
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    this.isAudioMuted = false;
    this.isVideoEnabled = true;
    this.isFrontCamera = true;
    this.listeners = {
      onLocalStream: [],
      onRemoteStream: [],
      onConnectionStateChange: [],
      onIceCandidate: [],
      onMediaReady: [],
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
  }

  /**
   * Set development-only forced relay transport policy
   */
  setForceRelayOnly(enabled) {
    this.forceRelayOnly = Boolean(enabled);
  }

  /**
   * Subscribe to WebRTC events
   */
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
      const res = await api.get('/v1/calls/turn-credentials');
      if (res.data?.data?.iceServers && Array.isArray(res.data.data.iceServers)) {
        this.iceServers = res.data.data.iceServers;
        return this.iceServers;
      }
    } catch (err) {
      console.warn('[WEBRTC] Using fallback public STUN servers:', err.message);
    }
    return this.iceServers;
  }

  /**
   * Initialize Local Media Stream
   * Requests real microphone and camera based on callType
   * Never requests camera for audio calls
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
        console.log('[WEBRTC] Hardware media stream capture unavailable, falling back to development stream:', err.message);
        this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
        this.emit('onLocalStream', this.localStream);
        return this.localStream;
      }
    } else {
      console.log('[WEBRTC] Running in standard Expo Go environment. Initializing simulated media stream for development & flow testing.');
      this.localStream = new SimulatedMediaStream(video ? 'video' : 'audio');
      this.emit('onLocalStream', this.localStream);
      return this.localStream;
    }
  }

  /**
   * Initialize RTCPeerConnection with active ICE configuration
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
      console.log('[WEBRTC] RTCPeerConnection native class not available in Expo Go. Using simulated peer connection for flow testing.');
      this.peerConnection = new SimulatedRTCPeerConnection({ iceServers: this.iceServers });
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

    // Handle Connection State & Media Readiness
    const checkStateAndReadiness = () => {
      if (!this.peerConnection) return;
      const connState = this.peerConnection.connectionState;
      const iceState = this.peerConnection.iceConnectionState;
      console.log(`[WEBRTC] State changed: connState=${connState}, iceState=${iceState}`);
      this.emit('onConnectionStateChange', { connectionState: connState, iceConnectionState: iceState });

      const isTransportReady = connState === 'connected' || iceState === 'connected' || iceState === 'completed';
      const isTracksReady = this.expectedCallType === 'video'
        ? (this.hasRemoteAudio && this.hasRemoteVideo)
        : this.hasRemoteAudio;

      if (isTransportReady && isTracksReady && !this.mediaReadyEmitted) {
        this.mediaReadyEmitted = true;
        console.log('[WEBRTC] Real media readiness confirmed! Emitting onMediaReady.');
        this.emit('onMediaReady', { ready: true });
      }
    };

    this.peerConnection.onconnectionstatechange = checkStateAndReadiness;
    this.peerConnection.oniceconnectionstatechange = checkStateAndReadiness;

    // Handle Remote Track
    this.peerConnection.ontrack = (event) => {
      console.log('[WEBRTC] Remote track received:', event.track?.kind);
      if (event.track?.kind === 'audio') this.hasRemoteAudio = true;
      if (event.track?.kind === 'video') this.hasRemoteVideo = true;

      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
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

    return this.peerConnection;
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
   */
  async handleOfferAndCreateAnswer(remoteOffer) {
    return this._serializeNegotiation(async () => {
      if (!this.peerConnection) await this.createPeerConnection({ callType: this.expectedCallType });

      const RTCSD = RTCSessionDescriptionNative || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
      const sessionDesc = RTCSD ? new RTCSD(remoteOffer) : remoteOffer;

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
      const RTCSD = RTCSessionDescriptionNative || (typeof RTCSessionDescription !== 'undefined' ? RTCSessionDescription : null);
      const sessionDesc = RTCSD ? new RTCSD(remoteAnswer) : remoteAnswer;

      await this.peerConnection.setRemoteDescription(sessionDesc);
      await this._drainPendingCandidates();
    });
  }

  /**
   * Add Remote ICE Candidate with generation check and bounded buffering
   */
  async addIceCandidate(candidateData) {
    if (!candidateData) return;

    // Handle candidate object format
    const candidateObj = candidateData.candidate || candidateData;
    const generation = candidateData.generation;

    // Reject stale candidates from previous negotiation generation
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
        console.warn('[WEBRTC] addIceCandidate error:', err.message);
      }
    } else {
      // Buffer candidates if remote description is not yet set
      if (this.pendingCandidates.length < this.maxBufferedCandidates) {
        this.pendingCandidates.push({ candidate: candidateObj, generation: this.currentNegotiationGeneration });
      } else {
        console.warn('[WEBRTC] ICE candidate buffer limit reached (100). Dropping oldest candidate.');
        this.pendingCandidates.shift();
        this.pendingCandidates.push({ candidate: candidateObj, generation: this.currentNegotiationGeneration });
      }
    }
  }

  /**
   * Drain queued ICE candidates once remote description is installed
   */
  async _drainPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;

    const RTCIce = RTCIceCandidateNative || (typeof RTCIceCandidate !== 'undefined' ? RTCIceCandidate : null);

    while (this.pendingCandidates.length > 0) {
      const item = this.pendingCandidates.shift();
      if (item.generation >= this.currentNegotiationGeneration) {
        try {
          const iceCandidate = RTCIce ? new RTCIce(item.candidate) : item.candidate;
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
   * Switch Camera between Front and Back
   */
  async switchCamera() {
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
          const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender && typeof sender.replaceTrack === 'function') {
            await sender.replaceTrack(newVideoTrack);
          }
        }
      } catch (e) {
        console.warn('[WEBRTC] switchCamera error:', e.message);
      }
    }
    return this.isFrontCamera;
  }

  /**
   * Single idempotent cleanup method
   */
  destroy() {
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
    this.listeners = {
      onLocalStream: [],
      onRemoteStream: [],
      onConnectionStateChange: [],
      onIceCandidate: [],
      onMediaReady: [],
    };
    console.log('[WEBRTC] All WebRTC resources and tracks cleanly destroyed.');
  }
}

export default new WebRTCService();
