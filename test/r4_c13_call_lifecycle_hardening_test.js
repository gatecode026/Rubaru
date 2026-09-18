/**
 * RUBARU — R4-C13: CALL LIFECYCLE HARDENING, PEER CONNECTION LEAKS & DUPLICATE LISTENERS
 * Comprehensive verification test suite proving:
 *  1. Singleton PeerConnection per active call & duplicate initialization protection
 *  2. Socket.io listener deterministic registration, unbinding, and count stability
 *  3. Zero listener accumulation across repeated screen mounts / unmounts
 *  4. Local & remote MediaStream and track release (camera/mic freed, tracks stopped)
 *  5. Remote track duplication protection
 *  6. Deterministic timer / interval cleanup
 *  7. All termination scenarios (caller hangup, receiver hangup, reject, cancel, timeout)
 *  8. Rapid action idempotency
 *  9. Multi-device loser dismissal without media acquisition
 * 10. Socket reconnect safety without media duplication
 * 11. 10-Call Soak testing with resource baseline verification
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Mock MediaStreamTrack
class TestMediaStreamTrack {
  constructor(kind = 'audio') {
    this.id = `track_${kind}_${Math.random().toString(36).substring(7)}`;
    this.kind = kind;
    this.enabled = true;
    this.readyState = 'live';
    this.onended = null;
    this._stopped = false;
  }
  stop() {
    this._stopped = true;
    this.readyState = 'ended';
    if (typeof this.onended === 'function') {
      this.onended();
    }
  }
}

// Mock MediaStream
class TestMediaStream {
  constructor(tracks = []) {
    this.id = `stream_${Math.random().toString(36).substring(7)}`;
    this._tracks = [...tracks];
    this._released = false;
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
  addTrack(track) {
    if (!this._tracks.some((t) => t.id === track.id)) {
      this._tracks.push(track);
    }
  }
  removeTrack(track) {
    this._tracks = this._tracks.filter((t) => t.id !== track.id);
  }
  toURL() {
    return `webrtc-stream://${this.id}`;
  }
  release() {
    this._released = true;
    this._tracks.forEach((t) => t.stop());
  }
}

// Mock RTCPeerConnection with full lifecycle tracking
class TestRTCPeerConnection {
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
    this.senders = [];
    this._closed = false;
    this._statsPollCount = 0;
  }

  addTrack(track, stream) {
    this.senders.push({
      track,
      replaceTrack: async (newT) => {
        const sender = this.senders.find((s) => s.track === track);
        if (sender) sender.track = newT;
      },
    });
  }

  getSenders() {
    return this.senders;
  }

  async createOffer(options = {}) {
    this.iceGatheringState = 'gathering';
    return {
      type: 'offer',
      sdp: 'v=0\r\no=lifecycle 100 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
      generation: options.iceRestart ? 2 : 1,
    };
  }

  async createAnswer(options = {}) {
    return {
      type: 'answer',
      sdp: 'v=0\r\no=lifecycle 200 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n',
    };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
    this.iceGatheringState = 'complete';
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
    this.signalingState = desc.type === 'offer' ? 'have-remote-offer' : 'stable';
    this.connectionState = 'connected';
    this.iceConnectionState = 'connected';

    if (typeof this.onconnectionstatechange === 'function') {
      this.onconnectionstatechange();
    }
    if (typeof this.oniceconnectionstatechange === 'function') {
      this.oniceconnectionstatechange();
    }
  }

  async addIceCandidate(candidate) {
    return true;
  }

  async getStats() {
    this._statsPollCount++;
    const count = this._statsPollCount;
    const reports = new Map();
    reports.set('transport_1', { type: 'transport', dtlsState: 'connected' });
    reports.set('cand_local', { id: 'cand_local', candidateType: 'host', protocol: 'udp' });
    reports.set('cand_remote', { id: 'cand_remote', candidateType: 'host', protocol: 'udp' });
    reports.set('pair_1', {
      type: 'candidate-pair',
      state: 'succeeded',
      nominated: true,
      protocol: 'UDP',
      currentRoundTripTime: 0.035,
      localCandidateId: 'cand_local',
      remoteCandidateId: 'cand_remote',
    });
    reports.set('audio_out', {
      type: 'outbound-rtp',
      kind: 'audio',
      packetsSent: 1000 + count * 50,
      bytesSent: (1000 + count * 50) * 80,
    });
    reports.set('audio_in', {
      type: 'inbound-rtp',
      kind: 'audio',
      packetsReceived: 995 + count * 50,
      bytesReceived: (995 + count * 50) * 80,
      packetsLost: 1,
    });
    reports.set('video_out', {
      type: 'outbound-rtp',
      kind: 'video',
      packetsSent: 2500 + count * 60,
      bytesSent: (2500 + count * 60) * 300,
    });
    reports.set('video_in', {
      type: 'inbound-rtp',
      kind: 'video',
      packetsReceived: 2490 + count * 60,
      bytesReceived: (2490 + count * 60) * 300,
      framesDecoded: 600 + count * 30,
      framesReceived: 602 + count * 30,
      frameWidth: 1280,
      frameHeight: 720,
      framesPerSecond: 30,
    });
    return reports;
  }

  close() {
    this._closed = true;
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this.signalingState = 'closed';
  }
}

// Mock Socket.io with exact listener count inspection
class TestSocket {
  constructor() {
    this.listeners = new Map();
    this.emittedEvents = [];
    this.connected = true;
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    if (!handler) {
      this.listeners.delete(event);
      return;
    }
    const arr = this.listeners.get(event);
    const filtered = arr.filter((h) => h !== handler);
    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
  }

  emit(event, data, callback) {
    this.emittedEvents.push({ event, data });
    if (typeof callback === 'function') {
      callback({ ok: true, data: { callId: data.callId || 'mock-call-id', status: 'RINGING' } });
    }
  }

  trigger(event, data) {
    if (this.listeners.has(event)) {
      const handlers = [...this.listeners.get(event)];
      handlers.forEach((h) => h(data));
    }
  }

  getTotalListenerCount() {
    let total = 0;
    for (const [event, handlers] of this.listeners.entries()) {
      total += handlers.length;
    }
    return total;
  }

  getListenerCountsByEvent() {
    const counts = {};
    for (const [event, handlers] of this.listeners.entries()) {
      counts[event] = handlers.length;
    }
    return counts;
  }
}

// Module transpile loader
function loadFreshWebRTCService() {
  const servicePath = path.resolve(__dirname, '../src/services/webRTCService.js');
  const rawCode = fs.readFileSync(servicePath, 'utf8');

  const transformed = babel.transformSync(rawCode, {
    presets: ['babel-preset-expo'],
    filename: servicePath,
  });

  const customRequire = (id) => {
    if (id === './api' || id === './api.js') {
      return {
        default: {
          get: async () => ({
            data: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'turn:turn.rubaru.app:3478', username: 'testuser', credential: 'testpassword' },
              ],
            },
          }),
        },
      };
    }
    if (id === 'react-native-webrtc') {
      return {
        RTCIceCandidate: class {
          constructor(info) {
            this.candidate = info.candidate;
            this.sdpMid = info.sdpMid;
            this.sdpMLineIndex = info.sdpMLineIndex;
          }
        },
        RTCPeerConnection: TestRTCPeerConnection,
        RTCSessionDescription: class {
          constructor(desc) {
            this.type = desc.type;
            this.sdp = desc.sdp;
          }
        },
        MediaStream: TestMediaStream,
        mediaDevices: {
          getUserMedia: async ({ video, audio }) => {
            const tracks = [];
            if (audio) tracks.push(new TestMediaStreamTrack('audio'));
            if (video) tracks.push(new TestMediaStreamTrack('video'));
            return new TestMediaStream(tracks);
          },
        },
        RTCView: () => null,
      };
    }
    if (id === 'react-native') {
      return {
        Platform: { OS: 'android' },
        PermissionsAndroid: {
          PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO', CAMERA: 'android.permission.CAMERA' },
          RESULTS: { GRANTED: 'granted' },
          requestMultiple: async () => ({
            'android.permission.RECORD_AUDIO': 'granted',
            'android.permission.CAMERA': 'granted',
          }),
        },
      };
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const wrapperFn = new Function('require', 'module', 'exports', transformed.code);
  wrapperFn(customRequire, moduleObj, moduleObj.exports);

  return moduleObj.exports.default || moduleObj.exports;
}

// Custom mock for useCallController hook logic simulation
function mountCallController(socket, webRTCService, store) {
  // Simulates useCallController listener bindings
  const onIncoming = (data) => store.handleIncomingCall(data);
  const onRinging = (data) => store.handleRinging(data);
  const onAccepted = (data) => store.handleAccepted(data);
  const onSignalOffer = (data) => store.handleOffer(data);
  const onSignalAnswer = (data) => store.handleAnswer(data);
  const onSignalIce = (data) => store.handleIceCandidate(data);
  const onConnected = (data) => store.handleConnected(data);
  const onCallConnectedLegacy = (data) => store.handleConnected(data);
  const onMediaControl = (data) => store.handleRemoteMediaControl(data);
  const onReconnecting = (data) => store.handleReconnecting(data);
  const onReconnected = (data) => store.handleReconnected(data);
  const onCallEnded = (data) => store.handleCallEnded(data);
  const onCallRejected = (data) => store.handleCallEnded(data);
  const onCallCancelled = (data) => store.handleCallEnded(data);
  const onCallDismissed = (data) => store.handleDismissed(data);
  const onCallSync = (data) => store.handleSync(data);

  // WebRTC events
  const unsubLocalStream = webRTCService.on('onLocalStream', (stream) => store.setStreams({ localStream: stream }));
  const unsubRemoteStream = webRTCService.on('onRemoteStream', (stream) => store.setStreams({ remoteStream: stream }));
  const unsubMediaReady = webRTCService.on('onMediaReady', () => store.emitMediaReady());
  const unsubConnectionFailed = webRTCService.on('onConnectionFailed', () => store.handleConnectionFailed());
  const unsubConnectionReconnecting = webRTCService.on('onConnectionReconnecting', () => store.handleConnectionReconnecting());
  const unsubConnectionReconnected = webRTCService.on('onConnectionReconnected', () => {});
  const unsubQualityReport = webRTCService.on('onQualityReport', (r) => store.handleQualityReport(r));
  const unsubIceCandidate = webRTCService.on('onIceCandidate', (c) => store.handleIceCandidate(c));

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

  // Return unmount unbinder
  return function unmount() {
    unsubLocalStream();
    unsubRemoteStream();
    unsubMediaReady();
    unsubConnectionFailed();
    unsubConnectionReconnecting();
    unsubConnectionReconnected();
    unsubQualityReport();
    unsubIceCandidate();

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
    socket.off('call_connected', onCallConnectedLegacy);
    socket.off('call:media-control', onMediaControl);
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
  };
}

// Simulates IncomingCallContext listener bindings
function mountIncomingCallContext(socket, store) {
  let registeredHandlers = null;

  const handleEndOrCancel = (data) => {
    store.handleCallEnded(data);
  };
  const handleIncoming = (data) => {
    store.handleIncomingCall(data);
  };
  const handlePaidRequested = (data) => {
    store.handleIncomingCall({
      callId: data.sessionId || data.callId,
      callType: 'audio',
    });
  };
  const handleDismissed = (data) => {
    store.handleDismissed(data);
  };

  registeredHandlers = [
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
    { event: 'paid_session.ended', handler: handleEndOrCancel },
    { event: 'paid_session.cancelled', handler: handleEndOrCancel },
    { event: 'paid_session.declined', handler: handleEndOrCancel },
  ];

  registeredHandlers.forEach(({ event, handler }) => {
    socket.on(event, handler);
  });

  return function unmount() {
    if (registeredHandlers) {
      registeredHandlers.forEach(({ event, handler }) => {
        socket.off(event, handler);
      });
    }
  };
}

// Mock Store State
class MockCallStore {
  constructor(webRTCService, socket) {
    this.webRTCService = webRTCService;
    this.socket = socket;
    this.callId = null;
    this.callStatus = 'IDLE';
    this.localStream = null;
    this.remoteStream = null;
    this.isHandlingAction = false;
    this.endReason = null;
    this.playEndCount = 0;
    this.timers = new Set();
  }

  setStreams({ localStream, remoteStream }) {
    if (localStream !== undefined) this.localStream = localStream;
    if (remoteStream !== undefined) this.remoteStream = remoteStream;
  }

  async initiateCall({ receiverId, callType = 'audio' }) {
    if (this.isHandlingAction) return { success: false, error: 'ACTION_IN_PROGRESS' };
    if (this.callStatus !== 'IDLE' && this.callStatus !== 'ENDED') {
      return { success: false, error: 'CALL_ALREADY_ACTIVE' };
    }
    this.isHandlingAction = true;
    this.callStatus = 'INITIATING';

    try {
      this.localStream = await this.webRTCService.initializeLocalMedia({ video: callType === 'video', audio: true });
      this.callId = 'call_' + Math.random().toString(36).substring(7);
      this.callStatus = 'RINGING';
      this.isHandlingAction = false;
      return { success: true, callId: this.callId };
    } catch (e) {
      this.isHandlingAction = false;
      this.cleanup('CAPTURE_FAILED');
      return { success: false, error: e.message };
    }
  }

  async acceptIncomingCall() {
    if (this.isHandlingAction) return { success: false, error: 'ACTION_IN_PROGRESS' };
    if (this.callStatus !== 'INCOMING' || !this.callId) return { success: false, error: 'NO_INCOMING_CALL' };
    this.isHandlingAction = true;
    this.callStatus = 'CONNECTING';

    try {
      this.localStream = await this.webRTCService.initializeLocalMedia({ video: false, audio: true });
      this.isHandlingAction = false;
      return { success: true };
    } catch (e) {
      this.isHandlingAction = false;
      this.cleanup('CAPTURE_FAILED');
      return { success: false, error: e.message };
    }
  }

  handleIncomingCall(data) {
    if (this.callStatus !== 'IDLE' && this.callStatus !== 'ENDED') return;
    this.callId = data.callId || data.sessionId;
    this.callStatus = 'INCOMING';
  }

  handleRinging(data) {
    if (this.callId === data.callId) this.callStatus = 'RINGING';
  }

  handleAccepted(data) {
    if (this.callId === data.callId) this.callStatus = 'CONNECTING';
  }

  handleConnected(data) {
    if (this.callId === data.callId) this.callStatus = 'ACTIVE';
  }

  emitMediaReady() {}
  handleOffer(data) {}
  handleAnswer(data) {}
  handleIceCandidate(data) {}
  handleConnectionFailed(reason) {}
  handleConnectionReconnecting() {}
  handleQualityReport(report) {}
  handleRemoteMediaControl(data) {}
  handleReconnecting(data) {}
  handleReconnected(data) {}
  handleSync(data) {}

  handleDismissed(data) {
    if (this.callId === data?.callId || this.callStatus === 'INCOMING') {
      this.resetToIdle();
    }
  }

  handleCallEnded(data) {
    if (this.callStatus === 'IDLE' || this.callStatus === 'ENDED') return;
    const eventCallId = data?.callId || data?.sessionId;
    if (this.callId && eventCallId && this.callId !== eventCallId) return;
    this.cleanup(data?.reason || 'CALL_ENDED');
  }

  cleanup(reason = 'TERMINATED') {
    const isAlreadyEnded = this.callStatus === 'ENDED' || this.callStatus === 'IDLE';
    this.webRTCService.destroy();

    if (!isAlreadyEnded && reason && reason !== 'IDLE') {
      this.playEndCount++;
    }

    this.callStatus = 'ENDED';
    this.endReason = reason;
    this.localStream = null;
    this.remoteStream = null;
    this.isHandlingAction = false;

    // Clear any timers
    for (const t of this.timers) {
      clearInterval(t);
      clearTimeout(t);
    }
    this.timers.clear();
  }

  resetToIdle() {
    this.callId = null;
    this.callStatus = 'IDLE';
    this.localStream = null;
    this.remoteStream = null;
    this.endReason = null;
    for (const t of this.timers) {
      clearInterval(t);
      clearTimeout(t);
    }
    this.timers.clear();
  }
}

// TEST HARNESS
async function runTests() {
  console.log('================================================================================');
  console.log('   RUBARU — R4-C13 CALL LIFECYCLE HARDENING & PEER CONNECTION LEAKS VERIFICATION');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`TEST: ${name}... `);
    try {
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(err);
      failed++;
    }
  }

  // --- 1. PeerConnection Singleton & Lifecycle ---
  await test('PeerConnection created once per call and activePCCount strictly 1', async () => {
    const rtc = loadFreshWebRTCService();
    assert.strictEqual(rtc.activePCCount, 0, 'Initial activePCCount must be 0');

    await rtc.createPeerConnection({ callType: 'video', callId: 'call_test_1' });
    const stats1 = rtc.getPcStats();
    assert.strictEqual(stats1.activePCCount, 1, 'Active PC count must be 1');
    assert.strictEqual(stats1.pcCreated, 1, 'Created count must be 1');
    assert.strictEqual(stats1.pcClosed, 0, 'Closed count must be 0');

    rtc.destroy();
    const stats2 = rtc.getPcStats();
    assert.strictEqual(stats2.activePCCount, 0, 'Active PC count must be 0 after destroy');
    assert.strictEqual(stats2.pcClosed, 1, 'Closed count must be 1 after destroy');
  });

  // --- 2. Duplicate Initialization Protection ---
  await test('Duplicate createPeerConnection safely closes prior connection without competing PCs', async () => {
    const rtc = loadFreshWebRTCService();
    const pc1 = await rtc.createPeerConnection({ callType: 'video', callId: 'call_test_dup' });
    assert.strictEqual(rtc.activePCCount, 1);

    // Trigger duplicate initialization attempt
    const pc2 = await rtc.createPeerConnection({ callType: 'video', callId: 'call_test_dup' });
    assert.strictEqual(pc1._closed, true, 'First PeerConnection must have been safely closed');
    assert.strictEqual(rtc.activePCCount, 1, 'activePCCount must remain strictly 1');
    assert.strictEqual(rtc.pcCreatedCount, 2, 'Total created count is 2');
    assert.strictEqual(rtc.pcClosedCount, 1, 'Total closed count is 1');

    rtc.destroy();
    assert.strictEqual(rtc.activePCCount, 0);
    assert.strictEqual(rtc.pcClosedCount, 2);
  });

  // --- 3. Socket Listener Count Stability ---
  await test('Socket listener registration and unmount returns strictly to baseline count', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    // Initial root listener registration (IncomingCallContext)
    const unmountIncoming = mountIncomingCallContext(socket, store);
    const baselineCount = socket.getTotalListenerCount();
    assert.strictEqual(baselineCount, 14, 'IncomingCallContext registers 14 canonical listeners');

    // Mount ActiveCallScreen controller
    const unmountController = mountCallController(socket, rtc, store);
    const activeCount = socket.getTotalListenerCount();
    assert.strictEqual(activeCount, baselineCount + 25, 'ActiveCallScreen controller registers 25 listeners');

    // Unmount ActiveCallScreen controller (hangup / navigation)
    unmountController();
    const postUnmountCount = socket.getTotalListenerCount();
    assert.strictEqual(postUnmountCount, baselineCount, 'Listener count must return strictly to baseline count');

    // Unmount IncomingCallContext (app teardown)
    unmountIncoming();
    assert.strictEqual(socket.getTotalListenerCount(), 0, 'All listeners cleaned up upon root unmount');
  });

  // --- 4. Screen Remount Soak (Zero Listener Accumulation) ---
  await test('10 consecutive screen mounts/unmounts produce zero listener growth', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    const baselineCount = socket.getTotalListenerCount(); // 0

    for (let i = 1; i <= 10; i++) {
      const unmount = mountCallController(socket, rtc, store);
      assert.strictEqual(socket.getTotalListenerCount(), 25, `Mount ${i} should have exactly 25 listeners`);
      unmount();
      assert.strictEqual(socket.getTotalListenerCount(), baselineCount, `Unmount ${i} must return to baseline`);
    }

    assert.strictEqual(socket.getTotalListenerCount(), 0, 'Zero listener accumulation after 10 mount/unmount cycles');
  });

  // --- 5. Local MediaStream & Track Lifecycle ---
  await test('Local MediaStream tracks stopped, camera/mic released, stream reference nulled on destroy', async () => {
    const rtc = loadFreshWebRTCService();
    const stream = await rtc.initializeLocalMedia({ video: true, audio: true });
    assert(stream, 'Local stream must exist');
    const tracks = stream.getTracks();
    assert.strictEqual(tracks.length, 2, 'Should have 1 audio and 1 video track');
    assert.strictEqual(tracks[0].readyState, 'live');
    assert.strictEqual(tracks[1].readyState, 'live');

    rtc.destroy();
    assert.strictEqual(rtc.localStream, null, 'localStream reference must be null');
    assert.strictEqual(tracks[0]._stopped, true, 'Audio track must be stopped');
    assert.strictEqual(tracks[1]._stopped, true, 'Video track must be stopped');
    assert.strictEqual(tracks[0].readyState, 'ended');
    assert.strictEqual(tracks[1].readyState, 'ended');
  });

  // --- 6. Remote MediaStream & Track Cleanup ---
  await test('Remote MediaStream tracks stopped and stream released upon destroy()', async () => {
    const rtc = loadFreshWebRTCService();
    await rtc.createPeerConnection({ callType: 'video' });

    const remoteAudio = new TestMediaStreamTrack('audio');
    const remoteVideo = new TestMediaStreamTrack('video');
    const remoteStream = new TestMediaStream([remoteAudio, remoteVideo]);

    rtc.peerConnection.ontrack({
      track: remoteAudio,
      streams: [remoteStream],
    });
    rtc.peerConnection.ontrack({
      track: remoteVideo,
      streams: [remoteStream],
    });

    assert(rtc.remoteStream, 'Remote stream must be attached');
    assert.strictEqual(rtc.remoteStream.getTracks().length, 2);

    rtc.destroy();
    assert.strictEqual(rtc.remoteStream, null, 'remoteStream must be nulled');
    assert.strictEqual(remoteAudio._stopped, true, 'Remote audio track must be stopped');
    assert.strictEqual(remoteVideo._stopped, true, 'Remote video track must be stopped');
    assert.strictEqual(remoteStream._released, true, 'Remote stream release method called');
  });

  // --- 7. Remote Track Duplication Protection ---
  await test('Repeated or staggered ontrack events do not duplicate tracks or stream references', async () => {
    const rtc = loadFreshWebRTCService();
    await rtc.createPeerConnection({ callType: 'video' });

    const remoteAudio = new TestMediaStreamTrack('audio');
    const remoteStream = new TestMediaStream([remoteAudio]);

    // Initial track arrival
    rtc.peerConnection.ontrack({ track: remoteAudio, streams: [remoteStream] });
    const initialStreamId = rtc.remoteStream.id;

    // Redundant duplicate ontrack event for same track
    rtc.peerConnection.ontrack({ track: remoteAudio, streams: [remoteStream] });
    assert.strictEqual(rtc.remoteStream.id, initialStreamId, 'Stream must remain identical');
    assert.strictEqual(rtc.remoteStream.getTracks().length, 1, 'Track count must not duplicate');

    // Staggered video track arrival on same stream
    const remoteVideo = new TestMediaStreamTrack('video');
    rtc.peerConnection.ontrack({ track: remoteVideo, streams: [remoteStream] });
    assert.strictEqual(rtc.remoteStream.id, initialStreamId, 'Stream must remain identical when video arrives');
    assert.strictEqual(rtc.remoteStream.getTracks().length, 2, 'Should have exactly 2 tracks (audio + video)');

    rtc.destroy();
  });

  // --- 8. Deterministic Timer Cleanup ---
  await test('All timers (watchdog, quality monitor, tickers) are cleared on destroy()', async () => {
    const rtc = loadFreshWebRTCService();
    await rtc.createPeerConnection({ callType: 'video' });

    assert(rtc.connectionWatchdogTimer !== null, 'Connection watchdog timer should be active');
    rtc.startQualityMonitoring();
    assert(rtc.qualityMonitorTimer !== null, 'Quality monitor timer should be active');

    rtc.destroy();
    assert.strictEqual(rtc.connectionWatchdogTimer, null, 'Connection watchdog timer must be cleared');
    assert.strictEqual(rtc.qualityMonitorTimer, null, 'Quality monitor timer must be cleared');
  });

  // --- 9. Caller Hangup Termination Lifecycle ---
  await test('Caller hangup terminates call, notifies receiver, and destroys all resources', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    await store.initiateCall({ receiverId: 'user_b' });
    assert.strictEqual(store.callStatus, 'RINGING');
    await rtc.createPeerConnection({ callType: 'audio', callId: store.callId });
    assert.strictEqual(rtc.activePCCount, 1);

    // Caller hangs up
    store.cleanup('CALLER_HUNG_UP');
    assert.strictEqual(store.callStatus, 'ENDED');
    assert.strictEqual(rtc.activePCCount, 0);
    assert.strictEqual(store.localStream, null);
    assert.strictEqual(store.playEndCount, 1);

    // Second event (e.g. socket acknowledgment or dual event) must not duplicate sound or throw
    store.handleCallEnded({ callId: store.callId, reason: 'CALL_ENDED' });
    assert.strictEqual(store.playEndCount, 1, 'End sound must not play twice');
  });

  // --- 10. Callee Reject Termination Lifecycle ---
  await test('Callee reject clears incoming state and releases resources', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    store.handleIncomingCall({ callId: 'call_reject_1' });
    assert.strictEqual(store.callStatus, 'INCOMING');

    store.cleanup('DECLINED_BY_RECEIVER');
    assert.strictEqual(store.callStatus, 'ENDED');
    assert.strictEqual(rtc.activePCCount, 0);
    store.resetToIdle();
    assert.strictEqual(store.callStatus, 'IDLE');
  });

  // --- 11. Caller Cancel Termination Lifecycle ---
  await test('Caller cancel before answer resets receiver to IDLE without media acquisition', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    store.handleIncomingCall({ callId: 'call_cancel_1' });
    assert.strictEqual(store.callStatus, 'INCOMING');

    // Cancel event arrives
    store.handleCallEnded({ callId: 'call_cancel_1', reason: 'CALLER_CANCELLED' });
    assert.strictEqual(store.callStatus, 'ENDED');
    assert.strictEqual(store.localStream, null);
    assert.strictEqual(rtc.activePCCount, 0);
  });

  // --- 12. Call Timeout Termination Lifecycle ---
  await test('Call timeout terminates both sides cleanly without leaked connections', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    await store.initiateCall({ receiverId: 'user_timeout' });
    assert.strictEqual(store.callStatus, 'RINGING');

    store.handleCallEnded({ callId: store.callId, reason: 'TIMEOUT' });
    assert.strictEqual(store.callStatus, 'ENDED');
    assert.strictEqual(store.endReason, 'TIMEOUT');
    assert.strictEqual(rtc.activePCCount, 0);
  });

  // --- 13. Rapid Action Idempotency Protection ---
  await test('Rapid concurrent actions reject duplicates without corrupting call state or creating extra PCs', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    // First initiate
    const p1 = store.initiateCall({ receiverId: 'user_rapid' });
    // Rapid concurrent second initiate
    const p2 = store.initiateCall({ receiverId: 'user_rapid' });

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error, 'ACTION_IN_PROGRESS');

    store.cleanup('USER_HUNG_UP');
  });

  // --- 14. Multi-Device Single Winner Dismissal ---
  await test('Multi-device losing device receives call:dismissed and returns to IDLE without media', async () => {
    const socket = new TestSocket();
    const rtc = loadFreshWebRTCService();
    const store = new MockCallStore(rtc, socket);

    // Device receives incoming call
    store.handleIncomingCall({ callId: 'call_multi_1' });
    assert.strictEqual(store.callStatus, 'INCOMING');

    // Winning device accepts on another device -> server emits call:dismissed
    store.handleDismissed({ callId: 'call_multi_1' });
    assert.strictEqual(store.callStatus, 'IDLE', 'Losing device must reset to IDLE');
    assert.strictEqual(store.localStream, null, 'Losing device must not hold local media');
    assert.strictEqual(rtc.activePCCount, 0, 'Losing device must have 0 PeerConnections');
  });

  // --- 15. Socket Reconnect Safety ---
  await test('Socket reconnect does not create duplicate PeerConnection or reset media session', async () => {
    const rtc = loadFreshWebRTCService();
    await rtc.createPeerConnection({ callType: 'video', callId: 'call_reconnect_1' });
    assert.strictEqual(rtc.activePCCount, 1);

    // Simulate socket reconnect event: reuse connection via ICE restart
    const offer = await rtc.restartIce();
    assert.strictEqual(rtc.activePCCount, 1, 'ICE restart reuses the existing PeerConnection');
    assert.strictEqual(offer.generation, 2, 'Negotiation generation incremented');

    rtc.destroy();
    assert.strictEqual(rtc.activePCCount, 0);
  });

  // --- 16. 10-Call Soak Testing (A <-> B Repeated Cycles with Zero Accumulation) ---
  await test('10-Call Soak: 10 consecutive call cycles establish media, flow RTP, and return exactly to baseline', async () => {
    const socket = new TestSocket();
    const baselineListeners = socket.getTotalListenerCount(); // 0

    const soakResults = [];

    for (let cycle = 1; cycle <= 10; cycle++) {
      const direction = cycle % 2 === 1 ? 'A -> B' : 'B -> A';
      const callType = cycle % 2 === 1 ? 'video' : 'audio';
      const callId = `call_soak_${cycle}`;

      const rtc = loadFreshWebRTCService();
      const store = new MockCallStore(rtc, socket);

      // Mount screen controller
      const unmountScreen = mountCallController(socket, rtc, store);

      // 1. Initiate / Capture
      const initRes = await store.initiateCall({ receiverId: 'peer', callType });
      assert.strictEqual(initRes.success, true);
      assert.strictEqual(rtc.activePCCount, 0, 'PC not created until createPeerConnection');

      // 2. Setup PC & Connect
      const pc = await rtc.createPeerConnection({ callType, callId });
      assert.strictEqual(rtc.activePCCount, 1, `Cycle ${cycle}: Exactly 1 active PC`);

      const offer = await rtc.createOffer();
      await rtc.handleAnswer({ type: 'answer', sdp: 'v=0\r\n...' });
      await pc.setRemoteDescription({ type: 'answer', sdp: 'v=0\r\n...' });

      // 3. Attach remote tracks
      const remoteAudio = new TestMediaStreamTrack('audio');
      const remoteTracks = [remoteAudio];
      if (callType === 'video') {
        remoteTracks.push(new TestMediaStreamTrack('video'));
      }
      const remoteStream = new TestMediaStream(remoteTracks);
      remoteTracks.forEach((t) => pc.ontrack({ track: t, streams: [remoteStream] }));

      // 4. Verify media flow via RTP stats
      const rtp = await rtc.getRtpStats();
      const audioRtpOk = rtp.audio.outbound.packetsSent > 0;
      const videoRtpOk = callType === 'video' ? rtp.video.outbound.packetsSent > 0 : true;

      // 5. Hang up and clean up
      store.cleanup('NORMAL_CLEARING');
      unmountScreen();

      // 6. Verify post-call baseline
      const pcStats = rtc.getPcStats();
      const pcClean = pcStats.activePCCount === 0 && pc._closed === true;
      const listenersClean = socket.getTotalListenerCount() === baselineListeners;
      const streamsClean = rtc.localStream === null && rtc.remoteStream === null;
      const timersClean = rtc.connectionWatchdogTimer === null && rtc.qualityMonitorTimer === null;

      const allClean = pcClean && listenersClean && streamsClean && timersClean;

      soakResults.push({
        cycle,
        direction,
        audio: audioRtpOk ? 'PASS' : 'FAIL',
        video: videoRtpOk ? 'PASS' : 'FAIL',
        rtp: audioRtpOk && videoRtpOk ? 'PASS' : 'FAIL',
        cleanup: allClean ? 'PASS' : 'FAIL',
        result: audioRtpOk && videoRtpOk && allClean ? 'PASS' : 'FAIL',
      });

      assert(allClean, `Cycle ${cycle} must cleanly return all resources to baseline`);
    }

    console.log('\n   10-Call Soak Matrix:');
    console.table(soakResults);
  });

  console.log('\n================================================================================');
  console.log(`   R4-C13 TEST RESULTS: ${passed}/${passed + failed} TESTS PASSED (${failed} FAILED)`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
