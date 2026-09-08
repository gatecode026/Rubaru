const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const assert = require('assert');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const socketio = require('socket.io');
const ioClientModule = require('socket.io-client');
const ioClient = ioClientModule.io || ioClientModule;
const { v4: uuidv4 } = require('uuid');

const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const Device = require('../models/Device');
const {
  CommunicationTypes,
  CallStatuses,
  AccountStatuses,
  MatchStatuses,
} = require('../models/enums');

// Services
const walletService = require('../services/walletService');
const callService = require('../services/callService');
const socketHandler = require('../socket/socketHandler');

let server;
let ioServer;
let port;
let baseUrl;

async function setupTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  server = http.createServer(app);
  ioServer = socketio(server, { cors: { origin: '*' } });
  socketHandler(ioServer);

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
}

function generateToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET || 'rubaru_super_secret_jwt_key_2026',
    { expiresIn: '1h' }
  );
}

async function createTestPair({ balance = 100 } = {}) {
  const userA = await User.create({
    email: `load_a_${uuidv4().substring(0, 8)}@rubaru.app`,
    password: 'Password123!',
    role: 'USER',
    accountStatus: AccountStatuses.ACTIVE,
    points: balance,
  });
  const walletA = await walletService.getOrCreateWallet(userA._id);
  walletA.availableBalance = balance;
  await walletA.save();

  const userB = await User.create({
    email: `load_b_${uuidv4().substring(0, 8)}@rubaru.app`,
    password: 'Password123!',
    role: 'USER',
    accountStatus: AccountStatuses.ACTIVE,
    points: balance,
  });
  const walletB = await walletService.getOrCreateWallet(userB._id);
  walletB.availableBalance = balance;
  await walletB.save();

  const conv = await Conversation.create({
    type: 'DIRECT_MATCH',
    participants: [userA._id, userB._id],
  });

  await Match.create({
    users: [userA._id, userB._id],
    status: MatchStatuses.ACTIVE,
    initiatorInteraction: new mongoose.Types.ObjectId(),
    conversation: conv._id,
  });

  return {
    userA: { doc: userA, token: generateToken(userA) },
    userB: { doc: userB, token: generateToken(userB) },
    conversationId: conv._id,
  };
}

function calculatePercentiles(latencies) {
  if (!latencies.length) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { p50, p95, p99 };
}

