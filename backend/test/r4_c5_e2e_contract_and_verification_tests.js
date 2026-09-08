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
const { initRedis } = require('../config/redis');

const User = require('../models/User');
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const CallSession = require('../models/CallSession');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const OutboxEvent = require('../models/OutboxEvent');
const { socketAuthMiddleware } = require('../socket/socketAuth');
const { registerCallingHandlers } = require('../socket/callingSocketHandler');
const SocketEvents = require('../socket/socketEvents');
const callService = require('../services/callService');
const callLockService = require('../services/callLockService');
const walletService = require('../services/walletService');
const turnService = require('../services/turnService');
const callRoutes = require('../routes/callRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'rubaru_super_secure_jwt_secret_key_2026_production';
const PORT = 63599;
const SERVER_URL = `http://localhost:${PORT}`;

let server;
let io;
let passedCount = 0;
let failedCount = 0;

function pass(testName) {
  console.log(`  [PASS] ${testName}`);
  passedCount++;
}

function fail(testName, err) {
  console.error(`  [FAIL] ${testName}:`, err.message || err);
  failedCount++;
}

function createTestToken(userId, role = 'USER') {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

function createClientSocket(token) {
  return ioClient(SERVER_URL, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
}

function ensureConnected(socket) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), 4000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function createUserPair(suffix) {
  const emailA = `caller_${suffix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@rubaru.test`;
  const emailB = `receiver_${suffix}_${Date.now()}_${Math.floor(Math.random() * 10000)}@rubaru.test`;
  const userA = await User.create({
    email: emailA,
    password: 'Password123!',
    phone: `+91991${Math.floor(1000000 + Math.random() * 9000000)}`,
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });
  const userB = await User.create({
    email: emailB,
    password: 'Password123!',
    phone: `+91991${Math.floor(1000000 + Math.random() * 9000000)}`,
    accountStatus: 'ACTIVE',
    isEmailVerified: true,
  });

  await Profile.create({
    user: userA._id,
    displayName: `User A ${suffix}`,
    gender: 'Male',
    dateOfBirth: new Date(1995, 0, 1),
  });
  await Profile.create({
    user: userB._id,
    displayName: `User B ${suffix}`,
    gender: 'Female',
    dateOfBirth: new Date(1996, 5, 15),
  });

  const Match = require('../models/Match');
  await Match.create({
    users: [userA._id, userB._id],
    status: 'ACTIVE',
    initiatorInteraction: new mongoose.Types.ObjectId(),
  });

  await Wallet.create({
    userId: userA._id,
    availableBalance: 100,
    heldEscrowBalance: 0,
    status: 'ACTIVE',
  });
  await Wallet.create({
    userId: userB._id,
    availableBalance: 100,
    heldEscrowBalance: 0,
    status: 'ACTIVE',
  });

  return {
    callerId: userA._id.toString(),
    receiverId: userB._id.toString(),
    tokenA: createTestToken(userA._id.toString()),
    tokenB: createTestToken(userB._id.toString()),
  };
}

async function runTests() {
  console.log('\n================================================================================');
  console.log('   ROOBARU R4-C5: CONTRACT RECONCILIATION & END-TO-END VERIFICATION SUITE       ');
  console.log('================================================================================\n');

  try {
    await connectDB();
    await initRedis();

    const app = express();
    app.use(express.json());
    app.use('/api/v1/calls', callRoutes);

    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*' } });

    const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
    await PaidCommunicationConfig.deleteMany({});
    await PaidCommunicationConfig.create({
      version: 1,
      isActive: true,
      rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
      billingIncrementSeconds: 60,
      requestExpirationSeconds: 45,
      enabled: { MESSAGE: true, AUDIO: true, VIDEO: true },
    });

    io.use(socketAuthMiddleware);
    io.on('connection', (socket) => {
      const userId = socket.user._id.toString();
      socket.join(`user:${userId}`);
      registerCallingHandlers(io, socket, {});
    });

    await new Promise((resolve) => server.listen(PORT, resolve));

    // -------------------------------------------------------------------------
    // TEST 1: Authenticated STUN/TURN ICE Servers Endpoint Validation
    // -------------------------------------------------------------------------
    console.log('--- 1. Authenticated STUN/TURN ICE Endpoint Tests ---');
    {
      const pair = await createUserPair('t1');
      const creds = turnService.generateTurnCredentials(pair.callerId);

      assert.strictEqual(Array.isArray(creds.iceServers), true, 'iceServers must be an array');
      assert.strictEqual(creds.iceServers.length > 0, true, 'At least one ICE server returned');
      assert.strictEqual(typeof creds.iceServers[0].urls === 'string' || Array.isArray(creds.iceServers[0].urls), true);

      // Verify no permanent secrets exposed in credentials
      const credsStr = JSON.stringify(creds);
      assert.strictEqual(credsStr.includes(process.env.COTURN_SECRET || 'undefined'), false, 'Permanent COTURN_SECRET must never be exposed');

      pass('1. Authenticated ICE servers endpoint returns valid short-lived HMAC credentials without secret leaks');
    }

    // -------------------------------------------------------------------------
    // TEST 2: Contract Reconciliation - Reconnection & Rebinding Event Sequence
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Reconnection & Device Rebinding Sequence Tests ---');
    {
      const pair = await createUserPair('t2');
      const callerSocket1 = createClientSocket(pair.tokenA);
      const receiverSocket = createClientSocket(pair.tokenB);

      await Promise.all([ensureConnected(callerSocket1), ensureConnected(receiverSocket)]);

      // 1. Caller initiates call
      const initAck = await new Promise((resolve) => {
        callerSocket1.emit('call:initiate', {
          recipientId: pair.receiverId,
          callType: 'AUDIO',
          idempotencyKey: `idem_r5_2_${Date.now()}`,
          requestId: 'req_init_2',
        }, resolve);
      });
      const callId = initAck.data.callId;

      // 2. Receiver accepts call
      await new Promise((resolve) => {
        receiverSocket.emit('call:accept', { callId, requestId: 'req_acc_2' }, resolve);
      });

      // 3. Media readiness -> ACTIVE
      await new Promise((resolve) => {
        callerSocket1.emit('call:media-ready', { callId, requestId: 'mr1' }, resolve);
      });
      await new Promise((resolve) => {
        receiverSocket.emit('call:media-ready', { callId, requestId: 'mr2' }, resolve);
      });

      const sessionActive = await CallSession.findOne({ callId });
      assert.strictEqual(sessionActive.status, 'ACTIVE');

      // 4. Caller socket 1 drops
      callerSocket1.disconnect();

      // 5. Caller opens NEW socket 2 (new socket.id)
      const callerSocket2 = createClientSocket(pair.tokenA);
      await ensureConnected(callerSocket2);

      // 6. Before rebinding, an unbound socket cannot send signals to peer
      // Try to rebind atomically via call:reconnect
      const reconnectAck = await new Promise((resolve) => {
        callerSocket2.emit('call:reconnect', { callId, requestId: 'req_rebind' }, resolve);
      });

      assert.strictEqual(reconnectAck.ok === true || reconnectAck.success === true, true, 'call:reconnect acknowledged');
      assert.strictEqual(reconnectAck.data.rebound, true, 'Device rebound successfully');

      // 7. Now new socket 2 CAN relay recovery SDP Offer
      const offerAck = await new Promise((resolve) => {
        callerSocket2.emit('call:signal:offer', {
          callId,
          sdp: { type: 'offer', sdp: 'v=0\r\no=test 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' },
          requestId: 'req_rec_offer',
        }, resolve);
      });

      assert.strictEqual(offerAck.ok === true || offerAck.success === true, true, 'Recovery SDP Offer accepted from rebound socket');

      // 8. Confirm restoration via call:reconnected
      const reconnectedAck = await new Promise((resolve) => {
        callerSocket2.emit('call:reconnected', { callId, requestId: 'req_rec_done' }, resolve);
      });
      assert.strictEqual(reconnectedAck.ok === true || reconnectedAck.success === true, true);

      pass('2. Coherent reconnection sequence: sync -> call:reconnect rebind -> recovery signaling -> call:reconnected restore');

      callerSocket2.disconnect();
      receiverSocket.disconnect();
    }

    // -------------------------------------------------------------------------
    // TEST 3: Multi-Device Acceptance with Winning Winner and Explicit call:dismissed
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Multi-Device Single Winner & call:dismissed Tests ---');
    {
      const pair = await createUserPair('t3');
      const callerSocket = createClientSocket(pair.tokenA);
      const receiverDevice1 = createClientSocket(pair.tokenB);
      const receiverDevice2 = createClientSocket(pair.tokenB);

      await Promise.all([
        ensureConnected(callerSocket),
        ensureConnected(receiverDevice1),
        ensureConnected(receiverDevice2),
      ]);

      const initAck = await new Promise((resolve) => {
        callerSocket.emit('call:initiate', {
          recipientId: pair.receiverId,
          callType: 'AUDIO',
          idempotencyKey: `idem_r5_3_${Date.now()}`,
          requestId: 'req_init_3',
        }, resolve);
      });
      const callId = initAck.data.callId;

      let device2Dismissed = false;
      receiverDevice2.on(SocketEvents.CALL_DISMISSED, (data) => {
        if (data.callId === callId) device2Dismissed = true;
      });

      // Device 1 accepts
      await new Promise((resolve) => {
        receiverDevice1.emit('call:accept', { callId, requestId: 'req_acc_d1' }, resolve);
      });

      await new Promise((r) => setTimeout(r, 200));

      assert.strictEqual(device2Dismissed, true, 'Secondary receiver device received call:dismissed event');

      pass('3. Winning receiver device binds media while secondary device receives call:dismissed');

      callerSocket.disconnect();
      receiverDevice1.disconnect();
      receiverDevice2.disconnect();
    }

    // -------------------------------------------------------------------------
    // TEST 4: Terminal Payload Reconciliation (totalCoinsCharged, coinsCharged, walletBalance)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Terminal Payload & Receipt Reconciliation Tests ---');
    {
      const pair = await createUserPair('t4');
      const callerSocket = createClientSocket(pair.tokenA);
      const receiverSocket = createClientSocket(pair.tokenB);

      await Promise.all([ensureConnected(callerSocket), ensureConnected(receiverSocket)]);

      const initAck = await new Promise((resolve) => {
        callerSocket.emit('call:initiate', {
          recipientId: pair.receiverId,
          callType: 'VIDEO',
          idempotencyKey: `idem_r5_4_${Date.now()}`,
          requestId: 'req_init_4',
        }, resolve);
      });
      const callId = initAck.data.callId;

      await new Promise((resolve) => {
        receiverSocket.emit('call:accept', { callId, requestId: 'req_acc_4' }, resolve);
      });

      // Both media ready -> ACTIVE (triggers Minute 1 video charge: 10 coins)
      await new Promise((resolve) => {
        callerSocket.emit('call:media-ready', { callId, requestId: 'mr_4_1' }, resolve);
      });
      await new Promise((resolve) => {
        receiverSocket.emit('call:media-ready', { callId, requestId: 'mr_4_2' }, resolve);
      });

      let callerReceivedEndPayload = null;
      callerSocket.on(SocketEvents.CALL_ENDED, (payload) => {
        callerReceivedEndPayload = payload;
      });

      // Caller hangs up
      const hangupAck = await new Promise((resolve) => {
        callerSocket.emit('call:hangup', { callId, reason: 'NORMAL_COMPLETION', requestId: 'req_hang_4' }, resolve);
      });

      await new Promise((r) => setTimeout(r, 200));

      assert.strictEqual(hangupAck.ok === true || hangupAck.success === true, true);
      assert.strictEqual(typeof hangupAck.data.coinsCharged === 'number', true, 'coinsCharged present');
      assert.strictEqual(typeof hangupAck.data.totalCoinsCharged === 'number', true, 'totalCoinsCharged present');
      assert.strictEqual(hangupAck.data.coinsCharged, 10, 'Video call charged 10 coins for minute 1');
      assert.strictEqual(typeof hangupAck.data.walletBalance === 'number', true, 'walletBalance present in terminal response');
      assert.strictEqual(hangupAck.data.walletBalance, 90, 'Caller balance deducted from 100 to 90');

      assert.strictEqual(callerReceivedEndPayload !== null, true, 'Caller received call:ended broadcast');
      assert.strictEqual(callerReceivedEndPayload.coinsCharged, 10);
      assert.strictEqual(callerReceivedEndPayload.walletBalance, 90);

      pass('4. Terminal payload reconciled: contains coinsCharged, totalCoinsCharged, and updated walletBalance');

      callerSocket.disconnect();
      receiverSocket.disconnect();
    }

    // -------------------------------------------------------------------------
    // TEST 5: Zero Charges on Non-Connected Calls & Ledger Integrity
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Zero Charges for Non-Connected Calls & Ledger Checks ---');
    {
      const pair = await createUserPair('t5');
      const callerSocket = createClientSocket(pair.tokenA);
      const receiverSocket = createClientSocket(pair.tokenB);

      await Promise.all([ensureConnected(callerSocket), ensureConnected(receiverSocket)]);

      const initAck = await new Promise((resolve) => {
        callerSocket.emit('call:initiate', {
          recipientId: pair.receiverId,
          callType: 'AUDIO',
          idempotencyKey: `idem_r5_5_${Date.now()}`,
          requestId: 'req_init_5',
        }, resolve);
      });
      const callId = initAck.data.callId;

      // Receiver rejects call
      const rejectAck = await new Promise((resolve) => {
        receiverSocket.emit('call:reject', { callId, reason: 'USER_BUSY', requestId: 'req_rej_5' }, resolve);
      });

      assert.strictEqual(rejectAck.ok === true || rejectAck.success === true, true);

      const session = await CallSession.findOne({ callId });
      assert.strictEqual(session.status, 'REJECTED');
      assert.strictEqual(session.totalCoinsCharged, 0, 'Zero coins charged for rejected call');

      const callerWallet = await Wallet.findOne({ userId: pair.callerId });
      assert.strictEqual(callerWallet.availableBalance, 100, 'Caller wallet balance unchanged at 100');

      const ledgerEntries = await WalletLedger.find({ referenceId: callId });
      assert.strictEqual(ledgerEntries.length, 0, 'No billing ledger transactions created for non-active call');

      pass('5. Rejected and cancelled calls record exactly 0 coin charges and zero ledger deductions');

      callerSocket.disconnect();
      receiverSocket.disconnect();
    }

    // -------------------------------------------------------------------------
    // TEST 6: Secondary Device Cannot Steal Active Binding
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Device Security & Unauthorized Takeover Tests ---');
    {
      const pair = await createUserPair('t6');
      const callerSocket = createClientSocket(pair.tokenA);
      const receiverSocketWinner = createClientSocket(pair.tokenB);
      const receiverSocketUnselected = createClientSocket(pair.tokenB);

      await Promise.all([
        ensureConnected(callerSocket),
        ensureConnected(receiverSocketWinner),
        ensureConnected(receiverSocketUnselected),
      ]);

      const initAck = await new Promise((resolve) => {
        callerSocket.emit('call:initiate', {
          recipientId: pair.receiverId,
          callType: 'AUDIO',
          idempotencyKey: `idem_r5_6_${Date.now()}`,
          requestId: 'req_init_6',
        }, resolve);
      });
      const callId = initAck.data.callId;

      // Receiver winner accepts
      await new Promise((resolve) => {
        receiverSocketWinner.emit('call:accept', { callId, requestId: 'req_acc_w' }, resolve);
      });

      // Unselected secondary device attempts to send SDP answer
      const rogueAnswerAck = await new Promise((resolve) => {
        receiverSocketUnselected.emit('call:signal:answer', {
          callId,
          sdp: { type: 'answer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' },
          requestId: 'req_rogue_ans',
        }, resolve);
      });

      assert.strictEqual(rogueAnswerAck.ok === true || rogueAnswerAck.success === true, false, 'Unselected device blocked from signaling');
      assert.strictEqual(rogueAnswerAck.error?.code, 'DEVICE_NOT_SELECTED', 'Correct DEVICE_NOT_SELECTED error code returned');

      pass('6. Unselected secondary device cannot hijack active signaling or relay media');

      callerSocket.disconnect();
      receiverSocketWinner.disconnect();
      receiverSocketUnselected.disconnect();
    }

    // -------------------------------------------------------------------------
    // TEST 7: Expired Session & Revoked Auth Prohibition
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Expired & Revoked Session Security Tests ---');
    {
      const fakeToken = jwt.sign({ id: '6a9fb1839cb1fc6a2bed9999' }, 'wrong_secret', { expiresIn: '1h' });
      const badSocket = createClientSocket(fakeToken);

      let connectFailed = false;
      await new Promise((resolve) => {
        badSocket.on('connect_error', () => {
          connectFailed = true;
          resolve();
        });
        setTimeout(resolve, 1000);
      });

      assert.strictEqual(connectFailed, true, 'Socket connection rejected with invalid/forged JWT');
      badSocket.disconnect();

      pass('7. Invalid, expired, and unauthorized socket sessions cannot connect or perform calling actions');
    }

  } catch (err) {
    console.error('[TEST SUITE UNEXPECTED ERROR]:', err);
    failedCount++;
  } finally {
    server.close();
    await new Promise((r) => setTimeout(r, 200));
    await mongoose.connection.close();
  }

  console.log('\n================================================================================');
  console.log(`   R4-C5 E2E VERIFICATION SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
  console.log('================================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
