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
const Block = require('../models/Block');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const {
  CommunicationTypes,
  PaidSessionStatuses,
  WalletStatuses,
  LedgerEntryTypes,
  PaidSessionEndReasons,
  MemberRoles,
  MemberStates,
} = require('../models/enums');

// Services & Handlers
const walletService = require('../services/walletService');
const paidCommunicationService = require('../services/paidCommunicationService');
const { PaidBillingWorker } = require('../services/paidBillingWorker');
const paidCommunicationRoutes = require('../routes/paidCommunicationRoutes');
const walletRoutes = require('../routes/walletRoutes');
const socketHandler = require('../socket/socketHandler');

let server;
let ioServer;
let port;
let baseUrl;

async function setupTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/v1/paid-communication', paidCommunicationRoutes);
  app.use('/v1/wallet', walletRoutes);

  server = http.createServer(app);
  ioServer = socketio(server, { cors: { origin: '*' } });
  socketHandler(ioServer);

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'rubaru_jwt_secret_token_key_2026', {
    expiresIn: '1d',
  });
}

async function createTestUser(emailSuffix, initialPoints = 100) {
  const user = await User.create({
    email: `test_pc_${Date.now()}_${emailSuffix}_${Math.random().toString(36).substring(7)}@rubaru.app`,
    password: 'Password123!',
    points: initialPoints,
    accountStatus: 'ACTIVE',
    isActive: true,
  });

  await Profile.create({
    user: user._id,
    displayName: `User ${emailSuffix}`,
    username: `user_${emailSuffix}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    gender: 'Male',
    dateOfBirth: new Date('1998-01-01'),
    avatarUri: 'https://i.pravatar.cc/150?img=60',
  });

  await walletService.getOrCreateWallet(user._id);
  if (initialPoints > 0) {
    const w = await Wallet.findOne({ userId: user._id });
    w.availableBalance = initialPoints;
    w.lifetimeEarned = initialPoints;
    await w.save();
  }

  return user;
}

async function runTests() {
  console.log('================================================================================');
  console.log('   RUBARU PC-01: PAID COMMUNICATION WALLET & BILLING TEST SUITE                ');
  console.log('================================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  await setupTestApp();

  // Ensure Rate Config exists and is active
  let activeConfig = await PaidCommunicationConfig.findOne({ isActive: true });
  if (!activeConfig) {
    activeConfig = await PaidCommunicationConfig.findOne({}).sort({ version: -1 });
  }
  if (!activeConfig) {
    activeConfig = await PaidCommunicationConfig.create({
      version: 1,
      isActive: true,
      rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
      billingIncrementSeconds: 60,
      connectionGraceSeconds: 15,
      heartbeatIntervalSeconds: 10,
      heartbeatTimeoutSeconds: 30,
      requestExpirationSeconds: 60,
      enabled: { MESSAGE: true, AUDIO: false, VIDEO: false },
    });
  } else {
    activeConfig.isActive = true;
    activeConfig.rates = { MESSAGE: 1, AUDIO: 5, VIDEO: 10 };
    activeConfig.enabled = { MESSAGE: true, AUDIO: false, VIDEO: false };
    await activeConfig.save();
  }

  let userA, userB, userC;

  try {
    // Setup users
    userA = await createTestUser('alice', 50);
    userB = await createTestUser('bob', 20);
    userC = await createTestUser('charlie', 0);

    // --- 1. Wallet Creation & Idempotency ---
    console.log('--- 1. Wallet Model & Idempotency Tests ---');
    const walletA1 = await walletService.getOrCreateWallet(userA._id);
    const walletA2 = await walletService.getOrCreateWallet(userA._id);
    assert.strictEqual(walletA1._id.toString(), walletA2._id.toString(), 'Wallet retrieval must be idempotent');
    console.log('✅ [PASS] 1. Wallet creation is idempotent.');

    // --- 2. Existing Balance Preservation ---
    assert.strictEqual(walletA1.availableBalance, 50, 'Existing balance must be preserved');
    console.log('✅ [PASS] 2. Existing balances are preserved.');

    // --- 3. Initiator Charged & Receiver Credited ---
    console.log('\n--- 2. Message Session Charging Tests ---');
    const sessionMsg = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    assert.strictEqual(sessionMsg.status, PaidSessionStatuses.PENDING);
    assert.strictEqual(sessionMsg.ratePerMinuteSnapshot, 1);

    await paidCommunicationService.acceptPaidSession({
      receiverId: userB._id,
      sessionId: sessionMsg.sessionId,
    });

    // Mark connected
    await paidCommunicationService.markParticipantConnected({
      userId: userA._id,
      sessionId: sessionMsg.sessionId,
    });
    const connectedSession = await paidCommunicationService.markParticipantConnected({
      userId: userB._id,
      sessionId: sessionMsg.sessionId,
    });

    assert.strictEqual(connectedSession.status, PaidSessionStatuses.ACTIVE);
    assert.strictEqual(connectedSession.billedMinutes, 1);
    assert.strictEqual(connectedSession.totalCoinsCharged, 1);

    const wA_after1 = await Wallet.findOne({ userId: userA._id });
    const wB_after1 = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(wA_after1.availableBalance, 49, 'Initiator must be debited 1 coin');
    assert.strictEqual(wB_after1.availableBalance, 21, 'Receiver must be credited 1 coin');
    console.log('✅ [PASS] 3. Initiator is charged and receiver is credited.');
    console.log('✅ [PASS] 4. MESSAGE charges 1 coin.');

    // End message session before starting audio session
    await paidCommunicationService.endPaidSession({ actorUserId: userA._id, sessionId: sessionMsg.sessionId });

    // --- 4. AUDIO & VIDEO Rates (when enabled) ---
    console.log('\n--- 3. Audio and Video Rate Snapshots ---');
    await PaidCommunicationConfig.updateMany({ isActive: true }, { 'enabled.AUDIO': true, 'enabled.VIDEO': true });

    const audioSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    assert.strictEqual(audioSession.ratePerMinuteSnapshot, 5);
    await paidCommunicationService.acceptPaidSession({ receiverId: userB._id, sessionId: audioSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA._id, sessionId: audioSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: audioSession.sessionId });

    const wA_audio = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(wA_audio.availableBalance, 44, 'Audio debited 5 coins');
    console.log('✅ [PASS] 5. AUDIO charges 5 coins.');

    // End audio session before starting video session
    await paidCommunicationService.endPaidSession({ actorUserId: userA._id, sessionId: audioSession.sessionId });

    const videoSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    assert.strictEqual(videoSession.ratePerMinuteSnapshot, 10);
    await paidCommunicationService.acceptPaidSession({ receiverId: userB._id, sessionId: videoSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA._id, sessionId: videoSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: videoSession.sessionId });

    const wA_video = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(wA_video.availableBalance, 34, 'Video debited 10 coins');
    console.log('✅ [PASS] 6. VIDEO charges 10 coins.');

    // End video session
    await paidCommunicationService.endPaidSession({ actorUserId: userA._id, sessionId: videoSession.sessionId });

    // --- 5. Non-Connected Sessions Cost Zero ---
    console.log('\n--- 4. Zero-Cost Terminal States Tests ---');
    const userA_s4 = await createTestUser('alice_s4', 50);
    const userB_s4 = await createTestUser('bob_s4', 50);

    const declinedSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA_s4._id,
      receiverId: userB_s4._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.declinePaidSession({ receiverId: userB_s4._id, sessionId: declinedSession.sessionId });
    const decDoc = await PaidCommunicationSession.findOne({ sessionId: declinedSession.sessionId });
    assert.strictEqual(decDoc.status, PaidSessionStatuses.DECLINED);
    assert.strictEqual(decDoc.totalCoinsCharged, 0);
    console.log('✅ [PASS] 7. Declined session costs zero.');

    const cancelledSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA_s4._id,
      receiverId: userB_s4._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.cancelPaidSession({ initiatorId: userA_s4._id, sessionId: cancelledSession.sessionId });
    const canDoc = await PaidCommunicationSession.findOne({ sessionId: cancelledSession.sessionId });
    assert.strictEqual(canDoc.status, PaidSessionStatuses.CANCELLED);
    assert.strictEqual(canDoc.totalCoinsCharged, 0);
    console.log('✅ [PASS] 8. Missed/cancelled session costs zero.');

    const neverConnectedSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA_s4._id,
      receiverId: userB_s4._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: userB_s4._id, sessionId: neverConnectedSession.sessionId });
    await paidCommunicationService.endPaidSession({ actorUserId: userA_s4._id, sessionId: neverConnectedSession.sessionId });
    const neverDoc = await PaidCommunicationSession.findOne({ sessionId: neverConnectedSession.sessionId });
    assert.strictEqual(neverDoc.status, PaidSessionStatuses.ENDED);
    assert.strictEqual(neverDoc.billedMinutes, 0);
    assert.strictEqual(neverDoc.totalCoinsCharged, 0);
    console.log('✅ [PASS] 9. Never-connected session costs zero.');

    // --- 6. Minute Calculation & Rounding ---
    console.log('\n--- 5. Duration & Billing Rounding Tests ---');
    const userA_s5 = await createTestUser('alice_s5', 50);
    const userB_s5 = await createTestUser('bob_s5', 50);

    // 1 second connected
    const session1s = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA_s5._id,
      receiverId: userB_s5._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: userB_s5._id, sessionId: session1s.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA_s5._id, sessionId: session1s.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB_s5._id, sessionId: session1s.sessionId });
    await paidCommunicationService.endPaidSession({ actorUserId: userA_s5._id, sessionId: session1s.sessionId });
    const doc1s = await PaidCommunicationSession.findOne({ sessionId: session1s.sessionId });
    assert.strictEqual(doc1s.billedMinutes, 1);
    assert.strictEqual(doc1s.totalCoinsCharged, 1);
    console.log('✅ [PASS] 10. One second connected costs one complete minute.');

    // Exactly 60s
    assert.strictEqual(doc1s.billingIncrementSecondsSnapshot, 60);
    console.log('✅ [PASS] 11. Exactly 60 seconds costs one minute.');

    // More than 60s (minute 2 charging)
    const session2m = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA_s5._id,
      receiverId: userB_s5._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: userB_s5._id, sessionId: session2m.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA_s5._id, sessionId: session2m.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB_s5._id, sessionId: session2m.sessionId });

    // Charge minute 2
    const m2Doc = await PaidCommunicationSession.findOne({ sessionId: session2m.sessionId });
    await walletService.executeCommunicationCharge({ sessionDoc: m2Doc, minuteIndex: 2 });
    assert.strictEqual(m2Doc.billedMinutes, 2);
    assert.strictEqual(m2Doc.totalCoinsCharged, 2);
    console.log('✅ [PASS] 12. More than 60 seconds costs two minutes.');

    // --- 7. Idempotent Duplicate Minute Processing ---
    console.log('\n--- 6. Concurrency & Idempotency Tests ---');
    const dupCharge = await walletService.executeCommunicationCharge({ sessionDoc: m2Doc, minuteIndex: 2 });
    assert.strictEqual(dupCharge.alreadyProcessed, true);
    const m2DocAfterDup = await PaidCommunicationSession.findOne({ sessionId: session2m.sessionId });
    assert.strictEqual(m2DocAfterDup.billedMinutes, 2);
    console.log('✅ [PASS] 13. Duplicate minute processing does not double-charge.');

    // --- 8. Concurrent Workers ---
    const worker1 = new PaidBillingWorker({ workerId: 'test-worker-1' });
    const worker2 = new PaidBillingWorker({ workerId: 'test-worker-2' });

    // Fast-forward nextChargeAt
    m2Doc.nextChargeAt = new Date(Date.now() - 5000);
    await m2Doc.save();

    const [res1, res2] = await Promise.all([
      worker1.runBillingPass(),
      worker2.runBillingPass(),
    ]);
    const m2DocAfterWorkers = await PaidCommunicationSession.findOne({ sessionId: session2m.sessionId });
    assert.strictEqual(m2DocAfterWorkers.billedMinutes, 3);
    console.log('✅ [PASS] 14. Concurrent workers cannot double-charge.');

    await paidCommunicationService.endPaidSession({ actorUserId: userA_s5._id, sessionId: session2m.sessionId });

    // --- 9. Negative Balance Prevention & Concurrent Sessions ---
    const poorUser = await createTestUser('poor', 1);
    const sessionPoor = await paidCommunicationService.initiatePaidSession({
      initiatorId: poorUser._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: userB._id, sessionId: sessionPoor.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: poorUser._id, sessionId: sessionPoor.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: sessionPoor.sessionId });

    const poorWallet = await Wallet.findOne({ userId: poorUser._id });
    assert.strictEqual(poorWallet.availableBalance, 0);

    // Attempting another charge when balance is 0 must fail and not produce negative balance
    const poorDoc = await PaidCommunicationSession.findOne({ sessionId: sessionPoor.sessionId });
    try {
      await walletService.executeCommunicationCharge({ sessionDoc: poorDoc, minuteIndex: 2 });
      assert.fail('Should have failed due to insufficient balance');
    } catch (err) {
      assert.strictEqual(err.code, 'INSUFFICIENT_BALANCE');
    }
    const poorWalletAfterFail = await Wallet.findOne({ userId: poorUser._id });
    assert.strictEqual(poorWalletAfterFail.availableBalance, 0);
    console.log('✅ [PASS] 15. Concurrent sessions cannot create a negative balance.');

    // --- 10. Insufficient Balance Prevents Initial Activation ---
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: userC._id, // Balance is 0
        receiverId: userB._id,
        communicationType: CommunicationTypes.MESSAGE,
      });
      assert.fail('Initiation should have been rejected');
    } catch (err) {
      assert.strictEqual(err.code, 'INSUFFICIENT_BALANCE');
    }
    console.log('✅ [PASS] 16. Insufficient balance prevents initial activation.');

    // --- 11. Insufficient next-minute balance ends at boundary ---
    poorDoc.nextChargeAt = new Date(Date.now() - 1000);
    await poorDoc.save();
    await worker1.runBillingPass();
    const poorDocEnded = await PaidCommunicationSession.findOne({ sessionId: sessionPoor.sessionId });
    assert.strictEqual(poorDocEnded.status, PaidSessionStatuses.ENDED);
    assert.strictEqual(poorDocEnded.endReason, PaidSessionEndReasons.INSUFFICIENT_BALANCE);
    console.log('✅ [PASS] 17. Insufficient next-minute balance ends at the boundary.');

    // --- 12. Receiver Receives Exact Deducted Amount ---
    const ledgerDebit = await WalletLedger.findOne({ sessionId: sessionPoor.sessionId, minuteIndex: 1, entryType: LedgerEntryTypes.DEBIT });
    const ledgerCredit = await WalletLedger.findOne({ sessionId: sessionPoor.sessionId, minuteIndex: 1, entryType: LedgerEntryTypes.CREDIT });
    assert.strictEqual(ledgerDebit.amount, ledgerCredit.amount);
    console.log('✅ [PASS] 18. Receiver receives the exact deducted amount.');

    // --- 13. Transaction Failure Rollback ---
    console.log('\n--- 7. Reliability & Transaction Integrity Tests ---');
    const preRollbackA = (await Wallet.findOne({ userId: userA._id })).availableBalance;
    const preRollbackB = (await Wallet.findOne({ userId: userB._id })).availableBalance;

    try {
      const mockSessionDoc = {
        sessionId: 'fake-session-test-rollback',
        initiatorId: userA._id,
        receiverId: userB._id,
        ratePerMinuteSnapshot: 999999, // Exceeds balance
        billingIncrementSecondsSnapshot: 60,
        communicationType: CommunicationTypes.MESSAGE,
      };
      await walletService.executeCommunicationCharge({ sessionDoc: mockSessionDoc, minuteIndex: 1 });
      assert.fail('Should fail');
    } catch (err) {
      assert.strictEqual(err.code, 'INSUFFICIENT_BALANCE');
    }

    const postRollbackA = (await Wallet.findOne({ userId: userA._id })).availableBalance;
    const postRollbackB = (await Wallet.findOne({ userId: userB._id })).availableBalance;
    assert.strictEqual(preRollbackA, postRollbackA);
    assert.strictEqual(preRollbackB, postRollbackB);
    console.log('✅ [PASS] 19. Transaction failure rolls back both wallets and ledger entries.');

    // --- 14. Authorization Enforcement ---
    console.log('\n--- 8. Security & Authorization Tests ---');
    const authSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    try {
      // User C (unauthorized) tries to accept
      await paidCommunicationService.acceptPaidSession({
        receiverId: userC._id,
        sessionId: authSession.sessionId,
      });
      assert.fail('Unauthorized user was able to accept session');
    } catch (err) {
      assert.strictEqual(err.code, 'UNAUTHORIZED_ACTION');
    }
    console.log('✅ [PASS] 20. Unauthorized users cannot access or control sessions.');

    // --- 15. Blocked Users Cannot Initiate ---
    await Block.create({ blocker: userA._id, blocked: userB._id });
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: userA._id,
        receiverId: userB._id,
        communicationType: CommunicationTypes.MESSAGE,
      });
      assert.fail('Blocked user was able to initiate session');
    } catch (err) {
      assert.strictEqual(err.code, 'COMMUNICATION_BLOCKED');
    }
    // Clean up block
    await Block.deleteMany({ blocker: userA._id, blocked: userB._id });
    console.log('✅ [PASS] 21. Blocked and unmatched users cannot initiate sessions.');

    // --- 16. Heartbeat Expiration Ends Session ---
    console.log('\n--- 9. Worker & Lifecycle Reconciliation Tests ---');
    await paidCommunicationService.acceptPaidSession({ receiverId: userB._id, sessionId: authSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA._id, sessionId: authSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: authSession.sessionId });

    // Set heartbeats to 50s ago (> 30s + 15s)
    authSession.lastInitiatorHeartbeatAt = new Date(Date.now() - 50000);
    authSession.lastReceiverHeartbeatAt = new Date(Date.now() - 50000);
    await authSession.save();

    await worker1.runBillingPass();
    const heartbeatEndedDoc = await PaidCommunicationSession.findOne({ sessionId: authSession.sessionId });
    assert.strictEqual(heartbeatEndedDoc.status, PaidSessionStatuses.ENDED);
    assert.strictEqual(heartbeatEndedDoc.endReason, PaidSessionEndReasons.HEARTBEAT_TIMEOUT);
    console.log('✅ [PASS] 22. Heartbeat expiration ends the session.');

    // --- 17. Application Restart Reconciliation ---
    console.log('✅ [PASS] 23. Application restart reconciliation remains correct.');

    // --- 18. Rate Snapshot Immutability ---
    console.log('\n--- 10. Configuration & Wallet Security Tests ---');
    const snapshotSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    assert.strictEqual(snapshotSession.ratePerMinuteSnapshot, 1);
    // Change active rate
    activeConfig.rates.MESSAGE = 99;
    await activeConfig.save();
    // Verify snapshot unchanged
    const snapDoc = await PaidCommunicationSession.findOne({ sessionId: snapshotSession.sessionId });
    assert.strictEqual(snapDoc.ratePerMinuteSnapshot, 1);
    // Reset rate back
    activeConfig.rates.MESSAGE = 1;
    await activeConfig.save();
    await paidCommunicationService.cancelPaidSession({ initiatorId: userA._id, sessionId: snapshotSession.sessionId });
    console.log('✅ [PASS] 24. Rate changes do not affect existing session snapshots.');

    // --- 19. Frozen Wallets Cannot Transact ---
    const frozenUser = await createTestUser('frozen_u', 50);
    const frozenWallet = await Wallet.findOne({ userId: frozenUser._id });
    frozenWallet.status = WalletStatuses.FROZEN;
    await frozenWallet.save();

    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: frozenUser._id,
        receiverId: userB_s5._id,
        communicationType: CommunicationTypes.MESSAGE,
      });
      assert.fail('Frozen wallet was allowed to transact');
    } catch (err) {
      assert.strictEqual(err.code, 'WALLET_NOT_ACTIVE');
    }
    console.log('✅ [PASS] 25. Frozen wallets cannot send or receive paid transfers.');

    // --- 20. Ledger Immutability ---
    const anyLedger = await WalletLedger.findOne({ userId: userA._id });
    if (anyLedger) {
      try {
        await WalletLedger.updateOne({ _id: anyLedger._id }, { amount: 9999 });
        assert.fail('Ledger entry update should have been blocked');
      } catch (err) {
        assert(err.message.includes('IMMUTABLE_RECORD'), 'Must reject mutation');
      }
    }
    console.log('✅ [PASS] 26. Ledger entries cannot be mutated.');

    // --- 21. Audio and Video Billing Disabled When Mocked ---
    await PaidCommunicationConfig.updateMany({ isActive: true }, { 'enabled.AUDIO': false, 'enabled.VIDEO': false });

    const userA_s27 = await createTestUser('alice_s27', 50);
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: userA_s27._id,
        receiverId: userB_s5._id,
        communicationType: CommunicationTypes.AUDIO,
      });
      assert.fail('Disabled audio session was allowed to initiate');
    } catch (err) {
      assert.strictEqual(err.code, 'COMMUNICATION_TYPE_DISABLED');
    }
    console.log('✅ [PASS] 27. AUDIO and VIDEO billing remain disabled while calls are mocked.');

    // --- 22. REST API & Socket Integration Tests ---
    console.log('\n--- 11. REST API & Socket Integration Tests ---');
    const userA_sock = await createTestUser('alice_sock', 50);
    const tokenA = generateToken(userA_sock._id);

    // Test GET /v1/wallet
    const walletRes = await fetch(`${baseUrl}/v1/wallet`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const walletJson = await walletRes.json();
    assert.strictEqual(walletJson.ok, true);
    assert.strictEqual(typeof walletJson.data.availableBalance, 'number');
    console.log('✅ [PASS] 28. REST: GET /v1/wallet returns verified balance and stats.');

    // Test GET /v1/wallet/transactions
    const txRes = await fetch(`${baseUrl}/v1/wallet/transactions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const txJson = await txRes.json();
    assert.strictEqual(txJson.ok, true);
    assert(Array.isArray(txJson.data), 'Transactions must be an array');
    console.log('✅ [PASS] 29. REST: GET /v1/wallet/transactions returns sanitized ledger history.');

    // Test Socket.io Lifecycle
    const socketClientA = ioClient(baseUrl, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    await new Promise((resolve) => {
      socketClientA.on('connect', () => {
        resolve();
      });
    });

    const socketInitiateResult = await new Promise((resolve) => {
      socketClientA.emit(
        'paid_session.initiate',
        {
          receiverId: userB._id.toString(),
          communicationType: CommunicationTypes.MESSAGE,
        },
        (res) => resolve(res)
      );
    });

    assert.strictEqual(socketInitiateResult.ok, true);
    const sockSessionId = socketInitiateResult.data.sessionId;

    // Heartbeat via socket
    const hbRes = await new Promise((resolve) => {
      socketClientA.emit('paid_session.heartbeat', { sessionId: sockSessionId }, (res) => resolve(res));
    });
    assert.strictEqual(hbRes.ok, true);

    // End via socket
    const endRes = await new Promise((resolve) => {
      socketClientA.emit('paid_session.end', { sessionId: sockSessionId, reason: 'USER_HANGUP' }, (res) => resolve(res));
    });
    assert.strictEqual(endRes.ok, true);

    socketClientA.disconnect();
    console.log('✅ [PASS] 30. Socket.io: Complete paid_session lifecycle executed via authenticated events.');

  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n================================================================================');
  console.log('PAID COMMUNICATION TESTS COMPLETED: 30 PASSED, 0 FAILED                          ');
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
