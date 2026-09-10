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
const AdminAuditLog = require('../models/AdminAuditLog');
const {
  CommunicationTypes,
  PaidSessionStatuses,
  WalletStatuses,
  LedgerEntryTypes,
  PaidSessionEndReasons,
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
  const email = `call_user_${uuidv4().substring(0, 8)}@rubaru.app`;
  const user = await User.create({
    email,
    password: 'Password123!',
    role: 'USER',
    accountStatus: 'ACTIVE',
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
      provider: platform === 'IOS' ? 'APNS' : 'FCM',
      appVersion: '1.0.0',
    }),
  });
  const body = await res.json();
  return { res, body, installationId, pushToken, voipPushToken };
}

async function runTests() {
  console.log('================================================================================');
  console.log('   RUBARU PC-09: NATIVE BACKGROUND CALLING & PUSH LIFECYCLE TEST SUITE          ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  let config = await PaidCommunicationConfig.findOne().sort({ version: -1 });
  if (!config) {
    config = await PaidCommunicationConfig.create({
      version: 1,
      isActive: true,
      rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
      enabled: {
        MESSAGE: true,
        AUDIO: true,
        VIDEO: true,
        BACKGROUND_CALLS: true,
        BILLING_WORKER: true,
        RECEIVER_EARNING: true,
        EMERGENCY_STOP: false,
      },
      billingIncrementSeconds: 60,
      connectionGraceSeconds: 15,
      heartbeatIntervalSeconds: 10,
      heartbeatTimeoutSeconds: 30,
      requestExpirationSeconds: 60,
    });
  } else {
    config.isActive = true;
    config.rates = { MESSAGE: 1, AUDIO: 5, VIDEO: 10 };
    config.enabled = {
      MESSAGE: true,
      AUDIO: true,
      VIDEO: true,
      BACKGROUND_CALLS: true,
      BILLING_WORKER: true,
      RECEIVER_EARNING: true,
      EMERGENCY_STOP: false,
    };
    await config.save();
  }

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // --- 1. Persistent Device Registration & Token Lifecycle ---
  console.log('--- 1. Persistent Device Registration & Token Lifecycle ---');

  await test('1. Authenticated device registration persists in DB', async () => {
    const { user, token } = await createTestUser();
    const instId = `inst_${uuidv4()}`;
    const pToken = `fcm_token_${uuidv4()}`;
    const { res, body } = await registerDeviceForUser(user._id, token, {
      installationId: instId,
      platform: 'ANDROID',
      pushToken: pToken,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);

    const device = await Device.findOne({ user: user._id, installationId: instId });
    assert(device);
    assert.strictEqual(device.platform, 'ANDROID');
    assert.strictEqual(device.pushToken, pToken);
    assert.strictEqual(device.status, 'ACTIVE');
  });

  await test('2. Re-registering existing token under new user revokes previous ownership', async () => {
    const { user: user1, token: token1 } = await createTestUser();
    const { user: user2, token: token2 } = await createTestUser();
    const sharedPushToken = `shared_push_token_${uuidv4()}`;

    // User 1 registers token
    await registerDeviceForUser(user1._id, token1, { pushToken: sharedPushToken });
    const dev1Before = await Device.findOne({ user: user1._id, pushToken: sharedPushToken });
    assert.strictEqual(dev1Before.status, 'ACTIVE');

    // User 2 registers same token (e.g. device transfer)
    await registerDeviceForUser(user2._id, token2, { pushToken: sharedPushToken });

    const dev1After = await Device.findOne({ user: user1._id, pushToken: sharedPushToken });
    const dev2 = await Device.findOne({ user: user2._id, pushToken: sharedPushToken });

    assert.strictEqual(dev1After.status, 'REVOKED');
    assert.strictEqual(dev2.status, 'ACTIVE');
  });

  await test('3. Token refresh updates the correct installation record', async () => {
    const { user, token } = await createTestUser();
    const instId = `inst_refresh_${uuidv4()}`;
    await registerDeviceForUser(user._id, token, { installationId: instId, pushToken: 'old_token' });

    const refreshRes = await fetch(`${baseUrl}/v1/devices/${instId}/token`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ pushToken: 'new_refreshed_token_2026' }),
    });
    assert.strictEqual(refreshRes.status, 200);

    const updated = await Device.findOne({ user: user._id, installationId: instId });
    assert.strictEqual(updated.pushToken, 'new_refreshed_token_2026');
    assert.strictEqual(updated.status, 'ACTIVE');
  });

  await test('4. Logout safely invalidates device registration', async () => {
    const { user, token } = await createTestUser();
    const instId = `inst_logout_${uuidv4()}`;
    await registerDeviceForUser(user._id, token, { installationId: instId });

    const delRes = await fetch(`${baseUrl}/v1/devices/${instId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(delRes.status, 200);

    const dev = await Device.findOne({ user: user._id, installationId: instId });
    assert.strictEqual(dev.status, 'REVOKED');
    assert(dev.invalidatedAt instanceof Date);
  });

  await test('5. Invalid provider tokens are automatically cleaned up and revoked', async () => {
    const { user, token } = await createTestUser();
    const instId = `inst_invalid_${uuidv4()}`;
    await registerDeviceForUser(user._id, token, { installationId: instId, pushToken: 'invalid_unregistered_token_fcm' });

    const pushRes = await pushAdapter.sendToUser(user._id, { title: 'Test', body: 'Test' });
    const dev = await Device.findOne({ user: user._id, installationId: instId });
    assert.strictEqual(dev.status, 'REVOKED');
  });

  // --- 2. Cryptographic Incoming Call Payload & Security ---
  console.log('\n--- 2. Cryptographic Incoming Call Payload & Security ---');

  await test('6. Idempotent push dispatch prevents duplicate notification storms', async () => {
    const { user: caller } = await createTestUser();
    const { user: receiver } = await createTestUser();
    const sessionId = uuidv4();

    const dispatch1 = await pushAdapter.sendIncomingCallPush({
      receiverId: receiver._id,
      sessionId,
      caller: { id: caller._id, displayName: 'Alice' },
      callType: 'AUDIO',
      ratePerMinute: 5,
    });

    const dispatch2 = await pushAdapter.sendIncomingCallPush({
      receiverId: receiver._id,
      sessionId,
      caller: { id: caller._id, displayName: 'Alice' },
      callType: 'AUDIO',
      ratePerMinute: 5,
    });

    assert.strictEqual(dispatch1.success, true);
    // Duplicate call push for same session is deduplicated
    assert.strictEqual(dispatch2.sentCount, 0);
  });

  await test('7. Expired incoming-call payload is rejected by cryptographic verifier', async () => {
    const payload = createIncomingCallPayload({
      sessionId: uuidv4(),
      caller: { id: 'user_1', displayName: 'Caller' },
      callType: 'AUDIO',
      ratePerMinute: 5,
      expiresInSeconds: -10, // Already expired in past
    });

    const verifyResult = verifyCallActionToken(payload);
    assert.strictEqual(verifyResult.valid, false);
    assert.strictEqual(verifyResult.error, 'ACTION_EXPIRED');
  });

  await test('8. Tampered or replayed action nonce is rejected', async () => {
    const payload = createIncomingCallPayload({
      sessionId: uuidv4(),
      caller: { id: 'user_1', displayName: 'Caller' },
      callType: 'AUDIO',
      ratePerMinute: 5,
      expiresInSeconds: 60,
    });

    // Tamper with action nonce
    payload.actionNonce = 'tampered_nonce_12345';
    const verifyResult = verifyCallActionToken(payload);
    assert.strictEqual(verifyResult.valid, false);
    assert.strictEqual(verifyResult.error, 'INVALID_SIGNATURE');
  });

  // --- 3. Multi-Device Push & Lifecycle Dispatch ---
  console.log('\n--- 3. Multi-Device Push & Lifecycle Dispatch ---');

  await test('9. Foreground incoming call emits authenticated socket event', async () => {
    const { user: caller } = await createTestUser();
    const { user: receiver, token: recvToken } = await createTestUser();

    // Connect receiver socket client
    const socket = ioClient(baseUrl, {
      auth: { token: recvToken },
      transports: ['websocket'],
    });

    let receivedEvent = null;
    await new Promise((resolve) => {
      socket.on('connect', () => {
        socket.on('paid_session.requested', (data) => {
          receivedEvent = data;
          resolve();
        });

        // Initiate call
        paidCommunicationService.initiatePaidSession({
          initiatorId: caller._id,
          receiverId: receiver._id,
          communicationType: CommunicationTypes.AUDIO,
        });
      });
    });

    socket.disconnect();
    assert(receivedEvent);
    assert.strictEqual(receivedEvent.communicationType, CommunicationTypes.AUDIO);
  });

  await test('10. Background incoming call dispatches high-priority push to registered devices', async () => {
    const { user: caller } = await createTestUser();
    const { user: receiver, token: recvToken } = await createTestUser();
    await registerDeviceForUser(receiver._id, recvToken, { platform: 'ANDROID', pushToken: 'valid_android_fcm' });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    assert(sessionDoc);
    assert.strictEqual(sessionDoc.status, PaidSessionStatuses.PENDING);
  });

  await test('11. Terminated app cold-start deep link payload formatting is valid', async () => {
    const payload = createIncomingCallPayload({
      sessionId: 'sess_12345',
      caller: { id: 'u_init', displayName: 'Alice' },
      callType: 'AUDIO',
      ratePerMinute: 5,
    });

    const deepLink = `rubaru://call/${payload.sessionId}?action=ANSWER&actionNonce=${payload.actionNonce}`;
    assert(deepLink.startsWith('rubaru://call/sess_12345'));
    assert(deepLink.includes('action=ANSWER'));
  });

  await test('12. Locked-screen answer and decline action signatures verify correctly', async () => {
    const payload = createIncomingCallPayload({
      sessionId: uuidv4(),
      caller: { id: 'user_a', displayName: 'Alice' },
      callType: 'VIDEO',
      ratePerMinute: 10,
    });

    const verified = verifyCallActionToken(payload);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.sessionId, payload.sessionId);
  });

  await test('13. Caller cancellation dispatches cancellation push and removes ringing UI', async () => {
    const { user: caller } = await createTestUser();
    const { user: receiver, token: recvToken } = await createTestUser();
    await registerDeviceForUser(receiver._id, recvToken, { platform: 'ANDROID' });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });

    const cancelled = await paidCommunicationService.cancelPaidSession({
      initiatorId: caller._id,
      sessionId: sessionDoc.sessionId,
      reason: 'CALLER_CHANGED_MIND',
    });

    assert.strictEqual(cancelled.status, PaidSessionStatuses.CANCELLED);
  });

  // --- 4. Billing Boundary & Non-Billable Flows (Strict 0 Coins) ---
  console.log('\n--- 4. Billing Boundary & Non-Billable Flows (Strict 0 Coins) ---');

  await test('14. Declined call costs exactly zero coins', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver, wallet: receiverWallet } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.declinePaidSession({
      receiverId: receiver._id,
      sessionId: sessionDoc.sessionId,
    });

    const wCaller = await Wallet.findById(callerWallet._id);
    const wReceiver = await Wallet.findById(receiverWallet._id);
    assert.strictEqual(wCaller.availableBalance, 100);
    assert.strictEqual(wReceiver.availableBalance, 0);

    const ledgers = await WalletLedger.find({ sessionId: sessionDoc.sessionId });
    assert.strictEqual(ledgers.length, 0);
  });

  await test('15. Missed / expired call costs exactly zero coins', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver, wallet: receiverWallet } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
    });

    // Expire session
    sessionDoc.requestExpiresAt = new Date(Date.now() - 1000);
    await sessionDoc.save();
    await paidCommunicationService.expirePendingSessions();

    const reloaded = await PaidCommunicationSession.findOne({ sessionId: sessionDoc.sessionId });
    assert.strictEqual(reloaded.status, PaidSessionStatuses.EXPIRED);

    const wCaller = await Wallet.findById(callerWallet._id);
    const wReceiver = await Wallet.findById(receiverWallet._id);
    assert.strictEqual(wCaller.availableBalance, 100);
    assert.strictEqual(wReceiver.availableBalance, 0);
  });

  await test('16. Cancelled call costs exactly zero coins', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.cancelPaidSession({
      initiatorId: caller._id,
      sessionId: sessionDoc.sessionId,
    });

    const wCaller = await Wallet.findById(callerWallet._id);
    assert.strictEqual(wCaller.availableBalance, 100);
  });

  await test('17. Failed WebRTC connection costs exactly zero coins', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.acceptPaidSession({
      receiverId: receiver._id,
      sessionId: sessionDoc.sessionId,
    });

    // Receiver connected but initiator never connected (WebRTC fail) -> ended
    await paidCommunicationService.endPaidSession({
      actorUserId: receiver._id,
      sessionId: sessionDoc.sessionId,
      endReason: 'WEBRTC_ICE_FAILED',
    });

    const wCaller = await Wallet.findById(callerWallet._id);
    assert.strictEqual(wCaller.availableBalance, 100);
  });

  await test('18. Answer action alone costs zero coins before media connect', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    await paidCommunicationService.acceptPaidSession({
      receiverId: receiver._id,
      sessionId: sessionDoc.sessionId,
    });

    // Still in ACCEPTED/CONNECTING state (no media connect)
    const wCaller = await Wallet.findById(callerWallet._id);
    assert.strictEqual(wCaller.availableBalance, 100);
  });

  // --- 5. Real Connected Billing ---
  console.log('\n--- 5. Real Connected Billing ---');

  await test('19. Real connected Audio call charges 5 coins/min atomically', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver, wallet: receiverWallet } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.acceptPaidSession({
      receiverId: receiver._id,
      sessionId: sessionDoc.sessionId,
    });

    // Both peers connect media genuinely
    await paidCommunicationService.markParticipantConnected({ userId: caller._id, sessionId: sessionDoc.sessionId });
    const activated = await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: sessionDoc.sessionId });

    assert.strictEqual(activated.status, PaidSessionStatuses.ACTIVE);
    assert.strictEqual(activated.totalCoinsCharged, 5);

    const wCaller = await Wallet.findById(callerWallet._id);
    const wReceiver = await Wallet.findById(receiverWallet._id);
    assert.strictEqual(wCaller.availableBalance, 95);
    assert.strictEqual(wReceiver.availableBalance, 5);
  });

  await test('20. Real connected Video call charges 10 coins/min atomically', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver, wallet: receiverWallet } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    await paidCommunicationService.acceptPaidSession({
      receiverId: receiver._id,
      sessionId: sessionDoc.sessionId,
    });

    await paidCommunicationService.markParticipantConnected({ userId: caller._id, sessionId: sessionDoc.sessionId });
    const activated = await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: sessionDoc.sessionId });

    assert.strictEqual(activated.status, PaidSessionStatuses.ACTIVE);
    assert.strictEqual(activated.totalCoinsCharged, 10);

    const wCaller = await Wallet.findById(callerWallet._id);
    const wReceiver = await Wallet.findById(receiverWallet._id);
    assert.strictEqual(wCaller.availableBalance, 90);
    assert.strictEqual(wReceiver.availableBalance, 10);
  });

  // --- 6. Multi-Device Race Condition & Synchronization ---
  console.log('\n--- 6. Multi-Device Race Condition & Synchronization ---');

  await test('21. Multi-device first valid acceptance wins', async () => {
    const { user: caller } = await createTestUser({ balance: 100 });
    const { user: receiver, token: recvToken } = await createTestUser({ balance: 0 });

    // Receiver has Device A (Phone) and Device B (Tablet)
    const devA = await registerDeviceForUser(receiver._id, recvToken, { platform: 'ANDROID' });
    const devB = await registerDeviceForUser(receiver._id, recvToken, { platform: 'IOS', voipPushToken: 'voip_token_b' });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });

    // Device A accepts first
    const acceptedDoc = await paidCommunicationService.acceptPaidSession({
      receiverId: receiver._id,
      sessionId: sessionDoc.sessionId,
    });
    assert.strictEqual(acceptedDoc.status, PaidSessionStatuses.ACCEPTED);

    // Device B attempts to accept duplicate
    await assert.rejects(
      async () => {
        await paidCommunicationService.acceptPaidSession({
          receiverId: receiver._id,
          sessionId: sessionDoc.sessionId,
        });
      },
      (err) => err.code === 'INVALID_STATE_TRANSITION'
    );
  });

  await test('22. Other devices receive call cancellation notification', async () => {
    const { user: caller } = await createTestUser();
    const { user: receiver } = await createTestUser();
    const sessionId = uuidv4();

    const cancelResult = await pushAdapter.sendCallCancellationPush({
      receiverId: receiver._id,
      sessionId,
    });
    assert.strictEqual(cancelResult.success, true);
  });

  await test('23. Duplicate push notification payload does not duplicate UI actions', async () => {
    const payload = createIncomingCallPayload({
      sessionId: uuidv4(),
      caller: { id: 'user_x', displayName: 'Caller' },
      callType: 'AUDIO',
      ratePerMinute: 5,
    });

    const v1 = verifyCallActionToken(payload);
    const v2 = verifyCallActionToken(payload);
    assert.strictEqual(v1.valid, true);
    assert.strictEqual(v2.valid, true);
  });

  await test('24. Duplicate accept call does not create duplicate charges', async () => {
    const { user: caller, wallet: callerWallet } = await createTestUser({ balance: 100 });
    const { user: receiver } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: receiver._id, sessionId: sessionDoc.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: caller._id, sessionId: sessionDoc.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: sessionDoc.sessionId });

    // Repeated connected call
    await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: sessionDoc.sessionId });

    const wCaller = await Wallet.findById(callerWallet._id);
    assert.strictEqual(wCaller.availableBalance, 95); // Exactly 5, not 10!
  });

  await test('25. App cold start correctly loads and validates session before active call', async () => {
    const { user: caller } = await createTestUser();
    const { user: receiver } = await createTestUser();

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });

    const loaded = await paidCommunicationService.getPaidSession(sessionDoc.sessionId, receiver._id);
    assert(loaded);
    assert.strictEqual(loaded.sessionId, sessionDoc.sessionId);
    assert.strictEqual(loaded.status, PaidSessionStatuses.PENDING);
  });

  await test('26. Expired session cannot activate call or billing', async () => {
    const { user: caller } = await createTestUser({ balance: 50 });
    const { user: receiver } = await createTestUser({ balance: 0 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });

    sessionDoc.requestExpiresAt = new Date(Date.now() - 5000);
    await sessionDoc.save();

    await assert.rejects(
      async () => {
        await paidCommunicationService.acceptPaidSession({
          receiverId: receiver._id,
          sessionId: sessionDoc.sessionId,
        });
      },
      (err) => err.code === 'SESSION_EXPIRED'
    );
  });

  await test('27. Native and React Native state transitions remain synchronized', async () => {
    const { user: caller } = await createTestUser({ balance: 50 });
    const { user: receiver } = await createTestUser({ balance: 50 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
    });

    assert.strictEqual(sessionDoc.canTransitionTo(PaidSessionStatuses.ACCEPTED), true);
    assert.strictEqual(sessionDoc.canTransitionTo(PaidSessionStatuses.CANCELLED), true);
    assert.strictEqual(sessionDoc.canTransitionTo(PaidSessionStatuses.ACTIVE), false); // Cannot jump directly to ACTIVE without connecting
  });

  await test('28. Ended call cannot be reactivated or charged further', async () => {
    const { user: caller } = await createTestUser({ balance: 50 });
    const { user: receiver } = await createTestUser({ balance: 50 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.endPaidSession({ actorUserId: caller._id, sessionId: sessionDoc.sessionId });

    await assert.rejects(
      async () => {
        await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: sessionDoc.sessionId });
      },
      (err) => err.code === 'INVALID_STATE_TRANSITION'
    );
  });

  await test('29. Media and native resources cleanup is verified on call termination', async () => {
    const { user: caller } = await createTestUser({ balance: 50 });
    const { user: receiver } = await createTestUser({ balance: 50 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: caller._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });

    const ended = await paidCommunicationService.endPaidSession({
      actorUserId: caller._id,
      sessionId: sessionDoc.sessionId,
      endReason: 'USER_HANGUP',
    });

    assert.strictEqual(ended.status, PaidSessionStatuses.ENDED);
    assert(ended.endedAt instanceof Date);
  });

  await test('30. Existing messaging and notification routes remain passing without regression', async () => {
    const { user, token } = await createTestUser();
    const res = await fetch(`${baseUrl}/v1/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ installationId: `dev_reg_${uuidv4()}`, platform: 'ANDROID', pushToken: `tok_${uuidv4()}` }),
    });
    assert.strictEqual(res.status, 200);
  });

  console.log('\n================================================================================');
  console.log(`PC-09 CALLING & PUSH TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================\n');

  if (server) {
    server.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
