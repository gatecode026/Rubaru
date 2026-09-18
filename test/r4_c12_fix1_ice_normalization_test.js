/**
 * RUBARU R4-C12 FIX 1: ICE CANDIDATE NORMALIZATION & REMOTE DESCRIPTION RACE VERIFICATION SUITE
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Mock RTCIceCandidate to simulate react-native-webrtc behavior exactly
class MockRTCIceCandidate {
  constructor(info) {
    if (typeof info === 'string') {
      this.candidate = info;
      this.sdpMid = null;
      this.sdpMLineIndex = null;
    } else if (info && typeof info === 'object') {
      this.candidate = info.candidate;
      this.sdpMid = info.sdpMid;
      this.sdpMLineIndex = info.sdpMLineIndex;
    } else {
      this.candidate = '';
      this.sdpMid = null;
      this.sdpMLineIndex = null;
    }

    // Exact react-native-webrtc constraint check
    if (this.sdpMLineIndex === null && this.sdpMid === null) {
      throw new TypeError('sdpMLineIndex and sdpMid must not be both null');
    }
  }
}

// Mock RTCPeerConnection to track state transitions and candidate invocations
class MockRTCPeerConnection {
  constructor() {
    this.signalingState = 'stable';
    this.remoteDescription = null;
    this.localDescription = null;
    this.addedCandidates = [];
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
    if (desc && desc.type === 'offer') {
      this.signalingState = 'have-local-offer';
    } else if (desc && desc.type === 'answer') {
      this.signalingState = 'stable';
    }
  }

  async setRemoteDescription(desc) {
    // Standard WebRTC state machine checks
    if (desc.type === 'answer' && this.signalingState !== 'have-local-offer') {
      throw new Error(`Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Failed to set remote answer sdp: Called in wrong state: ${this.signalingState}`);
    }
    this.remoteDescription = desc;
    if (desc.type === 'offer') {
      this.signalingState = 'have-remote-offer';
    } else if (desc.type === 'answer') {
      this.signalingState = 'stable';
    }
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'v=0\r\no=test 2 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
  }

  async addIceCandidate(candidate) {
    if (!this.remoteDescription) {
      throw new Error("Failed to execute 'addIceCandidate' on 'RTCPeerConnection': The remote description was null");
    }
    this.addedCandidates.push(candidate);
    return true;
  }

  close() {
    this.signalingState = 'closed';
  }
}

// Compile and load webRTCService.js using babel in-memory
function loadWebRTCService() {
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
          post: async () => ({ data: { iceServers: [] } }),
        },
      };
    }
    if (id === 'react-native-webrtc') {
      return {
        RTCIceCandidate: MockRTCIceCandidate,
        RTCPeerConnection: MockRTCPeerConnection,
        RTCSessionDescription: class MockRTCSessionDescription {
          constructor(desc) {
            this.type = desc.type;
            this.sdp = desc.sdp;
          }
        },
        mediaDevices: {},
        RTCView: () => null,
      };
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', '__dirname', '__filename', transformed.code);
  wrapper(moduleObj, moduleObj.exports, customRequire, path.dirname(servicePath), servicePath);

  return moduleObj.exports.default;
}

async function runR4C12Fix1Tests() {
  console.log('================================================================================');
  console.log('   RUBARU R4-C12 FIX 1: ICE CANDIDATE NORMALIZATION & RACE VERIFICATION       ');
  console.log('================================================================================\n');

  const webRTCService = loadWebRTCService();
  let passedTests = 0;

  // TEST 1: Candidate Normalization (All Shapes)
  console.log('--- TEST 1: Candidate Normalization & React Native WebRTC Compatibility ---');
  {
    // Shape A: Standard Socket.io candidate payload from event
    const shapeA = {
      candidate: 'candidate:2087532386 1 udp 2122260223 192.168.1.5 54321 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };
    const normA = webRTCService._normalizeCandidate(shapeA);
    assert.strictEqual(normA.normalized.candidate, shapeA.candidate);
    assert.strictEqual(normA.normalized.sdpMid, '0');
    assert.strictEqual(normA.normalized.sdpMLineIndex, 0);

    // Verify it doesn't throw TypeError in MockRTCIceCandidate
    const rtcCandA = new MockRTCIceCandidate(normA.normalized);
    assert.strictEqual(rtcCandA.sdpMLineIndex, 0);

    // Shape B: Wrapped in candidate object with outer generation
    const shapeB = {
      callId: 'call_123',
      candidate: {
        candidate: 'candidate:123456789 1 udp 12345 10.0.0.1 6000 typ srflx',
        sdpMid: '1',
        sdpMLineIndex: 1,
      },
      generation: 2,
    };
    const normB = webRTCService._normalizeCandidate(shapeB);
    assert.strictEqual(normB.normalized.candidate, shapeB.candidate.candidate);
    assert.strictEqual(normB.normalized.sdpMid, '1');
    assert.strictEqual(normB.normalized.sdpMLineIndex, 1);
    assert.strictEqual(normB.generation, 2);

    // Shape C: Bare string candidate (missing sdpMid and sdpMLineIndex)
    const shapeC = 'candidate:999 1 udp 123 10.0.0.2 7000 typ host';
    const normC = webRTCService._normalizeCandidate(shapeC);
    assert.strictEqual(normC.normalized.candidate, shapeC);
    // Crucial check: sdpMLineIndex must default to 0 so react-native-webrtc does not throw TypeError!
    assert.strictEqual(normC.normalized.sdpMLineIndex, 0);
    assert.doesNotThrow(() => new MockRTCIceCandidate(normC.normalized));

    // Shape D: Empty or invalid input
    assert.strictEqual(webRTCService._normalizeCandidate(null), null);
    assert.strictEqual(webRTCService._normalizeCandidate({}), null);

    console.log('  [PASS] Candidate normalization correctly handles all payload formats and satisfies RTCIceCandidate constraints.');
    passedTests++;
  }

  // TEST 2: Early Remote ICE Candidate Buffering (Prevent Remote Description Race)
  console.log('\n--- TEST 2: Early Remote ICE Candidate Buffering ---');
  {
    webRTCService.destroy();
    const mockPc = new MockRTCPeerConnection();
    webRTCService.peerConnection = mockPc;

    const earlyCandidate = {
      candidate: 'candidate:early 1 udp 2122260223 192.168.1.100 5000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    // Candidate arrives BEFORE setRemoteDescription
    assert.strictEqual(mockPc.remoteDescription, null);
    assert.strictEqual(webRTCService._isRemoteDescriptionReady(), false);

    await webRTCService.addIceCandidate(earlyCandidate);

    // Must be queued in pendingCandidates, NOT added to peerConnection (which would throw)
    assert.strictEqual(mockPc.addedCandidates.length, 0);
    assert.strictEqual(webRTCService.pendingCandidates.length, 1);
    assert.strictEqual(webRTCService.pendingCandidates[0].candidate, earlyCandidate.candidate);

    console.log('  [PASS] Early candidate successfully queued in pendingCandidates without calling addIceCandidate prematurely.');
    passedTests++;
  }

  // TEST 3: Queued Candidate Flushing after setRemoteDescription (Offer Path)
  console.log('\n--- TEST 3: Flush Queued Candidates in Offer Path (Callee) ---');
  {
    const mockPc = webRTCService.peerConnection;
    const remoteOffer = {
      type: 'offer',
      sdp: 'v=0\r\no=caller 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
    };

    // Receiver handles offer and creates answer
    await webRTCService.handleOfferAndCreateAnswer(remoteOffer);

    // Both remoteDescription should now be set AND pending candidates flushed!
    assert.notStrictEqual(mockPc.remoteDescription, null);
    assert.strictEqual(mockPc.addedCandidates.length, 1);
    assert.strictEqual(mockPc.addedCandidates[0].candidate, 'candidate:early 1 udp 2122260223 192.168.1.100 5000 typ host');
    assert.strictEqual(webRTCService.pendingCandidates.length, 0);

    console.log('  [PASS] Remote offer sets description and flushes queued candidates successfully.');
    passedTests++;
  }

  // TEST 4: Early Remote ICE Candidate Buffering & Flush (Answer Path - Caller)
  console.log('\n--- TEST 4: Early Buffering and Flush in Answer Path (Caller) ---');
  {
    webRTCService.destroy();
    const mockPc = new MockRTCPeerConnection();
    webRTCService.peerConnection = mockPc;

    // Caller creates offer
    await mockPc.setLocalDescription({
      type: 'offer',
      sdp: 'v=0\r\no=caller 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
    });
    assert.strictEqual(mockPc.signalingState, 'have-local-offer');

    // Callee ICE candidates arrive at Caller before answer arrives
    const cand1 = { candidate: 'candidate:c1 1 udp 1000 1.2.3.4 5000 typ srflx', sdpMid: '0', sdpMLineIndex: 0 };
    const cand2 = { candidate: 'candidate:c2 1 udp 2000 1.2.3.4 5001 typ relay', sdpMid: '0', sdpMLineIndex: 0 };

    await webRTCService.addIceCandidate(cand1);
    await webRTCService.addIceCandidate(cand2);

    assert.strictEqual(mockPc.addedCandidates.length, 0);
    assert.strictEqual(webRTCService.pendingCandidates.length, 2);

    // Answer arrives from Callee
    const remoteAnswer = {
      type: 'answer',
      sdp: 'v=0\r\no=callee 2 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
    };
    await webRTCService.handleAnswer(remoteAnswer);

    // Remote description set, candidates drained
    assert.strictEqual(mockPc.signalingState, 'stable');
    assert.strictEqual(mockPc.addedCandidates.length, 2);
    assert.strictEqual(webRTCService.pendingCandidates.length, 0);

    // Candidates arriving AFTER answer is set should be applied immediately
    const cand3 = { candidate: 'candidate:c3 1 udp 3000 1.2.3.4 5002 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    await webRTCService.addIceCandidate(cand3);
    assert.strictEqual(mockPc.addedCandidates.length, 3);
    assert.strictEqual(mockPc.addedCandidates[2].candidate, cand3.candidate);

    console.log('  [PASS] Answer path correctly buffers early candidates, drains them upon setRemoteDescription, and processes subsequent candidates immediately.');
    passedTests++;
  }

  // TEST 5: Duplicate Answer Rejection (Eliminate InvalidStateError)
  console.log('\n--- TEST 5: Duplicate Answer Rejection (SDP State Collision Protection) ---');
  {
    const mockPc = webRTCService.peerConnection;
    // mockPc signalingState is already 'stable' from TEST 4
    assert.strictEqual(mockPc.signalingState, 'stable');

    // Second duplicate answer arrives from redundant socket events (call:signal:answer + call.answer)
    const duplicateAnswer = {
      type: 'answer',
      sdp: 'v=0\r\no=callee 2 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
    };

    // Should NOT throw InvalidStateError because handleAnswer guards against wrong signalingState
    await assert.doesNotReject(async () => {
      await webRTCService.handleAnswer(duplicateAnswer);
    });

    console.log('  [PASS] Redundant answer safely ignored without triggering InvalidStateError.');
    passedTests++;
  }

  // TEST 6: Candidate Deduplication
  console.log('\n--- TEST 6: Candidate Deduplication ---');
  {
    const mockPc = webRTCService.peerConnection;
    const initialCandidateCount = mockPc.addedCandidates.length;

    const dupCandidate = {
      candidate: 'candidate:c3 1 udp 3000 1.2.3.4 5002 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };

    // Attempt to add duplicate candidate
    await webRTCService.addIceCandidate(dupCandidate);

    // Candidate count must remain unchanged
    assert.strictEqual(mockPc.addedCandidates.length, initialCandidateCount);

    console.log('  [PASS] Duplicate ICE candidate successfully detected and skipped.');
    passedTests++;
  }

  // TEST 7: Stale Generation Candidate Rejection
  console.log('\n--- TEST 7: Stale Generation Candidate Rejection ---');
  {
    const mockPc = webRTCService.peerConnection;
    const initialCount = mockPc.addedCandidates.length;
    webRTCService.currentNegotiationGeneration = 3;

    const staleCandidate = {
      candidate: 'candidate:stale 1 udp 999 1.2.3.4 5000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
      generation: 1, // older generation
    };

    await webRTCService.addIceCandidate(staleCandidate);
    assert.strictEqual(mockPc.addedCandidates.length, initialCount);

    console.log('  [PASS] Stale candidate from older generation successfully rejected.');
    passedTests++;
  }

  // TEST 8: Clean Destruction & Leak Prevention
  console.log('\n--- TEST 8: Clean Destruction & State Reset ---');
  {
    webRTCService.destroy();
    assert.strictEqual(webRTCService.peerConnection, null);
    assert.strictEqual(webRTCService.pendingCandidates.length, 0);
    assert.strictEqual(webRTCService.processedCandidateSignatures.size, 0);
    assert.strictEqual(webRTCService.isSettingRemoteDescription, false);

    console.log('  [PASS] webRTCService cleanly resets all candidate buffers, deduplication sets, and flags upon destroy().');
    passedTests++;
  }

  console.log('\n================================================================================');
  console.log(`   ALL ${passedTests}/8 FIX 1 VERIFICATION TESTS PASSED SUCCESSFULLY!            `);
  console.log('================================================================================\n');
}

runR4C12Fix1Tests().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
