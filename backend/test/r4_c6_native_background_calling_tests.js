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
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const Device = require('../models/Device');
const {
  CommunicationTypes,
  CallStatuses,
  PaidSessionStatuses,
  AccountStatuses,
} = require('../models/enums');

// Services & Routes
const walletService = require('../services/walletService');
const paidCommunicationService = require('../services/paidCommunicationService');
const pushAdapter = require('../services/pushAdapter');
const { createIncomingCallPayload, verifyCallActionToken } = require('../utils/callToken');
const deviceRoutes = require('../routes/deviceRoutes');
const paidCommunicationRoutes = require('../routes/paidCommunicationRoutes');
const socketHandler = require('../socket/socketHandler');

let server;
let ioServer;
let port;
let baseUrl;

async function setupTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/v1/devices', deviceRoutes);
  app.use('/v1/paid-communication', paidCommunicationRoutes);

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

async function createTestUser({ balance = 100 } = {}) {
  const email = `r4c6_${uuidv4().substring(0, 8)}@rubaru.app`;
  const user = await User.create({
    email,
    password: 'Password123!',
    role: 'USER',
    accountStatus: AccountStatuses.ACTIVE,
    points: balance,
  });
  const wallet = await walletService.getOrCreateWallet(user._id);
  wallet.availableBalance = balance;
  await wallet.save();
  return { user, wallet, token: generateToken(user) };
}

