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

const connectDB = require('../config/db');
const { initRedis, getPublisherClient, getSubscriberClient } = require('../config/redis');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Block = require('../models/Block');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');

// Services & Socket
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const callService = require('../services/callService');
const callLockService = require('../services/callLockService');
const callRateLimiter = require('../services/callRateLimiter');
const callMetrics = require('../services/callMetrics');
const { AccountStatuses, MatchStatuses, CallStatuses } = require('../models/enums');

let serverA, serverB, ioA, ioB, baseUrlA, baseUrlB;
let userA, userB, userC, userBlocked;
let tokenA, tokenA2, tokenB, tokenB2, tokenC;
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
    phone: `+91991${Math.floor(1000000 + Math.random() * 9000000)}`,
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

function createSocketClient(url, token) {
  return ioClient(url, {
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
  console.log('   ROOBARU R4-C3V: FINAL VERIFICATION & MULTI-INSTANCE TEST SUITE               ');
  console.log('================================================================================\n');

  await connectDB();
  await initRedis().catch(() => initRedis({ mock: true }));

  // --- SETUP MULTI-INSTANCE BACKEND TOPOLOGY ---
  // Instance A
  const appA = express();
  serverA = http.createServer(appA);
  ioA = new Server(serverA, { cors: { origin: '*' } });
  socketHandler(ioA);

  await new Promise((resolve) => {
    serverA.listen(0, () => {
      baseUrlA = `http://localhost:${serverA.address().port}`;
      resolve();
    });
  });

  // Instance B
  const appB = express();
  serverB = http.createServer(appB);
  ioB = new Server(serverB, { cors: { origin: '*' } });
  socketHandler(ioB);

  await new Promise((resolve) => {
    serverB.listen(0, () => {
      baseUrlB = `http://localhost:${serverB.address().port}`;
      resolve();
    });
  });

  console.log(`[TOPOLOGY] Multi-Instance Active: Instance A (${baseUrlA}) <-> Instance B (${baseUrlB})`);

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
  userA = await createTestUser('inst_callerA', 100);
  userB = await createTestUser('inst_receiverB', 100);
  userC = await createTestUser('inst_intruderC', 100);
  userBlocked = await createTestUser('inst_blockedD', 100);

  tokenA = generateTestToken(userA);
  tokenA2 = generateTestToken(userA);
  tokenB = generateTestToken(userB);
  tokenB2 = generateTestToken(userB);
  tokenC = generateTestToken(userC);

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
    // 1. MULTI-INSTANCE CROSS-NODE SIGNALING TESTS
    // -------------------------------------------------------------------------
    console.log('--- 1. Multi-Instance Cross-Node Signaling Tests ---');

    // Caller A connects to Instance A; Receiver B connects to Instance B
    const clientA = createSocketClient(baseUrlA, tokenA);
    const clientB = createSocketClient(baseUrlB, tokenB);
    const clientB_dev2 = createSocketClient(baseUrlB, tokenB2); // 2nd device on Instance B

    await Promise.all([
      new Promise((res) => clientA.on('connect', res)),
      new Promise((res) => clientB.on('connect', res)),
      new Promise((res) => clientB_dev2.on('connect', res)),
    ]);

    const incomingPromiseB = waitForEvent(clientB, SocketEvents.CALL_INCOMING);
    const incomingPromiseB2 = waitForEvent(clientB_dev2, SocketEvents.CALL_INCOMING);

    // Initiate from Instance A -> Reaches both devices on Instance B
    const initAck = await new Promise((res) => {
      clientA.emit(
        SocketEvents.CALL_INITIATE,
        {
          recipientId: userB._id.toString(),
          callType: 'AUDIO',
          idempotencyKey: `c3v_idem_${Date.now()}`,
          requestId: 'req_c3v_01',
        },
        res
      );
    });

    assert.strictEqual(initAck.ok, true);
    const callId = initAck.data.callId;

    const [incB1, incB2] = await Promise.all([incomingPromiseB, incomingPromiseB2]);
    assert.strictEqual(incB1.callId, callId);
    assert.strictEqual(incB2.callId, callId);
    console.log('  [PASS] 1. Call initiation on Instance A delivers incoming call to all devices on Instance B');
    passedTests++;

    // -------------------------------------------------------------------------
    // 2. SELECTED-DEVICE SIGNALING ENFORCEMENT & DEVICE RACE
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Selected-Device Signaling Enforcement & Device Race ---');

    const acceptedPromiseA = waitForEvent(clientA, SocketEvents.CALL_ACCEPTED);
    const syncPromiseB2 = waitForEvent(clientB_dev2, SocketEvents.CALL_SYNC);

    // Device 1 on Instance B accepts -> wins
    const acceptAck = await new Promise((res) => {
      clientB.emit(SocketEvents.CALL_ACCEPT, { callId, requestId: 'req_acc_b1' }, res);
    });
    assert.strictEqual(acceptAck.ok, true);

    const acceptedA = await acceptedPromiseA;
    assert.strictEqual(acceptedA.callId, callId);

    const syncB2 = await syncPromiseB2;
    assert.strictEqual(syncB2.handledByOtherDevice, true);

    // Device 2 (unselected secondary device) tries to send media signal -> MUST BE REJECTED
    const secondarySignalAck = await new Promise((res) => {
      clientB_dev2.emit(
        SocketEvents.CALL_SIGNAL_ICE,
        {
          callId,
          candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host' },
          requestId: 'req_dev2_ice',
        },
        res
      );
    });
    assert.strictEqual(secondarySignalAck.ok, false);
    assert.strictEqual(secondarySignalAck.error.code, 'DEVICE_NOT_SELECTED');
    console.log('  [PASS] 2. Selected device wins acceptance; secondary device is dismissed and blocked from signaling');
    passedTests++;

    // -------------------------------------------------------------------------
    // 3. CROSS-INSTANCE SDP & ICE RELAY
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cross-Instance SDP & ICE Relay Tests ---');

    const offerSdp = 'v=0\r\no=- 123 456 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
    const answerSdp = 'v=0\r\no=- 789 101 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';

    const offerPromiseB = waitForEvent(clientB, SocketEvents.CALL_SIGNAL_OFFER);
    const offerAck = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_SIGNAL_OFFER, { callId, sdp: offerSdp, requestId: 'req_offer_cross' }, res);
    });
    assert.strictEqual(offerAck.ok, true);

    const recvOfferB = await offerPromiseB;
    assert.strictEqual(recvOfferB.callId, callId);

    const answerPromiseA = waitForEvent(clientA, SocketEvents.CALL_SIGNAL_ANSWER);
    const answerAck = await new Promise((res) => {
      clientB.emit(SocketEvents.CALL_SIGNAL_ANSWER, { callId, sdp: answerSdp, requestId: 'req_ans_cross' }, res);
    });
    assert.strictEqual(answerAck.ok, true);

    const recvAnswerA = await answerPromiseA;
    assert.strictEqual(recvAnswerA.callId, callId);
    console.log('  [PASS] 3. SDP Offer (Instance A -> B) and Answer (Instance B -> A) cross nodes accurately');
    passedTests++;

    // -------------------------------------------------------------------------
    // 4. BILLING IDEMPOTENCY & DUAL MEDIA-READY ACTIVATION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Billing Idempotency & Dual Media-Ready Activation ---');

    const initialWalletA = await Wallet.findOne({ userId: userA._id });
    const initialBalanceA = initialWalletA.availableBalance;

    // Caller media-ready (1st)
    const m1Ack = await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_MEDIA_READY, { callId, requestId: 'req_m1' }, res);
    });
    assert.strictEqual(m1Ack.ok, true);

    // Verify 0 coins charged before 2nd participant confirms
    const midWalletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(midWalletA.availableBalance, initialBalanceA);

    // Receiver media-ready (2nd) -> Transitions to ACTIVE and deducts 5 coins
    const connPromiseA = waitForEvent(clientA, SocketEvents.CALL_CONNECTED);
    const connPromiseB = waitForEvent(clientB, SocketEvents.CALL_CONNECTED);

    const m2Ack = await new Promise((res) => {
      clientB.emit(SocketEvents.CALL_MEDIA_READY, { callId, requestId: 'req_m2' }, res);
    });
    assert.strictEqual(m2Ack.ok, true);
    assert.strictEqual(m2Ack.data.status, CallStatuses.ACTIVE);

    await Promise.all([connPromiseA, connPromiseB]);

    const activeWalletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(activeWalletA.availableBalance, initialBalanceA - 5);

    // Duplicate media-ready events are idempotent and DO NOT double charge
    await new Promise((res) => clientA.emit(SocketEvents.CALL_MEDIA_READY, { callId, requestId: 'req_m1_dup' }, res));
    await new Promise((res) => clientB.emit(SocketEvents.CALL_MEDIA_READY, { callId, requestId: 'req_m2_dup' }, res));

    const dupWalletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(dupWalletA.availableBalance, initialBalanceA - 5);
    console.log('  [PASS] 4. Dual media-ready confirms once; duplicate confirmations do not double-charge');
    passedTests++;

    // -------------------------------------------------------------------------
    // 5. ATOMIC REBINDING DURING RECONNECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Atomic Rebinding During Reconnection Tests ---');

    // Move call to RECONNECTING
    await new Promise((res) => {
      clientA.emit(SocketEvents.CALL_RECONNECTING, { callId, requestId: 'req_reconn' }, res);
    });

    // Caller A connects with a new socket client (Device A2 on Instance B)
    const clientA_dev2 = createSocketClient(baseUrlB, tokenA2);
    await new Promise((res) => clientA_dev2.on('connect', res));

    // Reconnect on new socket
    const restoreAck = await new Promise((res) => {
      clientA_dev2.emit(SocketEvents.CALL_RECONNECTED, { callId, requestId: 'req_reconn_restore' }, res);
    });
    assert.strictEqual(restoreAck.ok, true);
    assert.strictEqual(restoreAck.data.status, CallStatuses.ACTIVE);

    // Verify that newly rebound device can now signal
    const icePromiseB = waitForEvent(clientB, SocketEvents.CALL_SIGNAL_ICE);
    const reconnectedIceAck = await new Promise((res) => {
      clientA_dev2.emit(
        SocketEvents.CALL_SIGNAL_ICE,
        {
          callId,
          candidate: { candidate: 'candidate:2 1 UDP 2130706431 127.0.0.1 50001 typ host' },
          requestId: 'req_rebound_ice',
        },
        res
      );
    });
    assert.strictEqual(reconnectedIceAck.ok, true);

    const recvIceB = await icePromiseB;
    assert.strictEqual(recvIceB.callId, callId);
    console.log('  [PASS] 5. Reconnection on new socket atomically rebinds media device across instances');
    passedTests++;

    // -------------------------------------------------------------------------
    // 6. TERMINATION & CLEANUP
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Termination & Device Binding Cleanup ---');

    const endAck = await new Promise((res) => {
      clientA_dev2.emit(SocketEvents.CALL_END, { callId, reason: 'USER_HANGUP', requestId: 'req_end' }, res);
    });
    assert.strictEqual(endAck.ok, true);
    assert.strictEqual(endAck.data.status, CallStatuses.ENDED);

    // Verify device bindings are cleared
    const boundDeviceA = await callLockService.getCallDevice(callId, userA._id.toString());
    const boundDeviceB = await callLockService.getCallDevice(callId, userB._id.toString());
    assert.strictEqual(boundDeviceA, null);
    assert.strictEqual(boundDeviceB, null);
    console.log('  [PASS] 6. Call termination cleans up device bindings in Redis');
    passedTests++;

    // -------------------------------------------------------------------------
    // 7. LEGACY SECURITY & BYPASS TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Legacy Event Security & Bypass Tests ---');

    // Test send_webrtc_signal is rejected
    const deprecatedAck = await new Promise((res) => {
      clientA.emit('send_webrtc_signal', { recipientId: userB._id.toString(), signalData: {} }, res);
    });
    assert.strictEqual(deprecatedAck.ok, false);
    assert.strictEqual(deprecatedAck.error.code, 'DEPRECATED_UNSAFE_RELAY');
    console.log('  [PASS] 7. Unsafe send_webrtc_signal is explicitly rejected');
    passedTests++;

    // Disconnect test clients
    clientA.disconnect();
    clientA_dev2.disconnect();
    clientB.disconnect();
    clientB_dev2.disconnect();

  } finally {
    if (serverA) serverA.close();
    if (serverB) serverB.close();
  }

  console.log('\n================================================================================');
  console.log(`   R4-C3V VERIFICATION SUMMARY: ${passedTests} Passed, 0 Failed`);
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
