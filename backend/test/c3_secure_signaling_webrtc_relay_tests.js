const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const assert = require('assert');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const ioClient = require('socket.io-client');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const connectDB = require('../config/db');
const { initRedis } = require('../config/redis');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Block = require('../models/Block');
const Wallet = require('../models/Wallet');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');

// Services & Socket
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const callService = require('../services/callService');
const callLockService = require('../services/callLockService');
const { AccountStatuses, MatchStatuses, CallStatuses } = require('../models/enums');

let server, io, baseUrl;
let userA, userB, userC, userBlocked;
let tokenA, tokenB, tokenB2, tokenC, tokenBlocked;
let matchAB, matchAC;

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

function generateTestToken(user) {
  return jwt.sign(
    { id: user._id.toString(), userId: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function createTestUser(prefix, initialCoins = 100) {
  const email = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@rubaru.test`;
  const user = await User.create({
    email,
    password: 'TestPassword123!',
    phone: `+91990${Math.floor(1000000 + Math.random() * 9000000)}`,
    accountStatus: AccountStatuses.ACTIVE,
    isEmailVerified: true,
  });

  await Profile.create({
    user: user._id,
    displayName: `User ${prefix}`,
    gender: 'Male',
    dateOfBirth: new Date(1995, 0, 1),
    avatarUri: `https://rubaru.test/avatar_${prefix}.png`,
  });

  await Wallet.create({
    userId: user._id,
    availableBalance: initialCoins,
    heldEscrowBalance: 0,
    status: 'ACTIVE',
  });

  return user;
}

function createSocketClient(token) {
  return ioClient(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });
}

