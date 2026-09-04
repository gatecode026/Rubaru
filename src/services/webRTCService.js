import api from './api';

/**
 * Enterprise WebRTC Media & PeerConnection Client Service for Rubaru Calling
 * Supports Web & React Native environments with standard WebRTC APIs
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
      onRemoteStream: [],
      onConnectionStateChange: [],
      onIceCandidate: [],
    };
    this.pendingCandidates = [];
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
      console.warn('[WEBRTC] Using default public STUN servers:', err.message);
    }
    return this.iceServers;
  }

  /**
   * Initialize Local Media Stream
   */
  async initializeLocalMedia({ video = true, audio = true } = {}) {
    this.isVideoEnabled = video;
    this.isAudioMuted = !audio;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: video ? { facingMode: this.isFrontCamera ? 'user' : 'environment' } : false,
        });
        return this.localStream;
      } catch (err) {
        console.warn('[WEBRTC] getUserMedia error:', err.message);
      }
    }
    return null;
  }

  /**
   * Initialize RTCPeerConnection with active ICE configuration
   */
  async createPeerConnection() {
    await this.fetchIceServers();

    const RTCPC = typeof RTCPeerConnection !== 'undefined'
      ? RTCPeerConnection
      : (typeof global !== 'undefined' && global.RTCPeerConnection) || null;

    if (!RTCPC) {
      console.warn('[WEBRTC] RTCPeerConnection is not available in current environment.');
      return null;
    }

    this.peerConnection = new RTCPC({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    });

    // Handle ICE Candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('onIceCandidate', event.candidate);
      }
    };

    // Handle Connection State
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('[WEBRTC] Connection State changed:', state);
      this.emit('onConnectionStateChange', state);
    };

    // Handle Remote Track
    this.peerConnection.ontrack = (event) => {
      console.log('[WEBRTC] Remote track received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.emit('onRemoteStream', this.remoteStream);
      }
    };

    // Add Local Tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    return this.peerConnection;
  }

  /**
   * Create SDP Offer
   */
  async createOffer() {
    if (!this.peerConnection) await this.createPeerConnection();
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.isVideoEnabled,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handle Remote SDP Offer and create SDP Answer
   */
  async handleOfferAndCreateAnswer(remoteOffer) {
    if (!this.peerConnection) await this.createPeerConnection();
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));

    // Drain queued ICE candidates
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set Remote SDP Answer
   */
  async handleAnswer(remoteAnswer) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));

    // Drain queued ICE candidates
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  /**
   * Add Remote ICE Candidate
   */
  async addIceCandidate(candidate) {
    if (!candidate) return;
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('[WEBRTC] addIceCandidate error:', err.message);
      }
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  /**
   * Toggle Audio Mute
   */
  toggleAudio(muteState = null) {
    this.isAudioMuted = muteState !== null ? muteState : !this.isAudioMuted;
    if (this.localStream) {
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
    if (this.localStream) {
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
    if (this.localStream && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      // Stop existing video track
      this.localStream.getVideoTracks().forEach((track) => track.stop());
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.isFrontCamera ? 'user' : 'environment' },
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack && this.peerConnection) {
          const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
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
   * Cleanup and close all streams and connections
   */
  destroy() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.remoteStream = null;
    this.pendingCandidates = [];
    this.listeners = {
      onRemoteStream: [],
      onConnectionStateChange: [],
      onIceCandidate: [],
    };
    console.log('[WEBRTC] Media and PeerConnection resources cleaned up.');
  }
}

export default new WebRTCService();