async function runSignalingLoadTests() {
  console.log('\n================================================================================');
  console.log('   RUBARU R4-C7: SIGNALING CONCURRENCY & WEBRTC LOAD TESTING SUITE              ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  let passed = 0;
  let failed = 0;

  function pass(testName, extra = '') {
    console.log(`  [PASS] ${testName} ${extra}`);
    passed++;
  }

  function fail(testName, err) {
    console.error(`  [FAIL] ${testName}:`, err.message);
    failed++;
  }

  try {
    // --- 1. Concurrent Socket Authentication Burst ---
    console.log('--- 1. Concurrent Socket Authentication Burst ---');
    const NUM_CLIENTS = 20;
    const authLatencies = [];
    const sockets = [];

    try {
      const startTime = Date.now();
      const authPromises = Array.from({ length: NUM_CLIENTS }).map(async (_, idx) => {
        const u = await createTestUser({ balance: 50 });
        const connStart = Date.now();
        const socket = ioClient(baseUrl, {
          transports: ['websocket'],
          auth: { token: u.token },
        });

        await new Promise((resolve, reject) => {
          socket.on('connect', () => {
            authLatencies.push(Date.now() - connStart);
            resolve();
          });
          socket.on('connect_error', reject);
          setTimeout(() => reject(new Error('Auth connection timeout')), 4000);
        });

        sockets.push(socket);
      });

      await Promise.all(authPromises);
      const totalAuthTime = Date.now() - startTime;
      const { p50, p95, p99 } = calculatePercentiles(authLatencies);

      assert.strictEqual(sockets.length, NUM_CLIENTS);
      pass(
        `1. Concurrent Socket Auth (${NUM_CLIENTS} sockets connected concurrently in ${totalAuthTime}ms)`,
        `[p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms]`
      );
    } catch (err) {
      fail('1. Concurrent Socket Auth', err);
    }

    // Clean up burst sockets
    sockets.forEach((s) => s.disconnect());

    // --- 2. Concurrent Call Initiation Bursts & Rate Limiting ---
    console.log('\n--- 2. Call Initiation Bursts & Lifecycle Concurrency ---');
    const NUM_CALL_PAIRS = 5;
    const initLatencies = [];

    try {
      const pairs = await Promise.all(
        Array.from({ length: NUM_CALL_PAIRS }).map(() => createTestPair({ balance: 50 }))
      );

      const initPromises = pairs.map(async ({ userA, userB }) => {
        const tStart = Date.now();
        const res = await callService.initiateCall({
          callerId: userA.doc._id,
          receiverId: userB.doc._id,
          callType: 'AUDIO',
        });
        initLatencies.push(Date.now() - tStart);
        assert.ok(res.callId, 'Call ID must be generated');
        assert.strictEqual(res.status, 'INITIATED');
        return res;
      });

      const sessions = await Promise.all(initPromises);
      const { p50, p95, p99 } = calculatePercentiles(initLatencies);

      assert.strictEqual(sessions.length, NUM_CALL_PAIRS);
      pass(
        `2. Concurrent Call Initiations (${NUM_CALL_PAIRS} dual-user locked sessions created)`,
        `[p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms]`
      );
    } catch (err) {
      fail('2. Concurrent Call Initiations', err);
    }

    // --- 3. Full WebRTC Signaling Relay Burst (Offer, Answer, ICE bursts) ---
    console.log('\n--- 3. WebRTC Signaling Relay Burst ---');
    try {
      const { userA, userB } = await createTestPair({ balance: 50 });

      const socketA = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userA.token } });
      const socketB = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userB.token } });

      await Promise.all([
        new Promise((resolve) => socketA.on('connect', resolve)),
        new Promise((resolve) => socketB.on('connect', resolve)),
      ]);

      // 1. Initiate
      const initAck = await new Promise((resolve) => {
        socketA.emit(
          'call:initiate',
          {
            recipientId: userB.doc._id.toString(),
            receiverId: userB.doc._id.toString(),
            callType: 'AUDIO',
            idempotencyKey: uuidv4(),
            requestId: uuidv4(),
          },
          resolve
        );
      });
      const isOk = initAck?.ok === true || initAck?.success === true;
      assert.strictEqual(isOk, true, `Initiate ack failed: ${JSON.stringify(initAck)}`);
      const callId = initAck.data?.callId || initAck.callId || initAck.data?.sessionId;

      // 2. Accept
      const acceptAck = await new Promise((resolve) => {
        socketB.emit('call:accept', { callId, requestId: uuidv4() }, resolve);
      });
      const isAcceptOk = acceptAck?.ok === true || acceptAck?.success === true;
      assert.strictEqual(isAcceptOk, true, `Accept ack failed: ${JSON.stringify(acceptAck)}`);

      // 3. Offer Relay
      const offerReceived = new Promise((resolve, reject) => {
        socketB.on('call:signal:offer', (data) => {
          assert.strictEqual(data.callId, callId);
          resolve();
        });
        setTimeout(() => reject(new Error('Offer relay timeout')), 5000);
      });
      socketA.emit('call:signal:offer', {
        callId,
        sdp: { type: 'offer', sdp: 'v=0\r\no=test 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' },
        requestId: uuidv4(),
      });
      await offerReceived;

      // 4. Answer Relay
      const answerReceived = new Promise((resolve, reject) => {
        socketA.on('call:signal:answer', (data) => {
          assert.strictEqual(data.callId, callId);
          resolve();
        });
        setTimeout(() => reject(new Error('Answer relay timeout')), 5000);
      });
      socketB.emit('call:signal:answer', {
        callId,
        sdp: { type: 'answer', sdp: 'v=0\r\no=test 2 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' },
        requestId: uuidv4(),
      });
      await answerReceived;

      // 5. ICE Candidate Burst (10 candidates in rapid succession)
      const iceLatencies = [];
      let iceReceivedCount = 0;
      socketA.on('call:signal:ice', () => {
        iceReceivedCount++;
      });

      for (let i = 0; i < 10; i++) {
        const iceStart = Date.now();
        socketB.emit('call:signal:ice', {
          callId,
          candidate: { candidate: `candidate:${i} 1 UDP 2122260223 192.168.1.42 ${50000 + i} typ host`, sdpMid: '0', sdpMLineIndex: 0 },
          requestId: uuidv4(),
        });
        iceLatencies.push(Date.now() - iceStart);
      }

      await new Promise((resolve) => setTimeout(resolve, 600));
      const { p50, p95 } = calculatePercentiles(iceLatencies);

      assert.strictEqual(iceReceivedCount, 10, 'All 10 burst ICE candidates must be relayed');
      pass('3. WebRTC Signaling Relay & ICE candidate burst (10/10 candidates relayed without loss)', `[p50: ${p50}ms, p95: ${p95}ms]`);

      socketA.disconnect();
      socketB.disconnect();
    } catch (err) {
      fail('3. WebRTC Signaling Relay & ICE Burst', err);
    }

    // --- 4. Media Readiness & Concurrent State Convergence ---
    console.log('\n--- 4. Media Readiness & Call Termination Concurrency ---');
    try {
      const { userA, userB } = await createTestPair({ balance: 50 });

      const socketA = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userA.token } });
      const socketB = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userB.token } });

      await Promise.all([
        new Promise((resolve) => socketA.on('connect', resolve)),
        new Promise((resolve) => socketB.on('connect', resolve)),
      ]);

      const initAck = await new Promise((resolve) => {
        socketA.emit(
          'call:initiate',
          {
            recipientId: userB.doc._id.toString(),
            receiverId: userB.doc._id.toString(),
            callType: 'AUDIO',
            idempotencyKey: uuidv4(),
            requestId: uuidv4(),
          },
          resolve
        );
      });
      const callId = initAck.data?.callId || initAck.callId || initAck.data?.sessionId;

      await new Promise((resolve) => socketB.emit('call:accept', { callId, requestId: uuidv4() }, resolve));

      // Both devices emit call:media-ready sequentially/concurrently
      await new Promise((resolve) => socketA.emit('call:media-ready', { callId, requestId: uuidv4() }, resolve));
      await new Promise((resolve) => socketB.emit('call:media-ready', { callId, requestId: uuidv4() }, resolve));

      const activeDoc = await PaidCommunicationSession.findOne({ sessionId: callId });
      assert.strictEqual(activeDoc.status, 'ACTIVE');

      // Concurrent hangup attempt from both sides
      socketA.emit('call:hangup', { callId, reason: 'USER_HUNG_UP', requestId: uuidv4() });
      socketB.emit('call:hangup', { callId, reason: 'USER_HUNG_UP', requestId: uuidv4() });

      await new Promise((resolve) => setTimeout(resolve, 500));
      const endDoc = await PaidCommunicationSession.findOne({ sessionId: callId });
      assert.strictEqual(endDoc.status, 'ENDED');
      pass('4. Media readiness convergence (status -> ACTIVE) and idempotent concurrent hangup (status -> ENDED)');

      socketA.disconnect();
      socketB.disconnect();
    } catch (err) {
      fail('4. Media Readiness Convergence & Hangup', err);
    }

  } catch (globalErr) {
    console.error('Global load test error:', globalErr);
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();

    console.log('\n================================================================================');
    console.log(`   R4-C7 SIGNALING LOAD TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  }
}

async function createTestUser({ balance = 50 } = {}) {
  const user = await User.create({
    email: `load_user_${uuidv4().substring(0, 8)}@rubaru.app`,
    password: 'Password123!',
    role: 'USER',
    accountStatus: AccountStatuses.ACTIVE,
    points: balance,
  });
  const wallet = await walletService.getOrCreateWallet(user._id);
  wallet.availableBalance = balance;
  await wallet.save();
  return { doc: user, token: generateToken(user) };
}

runSignalingLoadTests();
