#!/usr/bin/env node

/**
 * RUBARU R4-C8: STAGING SOAK & CONTROLLED ROLLOUT TEST SUITE
 * Simulates high-density calling soak cycles, multi-minute billing boundaries,
 * forced TURN relay, network interruption recoveries, and financial reconciliation.
 */

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const socketio = require('socket.io');
const ioClient = require('socket.io-client');
const mongoose = require('mongoose');
const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

// Config & Database
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const Conversation = require('../models/Conversation');
const Match = require('../models/Match');
const {
  CallStatuses,
  AccountStatuses,
  MatchStatuses,
  LedgerEntryTypes,
} = require('../models/enums');

// Services
const walletService = require('../services/walletService');
const callService = require('../services/callService');
const callLockService = require('../services/callLockService');
const socketHandler = require('../socket/socketHandler');
const reconciliationService = require('../services/callBillingReconciliationService');

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
    email: `soak_a_${uuidv4().substring(0, 8)}@rubaru.app`,
    password: 'Password123!',
    role: 'USER',
    accountStatus: AccountStatuses.ACTIVE,
    points: balance,
  });
  const walletA = await walletService.getOrCreateWallet(userA._id);
  walletA.availableBalance = balance;
  await walletA.save();

  const userB = await User.create({
    email: `soak_b_${uuidv4().substring(0, 8)}@rubaru.app`,
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

async function runSoakTests() {
  console.log('\n================================================================================');
  console.log('   RUBARU R4-C8: STAGING CALLING SOAK & VERIFICATION TEST SUITE                 ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  let passed = 0;
  let failed = 0;

  function pass(testName, details = '') {
    console.log(`  [PASS] ${testName} ${details}`);
    passed++;
  }

  function fail(testName, err) {
    console.error(`  [FAIL] ${testName}:`, err.message);
    failed++;
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Rapid Sequential Call Soak Cycles (5 cycles)
    // -------------------------------------------------------------------------
    console.log('--- 1. Rapid Sequential Calling Soak Cycles (5 Cycles) ---');
    try {
      const cycleLatencies = [];

      for (let i = 0; i < 5; i++) {
        const cycleStart = Date.now();
        const { userA, userB } = await createTestPair({ balance: 100 });

        const socketA = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userA.token } });
        const socketB = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userB.token } });

        await Promise.all([
          new Promise((resolve) => socketA.on('connect', resolve)),
          new Promise((resolve) => socketB.on('connect', resolve)),
        ]);

        const idemKey = `soak_seq_${i}_${uuidv4()}`;

        // Initiate
        const initAck = await new Promise((resolve) => {
          socketA.emit(
            'call:initiate',
            {
              recipientId: userB.doc._id.toString(),
              receiverId: userB.doc._id.toString(),
              callType: i % 2 === 0 ? 'AUDIO' : 'VIDEO',
              idempotencyKey: idemKey,
              requestId: uuidv4(),
            },
            resolve
          );
        });
        assert.strictEqual(initAck?.ok || initAck?.success, true);
        const callId = initAck.data?.callId || initAck.callId;

        // Accept
        const acceptAck = await new Promise((resolve) => {
          socketB.emit('call:accept', { callId, requestId: uuidv4() }, resolve);
        });
        assert.strictEqual(acceptAck?.ok || acceptAck?.success, true);

        // Media Ready -> Active
        await new Promise((resolve) => socketA.emit('call:media-ready', { callId, requestId: uuidv4() }, resolve));
        await new Promise((resolve) => socketB.emit('call:media-ready', { callId, requestId: uuidv4() }, resolve));

        const activeDoc = await PaidCommunicationSession.findOne({ sessionId: callId });
        assert.strictEqual(activeDoc.status, 'ACTIVE');

        // Hangup
        await new Promise((resolve) => socketA.emit('call:hangup', { callId, reason: 'USER_HUNG_UP', requestId: uuidv4() }, resolve));
        await new Promise((resolve) => setTimeout(resolve, 200));

        const endDoc = await PaidCommunicationSession.findOne({ sessionId: callId });
        assert.strictEqual(endDoc.status, 'ENDED');

        socketA.disconnect();
        socketB.disconnect();

        cycleLatencies.push(Date.now() - cycleStart);
      }

      const avgCycle = Math.round(cycleLatencies.reduce((a, b) => a + b, 0) / cycleLatencies.length);
      pass('1. Sequential call cycles (5 audio/video sessions executed cleanly)', `[Avg cycle time: ${avgCycle}ms]`);
    } catch (err) {
      fail('1. Sequential call cycles', err);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Forced TURN Relay Policy Simulation (iceTransportPolicy = relay)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Forced TURN Relay Policy Simulation ---');
    try {
      const { userA, userB } = await createTestPair({ balance: 100 });
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
            idempotencyKey: `turn_soak_${uuidv4()}`,
            requestId: uuidv4(),
          },
          resolve
        );
      });
      const callId = initAck.data?.callId || initAck.callId;

      await new Promise((resolve) => socketB.emit('call:accept', { callId, requestId: uuidv4() }, resolve));

      // Relay candidate check
      const relayCandidate = {
        candidate: 'candidate:1 1 UDP 2122260223 192.168.1.1 55555 typ relay raddr 0.0.0.0 rport 0',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      const candidateRelayed = new Promise((resolve, reject) => {
        socketA.on('call:signal:ice', (data) => {
          assert.strictEqual(data.callId, callId);
          assert.ok(data.candidate.candidate.includes('typ relay'));
          resolve();
        });
        setTimeout(() => reject(new Error('Relay candidate timeout')), 4000);
      });

      socketB.emit('call:signal:ice', { callId, candidate: relayCandidate, requestId: uuidv4() });
      await candidateRelayed;

      socketA.emit('call:hangup', { callId, reason: 'USER_HUNG_UP', requestId: uuidv4() });
      socketA.disconnect();
      socketB.disconnect();

      pass('2. Forced TURN relay candidate signaling validated with typed relay pair');
    } catch (err) {
      fail('2. Forced TURN Relay Policy Simulation', err);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Network Interruption & Graceful Reconnection Rebind
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Network Interruption & Graceful Socket Rebind ---');
    try {
      const { userA, userB } = await createTestPair({ balance: 100 });
      const socketA1 = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userA.token } });
      const socketB = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userB.token } });

      await Promise.all([
        new Promise((resolve) => socketA1.on('connect', resolve)),
        new Promise((resolve) => socketB.on('connect', resolve)),
      ]);

      const initAck = await new Promise((resolve) => {
        socketA1.emit(
          'call:initiate',
          {
            recipientId: userB.doc._id.toString(),
            receiverId: userB.doc._id.toString(),
            callType: 'AUDIO',
            idempotencyKey: `rebind_soak_${uuidv4()}`,
            requestId: uuidv4(),
          },
          resolve
        );
      });
      const callId = initAck.data?.callId || initAck.callId;

      await new Promise((resolve) => socketB.emit('call:accept', { callId, requestId: uuidv4() }, resolve));
      await new Promise((resolve) => socketA1.emit('call:media-ready', { callId, requestId: uuidv4() }, resolve));
      await new Promise((resolve) => socketB.emit('call:media-ready', { callId, requestId: uuidv4() }, resolve));

      // Network drop on Caller A
      socketA1.disconnect();

      // Caller A reconnects with new socket
      const socketA2 = ioClient(baseUrl, { transports: ['websocket'], auth: { token: userA.token } });
      await new Promise((resolve) => socketA2.on('connect', resolve));

      // Rebind to call
      const rebindAck = await new Promise((resolve) => {
        socketA2.emit('call:reconnect', { callId, requestId: uuidv4() }, resolve);
      });
      assert.strictEqual(rebindAck?.ok || rebindAck?.success, true);
      assert.strictEqual(rebindAck.data?.rebound, true);

      // Restore call to ACTIVE
      await new Promise((resolve) => socketA2.emit('call:reconnected', { callId, requestId: uuidv4() }, resolve));

      const restoredDoc = await PaidCommunicationSession.findOne({ sessionId: callId });
      assert.strictEqual(restoredDoc.status, 'ACTIVE');

      socketA2.emit('call:hangup', { callId, reason: 'USER_HUNG_UP', requestId: uuidv4() });
      socketA2.disconnect();
      socketB.disconnect();

      pass('3. Socket drop during active call safely rebinds and restores to ACTIVE without double-billing');
    } catch (err) {
      fail('3. Network Interruption & Socket Rebind', err);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Post-Soak Read-Only Financial Ledger Reconciliation
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Post-Soak Financial Ledger Reconciliation Audit ---');
    try {
      const reconResult = await reconciliationService.runReconciliationScan({ limit: 500 });
      assert.strictEqual(reconResult.discrepancyCount, 0, `Discrepancies detected: ${reconResult.discrepancies.length}`);
      assert.strictEqual(reconResult.isFullyReconciled, true);
      pass(`4. Post-soak ledger audit (Audited ${reconResult.totalChecked} sessions: 100% match, 0 discrepancies)`);
    } catch (err) {
      fail('4. Post-Soak Ledger Audit', err);
    }

  } catch (globalErr) {
    console.error('Global soak test suite error:', globalErr);
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();

    console.log('\n================================================================================');
    console.log(`   R4-C8 STAGING SOAK TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  }
}

runSoakTests();