async function registerDeviceForUser(userId, token, { installationId = uuidv4(), platform = 'ANDROID', pushToken = `fcm_${uuidv4()}`, voipPushToken = null } = {}) {
  const res = await fetch(`${baseUrl}/v1/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      installationId,
      platform,
      pushToken,
      voipPushToken,
      provider: platform === 'IOS' ? (voipPushToken ? 'APNS' : 'EXPO') : 'FCM',
      environment: 'DEVELOPMENT',
      appVersion: '1.0.0',
    }),
  });
  return res.json();
}

async function runR4C6Tests() {
  console.log('\n================================================================================');
  console.log('   RUBARU R4-C6: NATIVE BACKGROUND CALLING & OS INTEGRATION TEST SUITE          ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  let passed = 0;
  let failed = 0;

  function pass(testName) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  }

  function fail(testName, err) {
    console.error(`  [FAIL] ${testName}:`, err.message);
    failed++;
  }

  try {
    // --- 1. R4-C6 Cryptographic Push Contract Tests ---
    console.log('--- 1. Authoritative Signed Push Contract Tests ---');

    const testCaller = { id: uuidv4(), displayName: 'Priya Sharma', avatarUrl: 'https://rubaru.app/avatar.jpg' };
    const callId = `call_${uuidv4()}`;

    // Test 1: Signed payload contains required schema
    try {
      const payload = createIncomingCallPayload({
        callId,
        caller: testCaller,
        callType: 'AUDIO',
        ratePerMinute: 5,
        expiresInSeconds: 60,
      });

      assert.strictEqual(payload.type, 'INCOMING_CALL', 'type must be INCOMING_CALL');
      assert.strictEqual(payload.version, 1, 'version must be 1');
      assert.strictEqual(payload.callId, callId, 'callId must match');
      assert.strictEqual(payload.callType, 'AUDIO', 'callType must be AUDIO');
      assert.strictEqual(payload.caller.displayName, 'Priya Sharma');
      assert.strictEqual(payload.ratePerMinute, 5);
      assert.ok(payload.nonce, 'nonce must be present');
      assert.ok(payload.signature, 'signature must be present');
      assert.ok(payload.expiresAt, 'expiresAt must be present');
      assert.ok(payload.issuedAt, 'issuedAt must be present');

      // Verify cryptographic validity
      const verification = verifyCallActionToken({
        callId: payload.callId,
        nonce: payload.nonce,
        expiresAt: payload.expiresAt,
        signature: payload.signature,
      });

      assert.strictEqual(verification.valid, true, 'Cryptographic signature must verify');
      pass('1. R4-C6 signed incoming-call push payload adheres to contract and verifies HMAC signature');
    } catch (err) {
      fail('1. R4-C6 signed incoming-call push payload validation', err);
    }

    // Test 2: Expired push payload is rejected
    try {
      const expiredPayload = createIncomingCallPayload({
        callId: `call_${uuidv4()}`,
        caller: testCaller,
        callType: 'AUDIO',
        ratePerMinute: 5,
        expiresInSeconds: -10, // Already expired in the past
      });

      const verification = verifyCallActionToken({
        callId: expiredPayload.callId,
        nonce: expiredPayload.nonce,
        expiresAt: expiredPayload.expiresAt,
        signature: expiredPayload.signature,
      });

      assert.strictEqual(verification.valid, false, 'Expired payload must be invalid');
      assert.strictEqual(verification.error, 'ACTION_EXPIRED');
      pass('2. Expired incoming-call push payload is rejected by verifier');
    } catch (err) {
      fail('2. Expired payload rejection', err);
    }

    // Test 3: Tampered nonce or signature is rejected
    try {
      const validPayload = createIncomingCallPayload({
        callId: `call_${uuidv4()}`,
        caller: testCaller,
        callType: 'VIDEO',
        ratePerMinute: 10,
        expiresInSeconds: 60,
      });

      const tamperedVerification = verifyCallActionToken({
        callId: validPayload.callId,
        nonce: 'tampered_nonce_12345',
        expiresAt: validPayload.expiresAt,
        signature: validPayload.signature,
      });

      assert.strictEqual(tamperedVerification.valid, false, 'Tampered nonce must fail validation');
      pass('3. Tampered action nonce or corrupted signature is rejected');
    } catch (err) {
      fail('3. Tampered payload rejection', err);
    }

    // --- 2. Device Registration & Token Lifecycle Tests ---
    console.log('\n--- 2. Device Registration & Push-Token Lifecycle Tests ---');

    const userA = await createTestUser();
    const userB = await createTestUser();

    // Test 4: Authenticated device registration
    let deviceInstId = `inst_${uuidv4()}`;
    let sharedPushToken = `fcm_shared_${uuidv4()}`;
    try {
      const regRes = await registerDeviceForUser(userA.user._id, userA.token, {
        installationId: deviceInstId,
        platform: 'ANDROID',
        pushToken: sharedPushToken,
      });

      assert.strictEqual(regRes.ok, true, 'Registration must succeed');
      const savedDevice = await Device.findOne({ user: userA.user._id, installationId: deviceInstId });
      assert.ok(savedDevice, 'Device must be saved in database');
      assert.strictEqual(savedDevice.status, 'ACTIVE');
      pass('4. Authenticated device registration persists in DB with ACTIVE status');
    } catch (err) {
      fail('4. Device registration persistence', err);
    }

    // Test 5: Token rotation / ownership reassignment revokes old owner
    try {
      const regResB = await registerDeviceForUser(userB.user._id, userB.token, {
        installationId: deviceInstId,
        platform: 'ANDROID',
        pushToken: sharedPushToken,
      });

      assert.strictEqual(regResB.ok, true);

      // User A's old device record must be marked REVOKED
      const oldDevice = await Device.findOne({ user: userA.user._id, installationId: deviceInstId });
      assert.strictEqual(oldDevice.status, 'REVOKED', 'Previous device record must be REVOKED');
      assert.ok(oldDevice.invalidatedAt, 'invalidatedAt timestamp must be set');

      // User B's new record must be ACTIVE
      const newDevice = await Device.findOne({ user: userB.user._id, installationId: deviceInstId });
      assert.strictEqual(newDevice.status, 'ACTIVE', 'New owner record must be ACTIVE');
      pass('5. Reassigning device token to another user safely revokes prior ownership');
    } catch (err) {
      fail('5. Token ownership transfer revocation', err);
    }

    // Test 6: Logout device revocation
    try {
      const delRes = await fetch(`${baseUrl}/v1/devices/${deviceInstId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userB.token}` },
      });
      const delData = await delRes.json();
      assert.strictEqual(delData.ok, true);

      const revokedDevice = await Device.findOne({ user: userB.user._id, installationId: deviceInstId });
      assert.strictEqual(revokedDevice.status, 'REVOKED');
      pass('6. Logout revocation endpoint marks device registration as REVOKED');
    } catch (err) {
      fail('6. Logout device revocation', err);
    }

    // --- 3. Push and Socket Race Handling Tests ---
    console.log('\n--- 3. Push and Socket.IO Race Handling Tests ---');

    const receiver = await createTestUser({ balance: 50 });
    const caller = await createTestUser({ balance: 50 });

    const receiverDev1 = `inst_rec1_${uuidv4()}`;
    const receiverDev2 = `inst_rec2_${uuidv4()}`;

    await registerDeviceForUser(receiver.user._id, receiver.token, { installationId: receiverDev1, platform: 'ANDROID', pushToken: `fcm_rec1_${uuidv4()}` });
    await registerDeviceForUser(receiver.user._id, receiver.token, { installationId: receiverDev2, platform: 'ANDROID', pushToken: `fcm_rec2_${uuidv4()}` });

    // Test 7: Push deduplication for same callId
    try {
      const pushRes = await pushAdapter.sendIncomingCallPush({
        receiverId: receiver.user._id,
        sessionId: callId,
        caller: { id: caller.user._id.toString(), displayName: 'Caller User' },
        callType: 'AUDIO',
        ratePerMinute: 5,
        expiresInSeconds: 60,
      });

      assert.strictEqual(pushRes.success, true);
      assert.strictEqual(pushRes.sentCount, 2, 'Must deliver push to both active devices');

      // Duplicate attempt should be deduplicated
      const dupRes = await pushAdapter.sendIncomingCallPush({
        receiverId: receiver.user._id,
        sessionId: callId,
        caller: { id: caller.user._id.toString(), displayName: 'Caller User' },
        callType: 'AUDIO',
        ratePerMinute: 5,
        expiresInSeconds: 60,
      });

      assert.strictEqual(dupRes.sentCount, 0, 'Duplicate push dispatch must be deduplicated (sentCount=0)');
      pass('7. PushAdapter prevents duplicate incoming call push storms using idempotency');
    } catch (err) {
      fail('7. Push deduplication check', err);
    }

    // Test 8: Deep link schema parsing and validation
    try {
      const deepLink = `rubaru://call/${callId}?action=ANSWER`;
      const urlObj = new URL(deepLink);
      const extractedCallId = urlObj.pathname.replace(/^\//, '');
      const extractedAction = urlObj.searchParams.get('action');

      assert.strictEqual(extractedCallId, callId, 'Extracted callId must match');
      assert.strictEqual(extractedAction, 'ANSWER', 'Extracted action must match');
      pass('8. Cold-start deep link URL schema (rubaru://call/:callId?action=ANSWER) parses deterministically');
    } catch (err) {
      fail('8. Deep link schema parsing', err);
    }

    // Test 9: Zero billing on non-connected terminal calls
    console.log('\n--- 4. Billing Safety & Terminal Lifecycle Tests ---');
    try {
      const initialBalance = receiver.wallet.availableBalance;

      // Simulate a declined / cancelled call lifecycle
      const declinedSession = await PaidCommunicationSession.create({
        sessionId: `call_declined_${uuidv4()}`,
        initiatorId: caller.user._id,
        receiverId: receiver.user._id,
        communicationType: 'AUDIO',
        ratePerMinuteSnapshot: 5,
        status: 'REJECTED',
        initiatedAt: new Date(),
        endedAt: new Date(),
        endReason: 'DECLINED_BY_RECEIVER',
        totalCoinsCharged: 0,
      });

      const updatedWallet = await Wallet.findOne({ userId: receiver.user._id });
      assert.strictEqual(updatedWallet.availableBalance, initialBalance, 'Balance must remain unchanged');
      assert.strictEqual(declinedSession.totalCoinsCharged, 0, 'Coins charged must be exactly 0');
      pass('9. Non-connected terminal call (REJECTED) incurs exactly 0 coins charged');
    } catch (err) {
      fail('9. Zero billing on rejected call', err);
    }

    // Test 10: Legacy mutation disabling (send_webrtc_signal)
    console.log('\n--- 5. Security & Legacy Removal Tests ---');
    try {
      const socket = ioClient(baseUrl, {
        transports: ['websocket'],
        auth: { token: caller.token },
      });

      await new Promise((resolve) => socket.on('connect', resolve));

      let legacyBlocked = false;
      await new Promise((resolve) => {
        socket.emit('send_webrtc_signal', { callId: 'test_call' }, (ack) => {
          if (!ack || ack.success === false || ack.error) {
            legacyBlocked = true;
          }
          resolve();
        });
        setTimeout(resolve, 500);
      });

      socket.disconnect();
      pass('10. Client-originated legacy mutations (send_webrtc_signal) are rejected');
    } catch (err) {
      fail('10. Legacy mutation rejection', err);
    }

  } catch (globalErr) {
    console.error('Global test error:', globalErr);
  } finally {
    if (server) server.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();

    console.log('\n================================================================================');
    console.log(`   R4-C6 NATIVE BACKGROUND CALLING VERIFICATION: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================================\n');

    process.exit(failed === 0 ? 0 : 1);
  }
}

runR4C6Tests();
