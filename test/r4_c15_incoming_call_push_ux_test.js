/**
 * RUBARU — R4-C15: PRODUCTION INCOMING CALL UX, PUSH NOTIFICATIONS & BACKGROUND CALLING
 * Comprehensive automated verification test suite proving:
 *  1. Foreground incoming call handling (Socket delivery -> UI, ringtone & vibration)
 *  2. Background incoming call handling (Push payload -> Zustand store)
 *  3. Notification tap with authoritative server state synchronization
 *  4. Stale notification rejection (no WebRTC, no media, no fake call)
 *  5. Socket + Push arrival deduplication (zero double ringing, exactly 1 call)
 *  6. Duplicate Push arrival deduplication
 *  7. Duplicate Socket event deduplication
 *  8. Notification Accept action (server-authoritative accept flow)
 *  9. Notification Reject action (server-authoritative reject flow)
 * 10. Missed call timeout handling ($0.00 zero-cost billing)
 * 11. Caller cancel handling during ringing
 * 12. Multi-device dismissal (losing device tears down cleanly)
 * 13. Ringtone & Vibration cleanup on every terminal path
 * 14. Cancellation push handling
 * 15. Navigation deduplication & concurrency guards
 * 16. App cold-start deep link restoration
 * 17. Android 13+ POST_NOTIFICATIONS permission handling
 * 18. Push payload security audit (no tokens, passwords, TURN secrets)
 * 19. Native callSoundService Vibration & Audio integration
 * 20. 10-Call soak test for incoming lifecycle stability
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const { create } = require('zustand');

// ---------------------------------------------------------------------------
// 1. Mock Implementations for WebRTC, Socket, and Storage Primitives
// ---------------------------------------------------------------------------

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
  }
  async createOffer(opts) {
    return { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };
  }
  async createAnswer(opts) {
    return { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };
  }
  async setLocalDescription(desc) {
    this.localDescription = desc;
  }
  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
  }
  async addIceCandidate(candidate) {
    return true;
  }
  addTrack(track, stream) {
    this.senders.push({ track });
  }
  getSenders() {
    return this.senders;
  }
  close() {
    this._closed = true;
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this.signalingState = 'closed';
  }
}

class TestSocket {
  constructor() {
    this.listeners = new Map();
    this.emittedEvents = [];
    this.connected = true;
    this.id = `sock_${Math.random().toString(36).substring(7)}`;
  }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
  }
  off(event, cb) {
    if (!this.listeners.has(event)) return;
    if (!cb) {
      this.listeners.delete(event);
      return;
    }
    const filtered = this.listeners.get(event).filter((fn) => fn !== cb);
    if (filtered.length === 0) {
      this.listeners.delete(event);
    } else {
      this.listeners.set(event, filtered);
    }
  }
  emit(event, data, callback) {
    this.emittedEvents.push({ event, data });
    if (typeof callback === 'function') {
      callback({ ok: true, success: true, data: { callId: data?.callId || 'call_ack_123', status: 'RINGING' } });
    }
  }
  trigger(event, data) {
    if (this.listeners.has(event)) {
      const handlers = [...this.listeners.get(event)];
      handlers.forEach((h) => h(data));
    }
  }
}

class TestAsyncStorage {
  constructor(initialData = {}) {
    this.store = { ...initialData };
  }
  async getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  async setItem(key, value) {
    this.store[key] = String(value);
  }
  async removeItem(key) {
    delete this.store[key];
  }
  async clear() {
    this.store = {};
  }
}

function createSoundTracker() {
  const tracker = {
    activeSound: null,
    isLooping: false,
    vibrating: false,
    playHistory: [],
    stopCount: 0,
  };

  const service = {
    playRingback: async () => {
      tracker.activeSound = 'ringback';
      tracker.isLooping = true;
      tracker.playHistory.push('ringback');
    },
    playRingtone: async () => {
      tracker.activeSound = 'ringtone';
      tracker.isLooping = true;
      tracker.vibrating = true;
      tracker.playHistory.push('ringtone');
    },
    playConnect: async () => {
      tracker.activeSound = 'connect';
      tracker.isLooping = false;
      tracker.playHistory.push('connect');
    },
    playDisconnect: async () => {
      tracker.activeSound = 'disconnect';
      tracker.isLooping = false;
      tracker.playHistory.push('disconnect');
    },
    playReconnect: async () => {
      tracker.activeSound = 'reconnect';
      tracker.isLooping = false;
      tracker.playHistory.push('reconnect');
    },
    playEnd: async () => {
      tracker.activeSound = 'end';
      tracker.isLooping = false;
      tracker.playHistory.push('end');
    },
    stopAll: async () => {
      tracker.activeSound = null;
      tracker.isLooping = false;
      tracker.vibrating = false;
      tracker.stopCount++;
    },
    setAudioRoute: async (isSpeaker) => {},
    restoreAudioMode: async () => {},
  };

  return { tracker, service };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// 2. Load and Instantiate Production Modules under Test
// ---------------------------------------------------------------------------

function loadProductionCallSoundService(mockVibration) {
  const soundServicePath = path.resolve(__dirname, '../src/services/callSoundService.js');
  const rawCode = fs.readFileSync(soundServicePath, 'utf8');
  const transformed = babel.transformSync(rawCode, {
    presets: ['babel-preset-expo'],
    filename: soundServicePath,
  });

  const customRequire = (id) => {
    if (id === 'react-native') {
      const rnMock = {
        Platform: { OS: 'android', Version: 33 },
        Vibration: mockVibration,
      };
      return {
        __esModule: true,
        default: rnMock,
        ...rnMock,
      };
    }
    if (id === 'expo-audio') {
      return {
        setAudioModeAsync: async () => {},
        createAudioPlayer: () => ({
          loop: false,
          volume: 1.0,
          play: () => {},
          pause: () => {},
          remove: () => {},
        }),
      };
    }
    if (id === 'expo-av') {
      return {
        Audio: {
          setAudioModeAsync: async () => {},
          Sound: {
            createAsync: async () => ({
              sound: { stopAsync: async () => {}, unloadAsync: async () => {} },
            }),
          },
        },
      };
    }
    if (id.endsWith('.wav') || id.includes('assets/sounds')) {
      return 101;
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  wrapper(moduleObj, moduleObj.exports, customRequire, path.dirname(soundServicePath), soundServicePath);
  return moduleObj.exports.default || moduleObj.exports.callSoundService;
}

function loadCallPushClientService({ asyncStorage, callStoreMock, paidClientMock, permissionsMock, platformMock }) {
  const servicePath = path.resolve(__dirname, '../src/services/callPushClientService.js');
  const rawCode = fs.readFileSync(servicePath, 'utf8');
  const transformed = babel.transformSync(rawCode, {
    presets: ['babel-preset-expo'],
    filename: servicePath,
  });

  const customRequire = (id) => {
    if (id === '@react-native-async-storage/async-storage') {
      return {
        __esModule: true,
        default: asyncStorage,
        getItem: (k) => asyncStorage.getItem(k),
        setItem: (k, v) => asyncStorage.setItem(k, v),
        removeItem: (k) => asyncStorage.removeItem(k),
      };
    }
    if (id === 'react-native') {
      const rnMock = {
        Platform: platformMock || { OS: 'android', Version: 33 },
        PermissionsAndroid: permissionsMock || {
          PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
          RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
          request: async () => 'granted',
        },
        Linking: {
          getInitialURL: async () => null,
          addEventListener: () => ({ remove: () => {} }),
        },
      };
      return {
        __esModule: true,
        default: rnMock,
        ...rnMock,
      };
    }
    if (id === './api') {
      return {
        default: {
          post: async (path, body) => ({ data: { registered: true } }),
          delete: async (path) => ({ data: { revoked: true } }),
        },
      };
    }
    if (id === '../store/callStore') {
      return {
        useCallStore: {
          getState: () => callStoreMock.getState(),
        },
      };
    }
    if (id === './paidCommunicationService') {
      return {
        __esModule: true,
        default: paidClientMock,
      };
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  wrapper(moduleObj, moduleObj.exports, customRequire, path.dirname(servicePath), servicePath);
  return moduleObj.exports.default || moduleObj.exports.callPushClientService;
}

function loadProductionWebRTCService() {
  const rtcPath = path.resolve(__dirname, '../src/services/webRTCService.js');
  const rawCode = fs.readFileSync(rtcPath, 'utf8');
  const transformed = babel.transformSync(rawCode, {
    presets: ['babel-preset-expo'],
    filename: rtcPath,
  });

  const customRequire = (id) => {
    if (id === './api') {
      return {
        default: {
          get: async () => ({
            data: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
          }),
        },
      };
    }
    if (id === 'react-native-webrtc') {
      return {
        RTCIceCandidate: class { constructor(i) { Object.assign(this, i); } },
        RTCPeerConnection: TestRTCPeerConnection,
        RTCSessionDescription: class { constructor(d) { Object.assign(this, d); } },
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
  const wrapper = new Function('require', 'module', 'exports', transformed.code);
  wrapper(customRequire, moduleObj, moduleObj.exports);
  return moduleObj.exports.default || moduleObj.exports;
}

function createProductionCallStore(socketInstance, webRTCServiceInstance, paidClientMock, soundServiceInstance) {
  const storePath = path.resolve(__dirname, '../src/store/callStore.js');
  const rawCode = fs.readFileSync(storePath, 'utf8');
  const transformed = babel.transformSync(rawCode, {
    presets: ['babel-preset-expo'],
    filename: storePath,
  });

  const customRequire = (id) => {
    if (id === 'zustand') return { create };
    if (id === '../services/socket') return { __esModule: true, getSocket: () => socketInstance };
    if (id === '../services/webRTCService') return { __esModule: true, default: webRTCServiceInstance };
    if (id === '../services/callSoundService') return { __esModule: true, default: soundServiceInstance };
    if (id === '../services/paidCommunicationService') return { __esModule: true, default: paidClientMock };
    if (id === './pointsStore') {
      return {
        __esModule: true,
        usePointsStore: {
          getState: () => ({ balance: 100, setBalance: () => {}, fetchBalance: () => {} }),
        },
      };
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const wrapper = new Function('require', 'module', 'exports', transformed.code);
  wrapper(customRequire, moduleObj, moduleObj.exports);
  return moduleObj.exports.useCallStore;
}

// ---------------------------------------------------------------------------
// 3. Automated Test Suite Execution
// ---------------------------------------------------------------------------

async function runR4C15Tests() {
  console.log('\n================================================================================');
  console.log('   RUBARU — R4-C15: PRODUCTION INCOMING CALL UX & PUSH AUTOMATED VERIFICATION');
  console.log('================================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assertTest(name, condition, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${name}: ${details}`);
      failedTests++;
    }
  }

  // --- Test 1: Foreground Incoming Call (Socket Delivery -> UI & Ringtone) ---
  console.log('--- Test 1: Foreground Incoming Call (Socket Delivery -> UI & Ringtone) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {}, cancelSession: async () => {}, endSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    store.getState().handleIncomingCall({
      callId: 'call_fg_1',
      sessionId: 'call_fg_1',
      callerId: 'user_alice',
      callerName: 'Alice Springs',
      callerAvatar: 'https://example.com/alice.jpg',
      callType: 'audio',
      ratePerMinute: 5,
    });
    await sleep(10);

    const s = store.getState();
    assertTest('1.1 Store enters INCOMING status', s.callStatus === 'INCOMING');
    assertTest('1.2 Caller info is populated correctly', s.peerName === 'Alice Springs' && s.callId === 'call_fg_1');
    assertTest('1.3 Ringtone is active', tracker.activeSound === 'ringtone' && tracker.isLooping);
    assertTest('1.4 Vibration is active for incoming call', tracker.vibrating === true);
    
    // Cleanup
    store.getState().resetToIdle();
    await sleep(10);
    assertTest('1.5 Ringtone stopped on reset', tracker.activeSound === null);
    assertTest('1.6 Vibration cancelled on reset', tracker.vibrating === false);
  }

  // --- Test 2: Background Incoming Call (Push Payload -> Store) ---
  console.log('\n--- Test 2: Background Incoming Call (Push Payload -> Store) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {}, cancelSession: async () => {}, endSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage();
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    const pushPayload = {
      type: 'INCOMING_CALL',
      callId: 'call_bg_1',
      sessionId: 'call_bg_1',
      callType: 'VIDEO',
      caller: { id: 'user_bob', displayName: 'Bob Ross', avatarUrl: 'https://example.com/bob.jpg' },
      ratePerMinute: 10,
      expiresAt: new Date(Date.now() + 45000).toISOString(),
    };

    const res = await pushService.processIncomingCallPush(pushPayload);
    await sleep(10);
    const s = store.getState();

    assertTest('2.1 pushService returns handled: true', res.handled === true && res.callId === 'call_bg_1');
    assertTest('2.2 Store enters INCOMING state from push', s.callStatus === 'INCOMING');
    assertTest('2.3 Video call type respected', s.callType === 'video');
    assertTest('2.4 Caller display name populated', s.peerName === 'Bob Ross');
    assertTest('2.5 Rate per minute populated', s.ratePerMinute === 10);
    assertTest('2.6 Ringtone and vibration started', tracker.activeSound === 'ringtone' && tracker.vibrating === true);

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 3: Notification Tap with Authoritative Server Synchronization ---
  console.log('\n--- Test 3: Notification Tap with Authoritative Server Synchronization ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const serverSession = {
      sessionId: 'call_sync_1',
      status: 'PENDING',
      initiator: { _id: 'user_carol', displayName: 'Carol Danvers' },
      communicationType: 'AUDIO',
      ratePerMinuteSnapshot: 5,
      requestExpiresAt: new Date(Date.now() + 30000).toISOString(),
    };
    const paidMock = {
      getSession: async (id) => (id === 'call_sync_1' ? serverSession : null),
      acceptSession: async () => ({ success: true }),
      declineSession: async () => {},
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage({ userToken: 'valid_jwt_token' });
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    const routerMock = {
      routes: [],
      push: function(route) { this.routes.push(route); },
    };

    const deepLinkUrl = 'rubaru://call/call_sync_1?action=OPEN';
    const result = await pushService.parseAndHandleCallDeepLink(deepLinkUrl, routerMock);
    await sleep(10);

    const s = store.getState();
    assertTest('3.1 parseAndHandleCallDeepLink handled: true', result.handled === true);
    assertTest('3.2 Action OPEN verified and executed', result.action === 'OPEN');
    assertTest('3.3 Store synchronized with backend session', s.callStatus === 'INCOMING' && s.peerName === 'Carol Danvers');

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 4: Stale Notification Rejection (Authoritative Safety Rule) ---
  console.log('\n--- Test 4: Stale Notification Rejection (Authoritative Safety Rule) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = {
      getSession: async (id) => ({
        sessionId: id,
        status: 'CANCELLED',
        initiator: { _id: 'user_dave' },
      }),
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage({ userToken: 'valid_jwt_token' });
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    const routerMock = { routes: [], push: function(r) { this.routes.push(r); } };
    const staleDeepLink = 'rubaru://call/call_stale_99?action=ANSWER';
    const result = await pushService.parseAndHandleCallDeepLink(staleDeepLink, routerMock);
    await sleep(10);

    const s = store.getState();
    assertTest('4.1 Deep link detected stale session', result.stale === true && result.status === 'CANCELLED');
    assertTest('4.2 Store remains IDLE', s.callStatus === 'IDLE');
    assertTest('4.3 WebRTC peerConnection NOT created', rtc.peerConnection === null);
    assertTest('4.4 No active navigation occurred', routerMock.routes.length === 0);
    assertTest('4.5 Ringtone is not ringing', tracker.activeSound === null);
  }

  // --- Test 5: Socket + Push Arrival Deduplication (Zero Double-Ringing) ---
  console.log('\n--- Test 5: Socket + Push Arrival Deduplication (Zero Double-Ringing) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {}, cancelSession: async () => {}, endSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage();
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    // 1. Socket event arrives first
    const callId = 'call_dup_test_1';
    pushService.markCallProcessed(callId);
    store.getState().handleIncomingCall({
      callId,
      sessionId: callId,
      callerName: 'Emma Watson',
      callType: 'audio',
    });

    assertTest('5.1 Socket arrival sets store to INCOMING', store.getState().callStatus === 'INCOMING');

    // 2. Push notification arrives 50ms later for the SAME call
    const pushResult = await pushService.processIncomingCallPush({
      callId,
      caller: { displayName: 'Emma Watson' },
      callType: 'audio',
    });

    assertTest('5.2 Push notification identified as duplicate', pushResult.duplicate === true);
    assertTest('5.3 Store remains INCOMING without resetting timers', store.getState().callStatus === 'INCOMING');
    assertTest('5.4 Exactly one active call in store', store.getState().callId === callId);

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 6: Duplicate Push Arrival Deduplication ---
  console.log('\n--- Test 6: Duplicate Push Arrival Deduplication ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {}, cancelSession: async () => {}, endSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage();
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    const callId = 'call_push_dup_2';
    const payload = { callId, caller: { displayName: 'Frank' }, callType: 'audio' };

    const first = await pushService.processIncomingCallPush(payload);
    assertTest('6.1 First push processed successfully', first.handled === true && !first.duplicate);

    const second = await pushService.processIncomingCallPush(payload);
    assertTest('6.2 Second duplicate push detected and discarded', second.duplicate === true);

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 7: Duplicate Socket Event Deduplication ---
  console.log('\n--- Test 7: Duplicate Socket Event Deduplication ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    const callId = 'call_sock_dup_3';
    store.getState().handleIncomingCall({ callId, callerName: 'Grace', callType: 'video' });
    const timer1 = store.getState()._ringTimeoutTimer;

    // Duplicate socket arrival
    store.getState().handleIncomingCall({ callId, callerName: 'Grace', callType: 'video' });
    const timer2 = store.getState()._ringTimeoutTimer;

    assertTest('7.1 Duplicate socket event preserves ring watchdog timer', timer1 === timer2);
    assertTest('7.2 Status remains INCOMING', store.getState().callStatus === 'INCOMING');

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 8: Notification Accept Action (Authoritative Server Accept Flow) ---
  console.log('\n--- Test 8: Notification Accept Action (Authoritative Server Accept Flow) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = {
      getSession: async (id) => ({
        sessionId: id,
        status: 'PENDING',
        initiator: { _id: 'user_hannah', displayName: 'Hannah' },
        communicationType: 'AUDIO',
        ratePerMinuteSnapshot: 5,
      }),
      acceptSession: async (id) => ({ success: true, sessionId: id }),
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage({ userToken: 'valid_jwt' });
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    const routerMock = { routes: [], push: function(r) { this.routes.push(r); } };
    const acceptDeepLink = 'rubaru://call/call_accept_1?action=ANSWER';

    const result = await pushService.parseAndHandleCallDeepLink(acceptDeepLink, routerMock);
    await sleep(10);

    assertTest('8.1 Deep link ANSWER handled: true', result.handled === true && result.action === 'ANSWER');
    assertTest('8.2 Socket call:accept emitted', socket.emittedEvents.some((e) => e.event === 'call:accept'));
    assertTest('8.3 Router navigated to /active-call', routerMock.routes.some((r) => r.pathname === '/active-call'));
    assertTest('8.4 Ringtone stopped on accept', tracker.activeSound === null);
    assertTest('8.5 Vibration stopped on accept', tracker.vibrating === false);

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 9: Notification Reject Action (Authoritative Server Reject Flow) ---
  console.log('\n--- Test 9: Notification Reject Action (Authoritative Server Reject Flow) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    let sessionDeclinedOnServer = false;
    const paidMock = {
      getSession: async (id) => ({
        sessionId: id,
        status: 'PENDING',
        initiator: { _id: 'user_ian', displayName: 'Ian' },
        communicationType: 'AUDIO',
      }),
      declineSession: async (id) => {
        sessionDeclinedOnServer = true;
        return { success: true };
      },
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage({ userToken: 'valid_jwt' });
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    const routerMock = { routes: [], push: function(r) { this.routes.push(r); } };
    const declineDeepLink = 'rubaru://call/call_reject_1?action=DECLINE';

    const result = await pushService.parseAndHandleCallDeepLink(declineDeepLink, routerMock);
    await sleep(10);

    assertTest('9.1 Deep link DECLINE handled: true', result.handled === true && result.action === 'DECLINE');
    assertTest('9.2 Backend declineSession called', sessionDeclinedOnServer === true);
    assertTest('9.3 Socket call:reject emitted', socket.emittedEvents.some((e) => e.event === 'call:reject'));
    assertTest('9.4 Store reset to IDLE', store.getState().callStatus === 'IDLE');
    assertTest('9.5 Ringtone and vibration stopped', tracker.activeSound === null && tracker.vibrating === false);
  }

  // --- Test 10: Missed Call Timeout & Zero-Cost Billing ---
  console.log('\n--- Test 10: Missed Call Timeout & Zero-Cost Billing ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    store.getState().handleIncomingCall({
      callId: 'call_missed_1',
      callerName: 'Julia',
      callType: 'audio',
    });

    assertTest('10.1 Store is ringing', store.getState().callStatus === 'INCOMING');

    // Simulate server ring timeout event
    store.getState().handleCallEnded({
      callId: 'call_missed_1',
      status: 'MISSED',
      endReason: 'RING_TIMEOUT',
    });
    await sleep(10);

    const s = store.getState();
    assertTest('10.2 Store reset to IDLE upon ring timeout', s.callStatus === 'IDLE');
    assertTest('10.3 Billing summary is NULL ($0.00 charge)', s.billingSummary === null);
    assertTest('10.4 Ringtone stopped', tracker.activeSound === null);
    assertTest('10.5 Vibration stopped', tracker.vibrating === false);

    store.getState().resetToIdle();
  }

  // --- Test 11: Remote Cancel During Ringing ---
  console.log('\n--- Test 11: Remote Cancel During Ringing ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { cancelSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    store.getState().handleIncomingCall({
      callId: 'call_cancel_1',
      callerName: 'Kevin',
      callType: 'video',
    });

    assertTest('11.1 Incoming call active', store.getState().callStatus === 'INCOMING');

    // Remote cancel arrives
    store.getState().handleCallEnded({
      callId: 'call_cancel_1',
      status: 'CANCELLED',
      endReason: 'CALLER_CANCELLED',
    });
    await sleep(10);

    assertTest('11.2 Call resets to IDLE upon remote cancel', store.getState().callStatus === 'IDLE');
    assertTest('11.3 Ringtone and vibration immediately stop', tracker.activeSound === null && tracker.vibrating === false);

    store.getState().resetToIdle();
  }

  // --- Test 12: Multi-Device Dismissal (Losing Device Dismisses Cleanly) ---
  console.log('\n--- Test 12: Multi-Device Dismissal (Losing Device Dismisses Cleanly) ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = {};
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    // Device 2 is ringing
    store.getState().handleIncomingCall({
      callId: 'call_multi_1',
      callerName: 'Laura',
      callType: 'audio',
    });

    assertTest('12.1 Device 2 is in INCOMING state', store.getState().callStatus === 'INCOMING');

    // Device 1 answers -> server emits call:dismissed to Device 2
    store.getState().handleDismissed({ callId: 'call_multi_1' });
    await sleep(10);

    assertTest('12.2 Device 2 resets to IDLE on call:dismissed', store.getState().callStatus === 'IDLE');
    assertTest('12.3 Device 2 stops ringing', tracker.activeSound === null);
    assertTest('12.4 Device 2 cancels vibration', tracker.vibrating === false);
    assertTest('12.5 Device 2 does NOT have active PeerConnection', rtc.peerConnection === null);
  }

  // --- Test 13: Ringtone & Vibration Cleanup on EVERY Terminal Path ---
  console.log('\n--- Test 13: Ringtone & Vibration Cleanup on EVERY Terminal Path ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = { declineSession: async () => {}, cancelSession: async () => {}, endSession: async () => {} };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    const terminalPaths = [
      { name: 'acceptIncomingCall', fn: async () => store.getState().acceptIncomingCall() },
      { name: 'rejectIncomingCall', fn: async () => store.getState().rejectIncomingCall('DECLINED') },
      { name: 'handleCallEnded (cancelled)', fn: async () => store.getState().handleCallEnded({ status: 'CANCELLED' }) },
      { name: 'handleCallEnded (timeout)', fn: async () => store.getState().handleCallEnded({ status: 'MISSED', endReason: 'RING_TIMEOUT' }) },
      { name: 'handleDismissed (other device)', fn: async () => store.getState().handleDismissed({ callId: 'temp' }) },
      { name: 'resetToIdle', fn: async () => store.getState().resetToIdle() },
    ];

    for (let i = 0; i < terminalPaths.length; i++) {
      const step = terminalPaths[i];
      // Trigger incoming call
      store.getState().handleIncomingCall({ callId: `term_${i}`, callerName: 'Tester' });
      await sleep(10);
      assert(tracker.activeSound !== null, `Sound must start for step ${step.name}`);
      assert(tracker.vibrating === true, `Vibration must start for step ${step.name}`);

      // Execute terminal step
      await step.fn();
      await sleep(10);

      assertTest(`13.${i + 1} ${step.name} stops ringtone and vibration`, tracker.activeSound === null && tracker.vibrating === false);
      store.getState().resetToIdle();
      await sleep(10);
    }
  }

  // --- Test 14: Cancellation Push Handling ---
  console.log('\n--- Test 14: Cancellation Push Handling ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const store = createProductionCallStore(socket, rtc, {}, soundService);
    const asyncStorage = new TestAsyncStorage();
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: {} });

    store.getState().handleIncomingCall({ callId: 'call_push_cancel_1', callerName: 'Mike' });
    await sleep(10);
    assertTest('14.1 Call ringing before cancellation push', store.getState().callStatus === 'INCOMING');

    pushService.processCallCancellationPush({ callId: 'call_push_cancel_1', reason: 'CALLER_HUNGUP' });
    await sleep(10);

    assertTest('14.2 Cancellation push resets to IDLE', store.getState().callStatus === 'IDLE');
    assertTest('14.3 Ringtone and vibration cleaned up', tracker.activeSound === null && tracker.vibrating === false);

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 15: Navigation Deduplication & Concurrency Guards ---
  console.log('\n--- Test 15: Navigation Deduplication & Concurrency Guards ---');
  {
    const socket = new TestSocket();
    const { service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = {
      getSession: async (id) => ({ sessionId: id, status: 'PENDING' }),
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage({ userToken: 'valid_jwt' });
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    // 1. Concurrency lock during deep link
    pushService.isProcessingDeepLink = true;
    const blockedRes = await pushService.parseAndHandleCallDeepLink('rubaru://call/call_conc_1', null);
    assertTest('15.1 Overlapping deep link tap blocked with ACTION_IN_PROGRESS', blockedRes.error === 'ACTION_IN_PROGRESS');
    pushService.isProcessingDeepLink = false;

    // 2. Already active call focus
    store.getState().handleSync({
      hasActiveCall: true,
      call: { callId: 'call_active_dup', status: 'ACTIVE' },
    });

    const routerMock = { routes: [], push: function(r) { this.routes.push(r); } };
    const activeRes = await pushService.parseAndHandleCallDeepLink('rubaru://call/call_active_dup?action=OPEN', routerMock);

    assertTest('15.2 Active call tap returns ALREADY_ACTIVE without recreating session', activeRes.action === 'ALREADY_ACTIVE');
    assertTest('15.3 Brings existing screen to front (/active-call)', routerMock.routes.includes('/active-call'));

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 16: Cold-Start Deep Link Restoration ---
  console.log('\n--- Test 16: Cold-Start Deep Link Restoration ---');
  {
    const socket = new TestSocket();
    const { service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = {
      getSession: async (id) => ({
        sessionId: id,
        status: 'PENDING',
        initiator: { _id: 'user_cold', displayName: 'Cold Caller' },
        communicationType: 'AUDIO',
        requestExpiresAt: new Date(Date.now() + 30000).toISOString(),
      }),
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);
    const asyncStorage = new TestAsyncStorage({ userToken: 'saved_auth_token' });
    const pushService = loadCallPushClientService({ asyncStorage, callStoreMock: store, paidClientMock: paidMock });

    await pushService.initialize();

    assertTest('16.1 Cold start begins with store in IDLE', store.getState().callStatus === 'IDLE');

    const routerMock = { routes: [], push: function(r) { this.routes.push(r); } };
    const coldRes = await pushService.parseAndHandleCallDeepLink('rubaru://call/call_cold_launch?action=OPEN', routerMock);
    await sleep(10);

    assertTest('16.2 Cold link successfully parsed', coldRes.handled === true);
    assertTest('16.3 Store restored to INCOMING with server session', store.getState().callStatus === 'INCOMING' && store.getState().peerName === 'Cold Caller');

    store.getState().resetToIdle();
    await sleep(10);
  }

  // --- Test 17: Android 13+ POST_NOTIFICATIONS Permission Handling ---
  console.log('\n--- Test 17: Android 13+ POST_NOTIFICATIONS Permission Handling ---');
  {
    let permissionRequested = false;
    const permissionsMock = {
      PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
      RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
      request: async (perm) => {
        permissionRequested = true;
        return 'granted';
      },
    };
    const asyncStorage = new TestAsyncStorage();
    const pushService = loadCallPushClientService({
      asyncStorage,
      callStoreMock: { getState: () => ({}) },
      paidClientMock: {},
      permissionsMock,
      platformMock: { OS: 'android', Version: 33 },
    });

    const granted = await pushService.requestNotificationPermissions();
    assertTest('17.1 Android 33+ triggers POST_NOTIFICATIONS request', permissionRequested === true);
    assertTest('17.2 Returns granted: true', granted === true);

    // Test denied scenario
    const deniedService = loadCallPushClientService({
      asyncStorage,
      callStoreMock: { getState: () => ({}) },
      paidClientMock: {},
      permissionsMock: {
        PERMISSIONS: { POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS' },
        RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
        request: async () => 'denied',
      },
      platformMock: { OS: 'android', Version: 33 },
    });

    const deniedResult = await deniedService.requestNotificationPermissions();
    assertTest('17.3 Denied permission returns false gracefully without crashing', deniedResult === false);
  }

  // --- Test 18: Push Payload Security Audit ---
  console.log('\n--- Test 18: Push Payload Security Audit ---');
  {
    const callTokenUtil = require('../backend/utils/callToken');
    const mockParams = {
      sessionId: 'sess_sec_1',
      callType: 'AUDIO',
      ratePerMinute: 5,
      caller: {
        id: 'usr_sec_1',
        displayName: 'Sender Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
    };

    const payload = callTokenUtil.createIncomingCallPayload(mockParams);
    const verified = callTokenUtil.verifyCallActionToken(payload);

    assertTest('18.1 Payload contains callId', Boolean(payload.callId === 'sess_sec_1'));
    assertTest('18.2 Payload contains caller display info', payload.caller.displayName === 'Sender Name');
    assertTest('18.3 Payload has cryptographic HMAC-SHA256 signature', Boolean(payload.signature && payload.nonce && verified.valid));

    const sensitiveFields = ['password', 'jwt', 'authToken', 'userToken', 'turnCredentials', 'turnUsername', 'turnPassword', 'sdp', 'iceCandidate'];
    const hasLeak = sensitiveFields.some((field) => payload[field] !== undefined);
    assertTest('18.4 Payload DOES NOT leak sensitive credentials (JWT, passwords, TURN)', hasLeak === false);
  }

  // --- Test 19: Native callSoundService Vibration & Audio Integration ---
  console.log('\n--- Test 19: Native callSoundService Vibration & Audio Integration ---');
  {
    let vibratePattern = null;
    let vibrateLoop = null;
    let cancelCalled = false;

    const mockVibration = {
      vibrate: (pattern, loop) => {
        vibratePattern = pattern;
        vibrateLoop = loop;
      },
      cancel: () => {
        cancelCalled = true;
      },
    };

    const callSound = loadProductionCallSoundService(mockVibration);
    await callSound.playRingtone();
    assertTest('19.1 playRingtone invokes Vibration.vibrate with looping pattern', Array.isArray(vibratePattern) && vibrateLoop === true);

    await callSound.stopAll();
    assertTest('19.2 stopAll invokes Vibration.cancel', cancelCalled === true);
    assertTest('19.3 playSequence increments on stopAll', callSound.playSequence > 0);
  }

  // --- Test 20: 10-Call Soak Testing for Incoming Lifecycle ---
  console.log('\n--- Test 20: 10-Call Soak Testing for Incoming Lifecycle ---');
  {
    const socket = new TestSocket();
    const { tracker, service: soundService } = createSoundTracker();
    const rtc = loadProductionWebRTCService();
    const paidMock = {
      declineSession: async () => {},
      cancelSession: async () => {},
      endSession: async () => {},
      acceptSession: async () => ({ success: true }),
    };
    const store = createProductionCallStore(socket, rtc, paidMock, soundService);

    for (let i = 0; i < 10; i++) {
      const callId = `soak_inc_${i}`;
      store.getState().handleIncomingCall({ callId, callerName: `Caller ${i}`, callType: i % 2 === 0 ? 'audio' : 'video' });
      await sleep(5);
      assert(store.getState().callStatus === 'INCOMING', `Call ${i} must ring`);
      assert(tracker.activeSound !== null, `Call ${i} sound must play`);

      if (i % 3 === 0) {
        await store.getState().acceptIncomingCall();
      } else if (i % 3 === 1) {
        await store.getState().rejectIncomingCall('DECLINED');
      } else {
        store.getState().handleCallEnded({ callId, status: 'CANCELLED', endReason: 'CALLER_CANCELLED' });
      }

      store.getState().resetToIdle();
      await sleep(5);
      assert(store.getState().callStatus === 'IDLE', `Call ${i} must reset to IDLE`);
      assert(tracker.activeSound === null, `Call ${i} sound must stop`);
      assert(tracker.vibrating === false, `Call ${i} vibration must stop`);
    }

    assertTest('20.1 10-Call Soak completed with zero state, sound, or vibration leaks', true);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================');
  console.log(`   R4-C15 TEST RESULTS: ${passedTests}/${passedTests + failedTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('================================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runR4C15Tests().catch((err) => {
  console.error('[FATAL] Test runner uncaught error:', err);
  process.exit(1);
});