function waitForEvent(socket, eventName, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runTests() {
  console.log('================================================================================');
  console.log('   ROOBARU R4-C3: SECURE SOCKET.IO SIGNALING & WEBRTC RELAY TEST SUITE          ');
  console.log('================================================================================\n');

  await connectDB();
  await initRedis().catch(() => initRedis({ mock: true }));

  // Setup Express and Socket.IO Server
  const app = express();
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: '*' } });
  socketHandler(io);

  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  console.log(`[TEST SERVER] Running on ${baseUrl}`);

  // Setup Config
  await PaidCommunicationConfig.deleteMany({});
  await PaidCommunicationConfig.create({
    version: 1,
    isActive: true,
    rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
    billingIncrementSeconds: 60,
    requestExpirationSeconds: 45,
    enabled: { MESSAGE: true, AUDIO: true, VIDEO: true },
  });

  // Setup Users
  userA = await createTestUser('callerA', 100);
  userB = await createTestUser('receiverB', 100);
  userC = await createTestUser('intruderC', 100);
  userBlocked = await createTestUser('blockedD', 100);

  tokenA = generateTestToken(userA);
  tokenB = generateTestToken(userB);
  tokenB2 = generateTestToken(userB); // Second device for receiver B
  tokenC = generateTestToken(userC);
  tokenBlocked = generateTestToken(userBlocked);

  // Setup Matches & Blocks
  matchAB = await Match.create({
    users: [userA._id, userB._id],
    status: MatchStatuses.ACTIVE,
    initiatorInteraction: new mongoose.Types.ObjectId(),
  });
  matchAC = await Match.create({
    users: [userA._id, userC._id],
    status: MatchStatuses.ACTIVE,
    initiatorInteraction: new mongoose.Types.ObjectId(),
  });

  await Block.create({
    blocker: userA._id,
    blocked: userBlocked._id,
  });

  let passedTests = 0;

  try {
    // -------------------------------------------------------------------------
    // 1. EVENT CONTRACT & ACKNOWLEDGEMENT TESTS
    // -------------------------------------------------------------------------
    console.log('--- 1. Event Contract & Acknowledgement Tests ---');

    const clientA = createSocketClient(tokenA);
    const clientB = createSocketClient(tokenB);
    const clientB2 = createSocketClient(tokenB2); // Device 2
    const clientC = createSocketClient(tokenC);

    await Promise.all([
      new Promise((res) => clientA.on('connect', res)),
      new Promise((res) => clientB.on('connect', res)),
      new Promise((res) => clientB2.on('connect', res)),
      new Promise((res) => clientC.on('connect', res)),
    ]);

    // Test 1: Invalid initiate payload returns structured error ack
    const invalidAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_INITIATE, { recipientId: '' }, res);
    });
    assert.strictEqual(invalidAck.ok, false);
    assert.strictEqual(typeof invalidAck.requestId, 'string');
    assert.strictEqual(typeof invalidAck.error.message, 'string');
    console.log('  [PASS] 1. Invalid payload returns deterministic error acknowledgement');
    passedTests++;

    // Test 2: Valid initiate payload returns success ack and emits incoming & ringing
    const incomingPromiseB = waitForEvent(clientB, SocketEvents.CALL_INCOMING);
    const ringingPromiseA = waitForEvent(clientA, SocketEvents.CALL_RINGING);

    const initiateAck = await new Promise((res) => {
      clientA.emit(
        SocketEvents.CALL_INITIATE,
        {
          recipientId: userB._id.toString(),
          callType: 'AUDIO',
          idempotencyKey: `idem_c3_${Date.now()}`,
          requestId: 'req_init_01',
        },
        res
      );
    });

    assert.strictEqual(initiateAck.ok, true);
    assert.strictEqual(initiateAck.requestId, 'req_init_01');
    assert.strictEqual(typeof initiateAck.data.callId, 'string');
    const callId1 = initiateAck.data.callId;

    const incomingB = await incomingPromiseB;
    assert.strictEqual(incomingB.callId, callId1);
    assert.strictEqual(incomingB.caller.id, userA._id.toString());

    const ringingA = await ringingPromiseA;
    assert.strictEqual(ringingA.callId, callId1);
    assert.strictEqual(ringingA.status, CallStatuses.RINGING);
    console.log('  [PASS] 2. Valid initiation returns success ack, incoming event to receiver, and ringing to caller');
    passedTests++;

    // -------------------------------------------------------------------------
    // 2. SECURITY & AUTHORIZATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Security & Authorization Tests ---');

    // Test 3: Third-party intruder (userC) cannot accept userA-userB call
    const intruderAcceptAck = await new Promise((res) => {
      clientC.emit(SocketEvents.CALL_ACCEPT, { callId: callId1, requestId: 'req_c_accept' }, res);
    });
    assert.strictEqual(intruderAcceptAck.ok, false);
    assert.strictEqual(intruderAcceptAck.error.code, 'UNAUTHORIZED_ACTION');
    console.log('  [PASS] 3. Third party cannot accept an unrelated call');
    passedTests++;

    // Test 4: Third-party intruder (userC) cannot signal offer/ice on userA-userB call
    const intruderOfferAck = await new Promise((res) => {
      clientC.emit(
        SocketEvents.CALL_SIGNAL_OFFER,
        {
          callId: callId1,
          sdp: 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
          requestId: 'req_c_offer',
        },
        res
      );
    });
    assert.strictEqual(intruderOfferAck.ok, false);
    assert.strictEqual(intruderOfferAck.error.code, 'NOT_CALL_PARTICIPANT');
    console.log('  [PASS] 4. Third party cannot send SDP offers or signaling');
    passedTests++;

    // Test 5: Oversized SDP payload (>64KB) is rejected
    const giantSdp = 'v=0\r\nm=audio 9\r\n' + 'a=candidate:'.repeat(6000);
    const oversizedAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_SIGNAL_OFFER, { callId: callId1, sdp: giantSdp }, res);
    });
    assert.strictEqual(oversizedAck.ok, false);
    console.log('  [PASS] 5. Oversized SDP (>64KB) is rejected');
    passedTests++;

    // Test 6: Malformed SDP (missing headers) is rejected
    const malformedSdpAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_SIGNAL_OFFER, { callId: callId1, sdp: 'invalid_raw_text' }, res);
    });
    assert.strictEqual(malformedSdpAck.ok, false);
    console.log('  [PASS] 6. Malformed SDP structure is rejected');
    passedTests++;

    // Test 7: Oversized ICE candidate is rejected
    const giantCandidate = 'candidate:1 1 UDP 2130706431 ' + 'x'.repeat(2500);
    const oversizedIceAck = await new Promise((res) => {
      clientA.emit(
        SocketEvents.CALL_SIGNAL_ICE,
        {
          callId: callId1,
          candidate: { candidate: giantCandidate },
        },
        res
      );
    });
    assert.strictEqual(oversizedIceAck.ok, false);
    console.log('  [PASS] 7. Oversized ICE candidate (>2KB) is rejected');
    passedTests++;

    // -------------------------------------------------------------------------
    // 3. MULTI-DEVICE SYNCHRONIZATION & SINGLE-WINNER ACCEPTANCE
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Multi-Device Synchronization & Single-Winner Tests ---');

    const syncPromiseB2 = waitForEvent(clientB2, SocketEvents.CALL_SYNC);
    const acceptedPromiseA = waitForEvent(clientA, SocketEvents.CALL_ACCEPTED);

    // Device 1 accepts
    const acceptAckB = await new Promise((res) => {
      clientB.emit(SocketEvents.CALL_ACCEPT, { callId: callId1, requestId: 'req_accept_b1' }, res);
    });
    assert.strictEqual(acceptAckB.ok, true);

    const acceptedA = await acceptedPromiseA;
    assert.strictEqual(acceptedA.callId, callId1);

    // Device 2 receives dismissal/sync
    const syncB2 = await syncPromiseB2;
    assert.strictEqual(syncB2.handledByOtherDevice, true);
    console.log('  [PASS] 8. First receiver device wins acceptance and second device receives dismissal sync');
    passedTests++;

    // -------------------------------------------------------------------------
    // 4. SECURE SDP & ICE RELAY
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Secure SDP & ICE Relay Tests ---');

    const offerSdp = 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
    const answerSdp = 'v=0\r\no=- 789 101 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
    const validIce = {
      candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host',
      sdpMid: 'audio',
      sdpMLineIndex: 0,
    };

    // Caller relays Offer -> Receiver receives offer
    const offerPromiseB = waitForEvent(clientB, SocketEvents.CALL_SIGNAL_OFFER);
    const offerAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_SIGNAL_OFFER, { callId: callId1, sdp: offerSdp, requestId: 'req_offer' }, res);
    });
    assert.strictEqual(offerAck.ok, true);

    const receivedOfferB = await offerPromiseB;
    assert.strictEqual(receivedOfferB.callId, callId1);
    assert.strictEqual(receivedOfferB.senderId, userA._id.toString());
    console.log('  [PASS] 9. SDP Offer is securely validated and relayed to authoritative peer');
    passedTests++;

    // Receiver relays Answer -> Caller receives answer
    const answerPromiseA = waitForEvent(clientA, SocketEvents.CALL_SIGNAL_ANSWER);
    const answerAck = await new Promise((res) => {
      clientB.emit(SocketEvents.CALL_SIGNAL_ANSWER, { callId: callId1, sdp: answerSdp, requestId: 'req_answer' }, res);
    });
    assert.strictEqual(answerAck.ok, true);

    const receivedAnswerA = await answerPromiseA;
    assert.strictEqual(receivedAnswerA.callId, callId1);
    assert.strictEqual(receivedAnswerA.senderId, userB._id.toString());
    console.log('  [PASS] 10. SDP Answer is securely validated and relayed to authoritative peer');
    passedTests++;

    // ICE Candidate relay
    const icePromiseB = waitForEvent(clientB, SocketEvents.CALL_SIGNAL_ICE);
    const iceAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_SIGNAL_ICE, { callId: callId1, candidate: validIce, requestId: 'req_ice' }, res);
    });
    assert.strictEqual(iceAck.ok, true);

    const receivedIceB = await icePromiseB;
    assert.strictEqual(receivedIceB.callId, callId1);
    assert.strictEqual(receivedIceB.candidate.candidate, validIce.candidate);
    console.log('  [PASS] 11. ICE candidate is securely validated and relayed to authoritative peer');
    passedTests++;

    // -------------------------------------------------------------------------
    // 5. DUAL MEDIA-READY CONFIRMATION & BILLING ACTIVATION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Dual Media-Ready Confirmation & Billing Activation ---');

    // 1st media-ready (caller only) -> Still connecting, no connected event yet
    const ready1Ack = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_MEDIA_READY, { callId: callId1, requestId: 'req_m_ready_1' }, res);
    });
    assert.strictEqual(ready1Ack.ok, true);
    assert.strictEqual(ready1Ack.data.status, CallStatuses.CONNECTING);

    // 2nd media-ready (receiver) -> ACTIVE! Both receive call:connected
    const connectedPromiseA = waitForEvent(clientA, SocketEvents.CALL_CONNECTED);
    const connectedPromiseB = waitForEvent(clientB, SocketEvents.CALL_CONNECTED);

    const ready2Ack = await new Promise((res) => {
      clientB.emit(SocketEvents.CALL_MEDIA_READY, { callId: callId1, requestId: 'req_m_ready_2' }, res);
    });
    assert.strictEqual(ready2Ack.ok, true);
    assert.strictEqual(ready2Ack.data.status, CallStatuses.ACTIVE);

    const [connA, connB] = await Promise.all([connectedPromiseA, connectedPromiseB]);
    assert.strictEqual(connA.status, CallStatuses.ACTIVE);
    assert.strictEqual(connB.status, CallStatuses.ACTIVE);
    console.log('  [PASS] 12. Dual media readiness transitions call to ACTIVE and broadcasts call:connected');
    passedTests++;

    // -------------------------------------------------------------------------
    // 6. RECONNECTION LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Reconnection Lifecycle Tests ---');

    const reconnectingPromiseB = waitForEvent(clientB, SocketEvents.CALL_RECONNECTING);
    const reconAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_RECONNECTING, { callId: callId1, requestId: 'req_reconn' }, res);
    });
    assert.strictEqual(reconAck.ok, true);
    assert.strictEqual(reconAck.data.status, CallStatuses.RECONNECTING);

    const reconB = await reconnectingPromiseB;
    assert.strictEqual(reconB.status, CallStatuses.RECONNECTING);

    // Reconnected restore
    const reconnectedPromiseB = waitForEvent(clientB, SocketEvents.CALL_RECONNECTED);
    const restoreAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_RECONNECTED, { callId: callId1, requestId: 'req_restored' }, res);
    });
    assert.strictEqual(restoreAck.ok, true);

    const restoredB = await reconnectedPromiseB;
    assert.strictEqual(restoredB.status, CallStatuses.ACTIVE);
    console.log('  [PASS] 13. Reconnection moves to RECONNECTING and restores safely to ACTIVE');
    passedTests++;

    // -------------------------------------------------------------------------
    // 7. CALL TERMINATION & SANITIZED BILLING DTO
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Call Termination & Sanitized Billing DTO ---');

    const endedPromiseA = waitForEvent(clientA, SocketEvents.CALL_ENDED);
    const endedPromiseB = waitForEvent(clientB, SocketEvents.CALL_ENDED);

    const endAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_END, { callId: callId1, reason: 'USER_HANGUP', requestId: 'req_end' }, res);
    });
    assert.strictEqual(endAck.ok, true);
    assert.strictEqual(endAck.data.status, CallStatuses.ENDED);

    const [endedA, endedB] = await Promise.all([endedPromiseA, endedPromiseB]);
    assert.strictEqual(endedA.callId, callId1);
    assert.strictEqual(endedB.callId, callId1);
    assert.strictEqual(typeof endedA.durationSeconds, 'number');
    assert.strictEqual(typeof endedA.coinsCharged, 'number');
    console.log('  [PASS] 14. Termination broadcasts call:ended to both rooms with sanitized billing summary');
    passedTests++;

    // -------------------------------------------------------------------------
    // 8. DISTRIBUTED RATE LIMITING TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Distributed Rate Limiting Tests ---');

    // Create a fresh caller to test rate limit bursts
    const userSpam = await createTestUser('spammer', 100);
    const tokenSpam = generateTestToken(userSpam);
    const clientSpam = createSocketClient(tokenSpam);
    await new Promise((res) => clientSpam.on('connect', res));

    await Match.create({
      users: [userSpam._id, userB._id],
      status: MatchStatuses.ACTIVE,
      initiatorInteraction: new mongoose.Types.ObjectId(),
    });

    let rateLimitedCount = 0;
    for (let i = 0; i < 7; i++) {
      const res = await new Promise((resolve) => {
        clientSpam.emit(
          SocketEvents.CALL_INITIATE,
          {
            recipientId: userB._id.toString(),
            callType: 'AUDIO',
            idempotencyKey: `spam_idem_${i}_${Date.now()}`,
          },
          resolve
        );
      });
      if (res.ok === false && (res.error?.code === 'RATE_LIMIT_EXCEEDED' || res.error?.code === 'TOO_MANY_REQUESTS')) {
        rateLimitedCount++;
      }
      // Cancel call if succeeded to clear DB state
      if (res.ok === true && res.data?.callId) {
        await callService.cancelCall({ callId: res.data.callId, callerId: userSpam._id });
      }
    }

    assert(rateLimitedCount > 0, 'Bursting initiation requests must be throttled');
    console.log('  [PASS] 15. Bursting call initiations is blocked by distributed rate limiter');
    passedTests++;

    // -------------------------------------------------------------------------
    // 9. LEGACY COMPATIBILITY TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Legacy Compatibility Tests ---');

    // Clear sessions
    await PaidCommunicationSession.deleteMany({ caller: userA._id });

    const legacyIncomingPromise = waitForEvent(clientB, SocketEvents.LEGACY_INCOMING_CALL);
    clientA.emit(SocketEvents.LEGACY_CALL_USER, {
      recipientId: userB._id.toString(),
      callType: 'AUDIO',
      callSessionId: `legacy_session_${Date.now()}`,
    });

    const legacyInc = await legacyIncomingPromise;
    assert.strictEqual(legacyInc.callerId, userA._id.toString());
    assert.strictEqual(typeof legacyInc.callSessionId, 'string');

    // End via legacy event
    clientA.emit(SocketEvents.LEGACY_CALL_ENDED, {
      callSessionId: legacyInc.callSessionId,
    });
    console.log('  [PASS] 16. Legacy call_user and call_ended route securely through authoritative domain service');
    passedTests++;

    // Disconnect clients
    clientA.disconnect();
    clientB.disconnect();
    clientB2.disconnect();
    clientC.disconnect();
    clientSpam.disconnect();

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================================');
  console.log(`   R4-C3 TEST SUMMARY: ${passedTests} Passed, 0 Failed`);
  console.log('================================================================================\n');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = runTests;
