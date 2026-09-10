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
const Message = require('../models/Message');
const AdminAuditLog = require('../models/AdminAuditLog');
const {
  CommunicationTypes,
  PaidSessionStatuses,
  WalletStatuses,
  LedgerEntryTypes,
  LedgerTransactionTypes,
  PaidSessionEndReasons,
  MemberRoles,
  MemberStates,
} = require('../models/enums');

// Services & Handlers
const walletService = require('../services/walletService');
const paidCommunicationService = require('../services/paidCommunicationService');
const reconciliationService = require('../services/reconciliationService');
const { PaidBillingWorker } = require('../services/paidBillingWorker');
const { registerCallingHandlers } = require('../socket/callingSocketHandler');
const { registerPaidCommunicationHandlers } = require('../socket/paidCommunicationSocketHandler');
const paidCommunicationRoutes = require('../routes/paidCommunicationRoutes');
const walletRoutes = require('../routes/walletRoutes');
const adminRoutes = require('../routes/adminRoutes');

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
  app.use('/v1/admin/paid-communication', adminRoutes);

  server = http.createServer(app);
  ioServer = socketio(server, { cors: { origin: '*' } });

  const userSocketMap = new Map();
  ioServer.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || socket.handshake.auth.userId;
    if (userId) {
      socket.data = { userId };
      socket.join(`user:${userId}`);
      userSocketMap.set(userId, socket.id);
    }
    registerCallingHandlers(ioServer, socket, userSocketMap);
    registerPaidCommunicationHandlers(ioServer, socket);
  });

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test_secret', { expiresIn: '1h' });
}

let passedCount = 0;
let failedCount = 0;

function report(testName, passed, error = null) {
  if (passed) {
    passedCount++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedCount++;
    console.error(`  ❌ [FAIL] ${testName}`);
    if (error) console.error('     Error:', error.message || error);
  }
}

async function runPC04Tests() {
  console.log('================================================================================');
  console.log('       PC-04 FINAL END-TO-END ACCEPTANCE, LEGACY CLEANUP & CERTIFICATION        ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  // Ensure active config enables MESSAGE, AUDIO, VIDEO for E2E testing
  const activeConfig = await PaidCommunicationConfig.getActiveConfig();
  activeConfig.enabled = { MESSAGE: true, AUDIO: true, VIDEO: true, BACKGROUND_CALLS: true, BILLING_WORKER: true, RECEIVER_EARNING: true };
  await activeConfig.save();

  const testSuffix = `pc04_${Date.now()}`;
  const userA = await User.create({
    email: `userA_${testSuffix}@example.com`,
    password: 'Password123!',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    accountStatus: 'ACTIVE',
  });
  const userB = await User.create({
    email: `userB_${testSuffix}@example.com`,
    password: 'Password123!',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    accountStatus: 'ACTIVE',
  });
  const adminUser = await User.create({
    email: `admin_${testSuffix}@example.com`,
    password: 'Password123!',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    accountStatus: 'ACTIVE',
  });

  const { ConversationTypes } = require('../models/enums');
  // Create active conversation between User A and User B
  const conversation = await Conversation.create({
    type: ConversationTypes.DIRECT_MATCH,
    createdBy: userA._id,
  });
  await ConversationMember.create([
    { conversation: conversation._id, user: userA._id, role: MemberRoles.MEMBER, state: MemberStates.ACTIVE },
    { conversation: conversation._id, user: userB._id, role: MemberRoles.MEMBER, state: MemberStates.ACTIVE },
  ]);

  // Fund User A wallet via audited admin adjustment flow
  const adminToken = generateToken(adminUser._id);
  const fundRes = await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${userA._id}/adjust-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ amount: 100, reason: 'Test wallet funding for PC-04 acceptance' }),
  });
  const fundData = await fundRes.json();
  assert.strictEqual(fundData.ok, true, 'Wallet funding succeeded');
  assert.strictEqual(fundData.data.balanceAfter, 100, 'User A wallet balance initialized to 100 coins');

  console.log('[JOURNEY 1: TWO-USER PAID MESSAGING ACCEPTANCE (1 COIN/MIN)]');

  let messagingSession;
  // 1.1 Initiate Paid Messaging Session
  try {
    messagingSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      conversationId: conversation._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    assert.strictEqual(messagingSession.status, PaidSessionStatuses.PENDING);
    assert.strictEqual(messagingSession.ratePerMinuteSnapshot, 1);
    assert.strictEqual(messagingSession.billedMinutes, 0);

    // Verify 0 coins charged before acceptance
    const walletBeforeAccept = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletBeforeAccept.availableBalance, 100, 'Zero charge before acceptance');
    report('1.1 Paid messaging request initiated (1 coin/min) with zero charge while pending', true);
  } catch (err) {
    report('1.1 Paid messaging request initiated (1 coin/min) with zero charge while pending', false, err);
  }

  // 1.2 Receiver Accepts & Dual Connection -> Minute 1 Charged
  try {
    await paidCommunicationService.acceptPaidSession({
      receiverId: userB._id,
      sessionId: messagingSession.sessionId,
    });

    // Both acknowledge connection
    await paidCommunicationService.markParticipantConnected({ userId: userA._id, sessionId: messagingSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: messagingSession.sessionId });

    const activeSession = await PaidCommunicationSession.findOne({ sessionId: messagingSession.sessionId });
    assert.strictEqual(activeSession.status, PaidSessionStatuses.ACTIVE);
    assert.strictEqual(activeSession.billedMinutes, 1, 'Minute 1 billed upon genuine connection');
    assert.strictEqual(activeSession.totalCoinsCharged, 1);
    assert.strictEqual(activeSession.totalCoinsEarned, 1);

    const walletA = await Wallet.findOne({ userId: userA._id });
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletA.availableBalance, 99, 'Initiator debited 1 coin');
    assert.strictEqual(walletB.availableBalance, 1, 'Receiver credited 1 coin');
    report('1.2 Paid messaging activated upon connection: Initiator pays 1, Receiver earns 1', true);
  } catch (err) {
    report('1.2 Paid messaging activated upon connection: Initiator pays 1, Receiver earns 1', false, err);
  }

  // 1.3 Advance Beyond 60s -> Minute 2 Charged via Billing Worker
  try {
    const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: messagingSession.sessionId });
    sessionDoc.nextChargeAt = new Date(Date.now() - 1000); // Trigger due charge
    await sessionDoc.save();

    const worker = new PaidBillingWorker({ workerId: 'test-worker-p4' });
    await worker.runBillingPass();

    const updatedSession = await PaidCommunicationSession.findOne({ sessionId: messagingSession.sessionId });
    assert.strictEqual(updatedSession.billedMinutes, 2, 'Minute 2 billed at 60s boundary');
    assert.strictEqual(updatedSession.totalCoinsCharged, 2);

    const walletA = await Wallet.findOne({ userId: userA._id });
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletA.availableBalance, 98, 'Initiator debited total 2 coins');
    assert.strictEqual(walletB.availableBalance, 2, 'Receiver credited total 2 coins');
    report('1.3 Minute 2 boundary billed automatically by worker: User A = 98, User B = 2', true);
  } catch (err) {
    report('1.3 Minute 2 boundary billed automatically by worker: User A = 98, User B = 2', false, err);
  }

  // 1.4 End Paid Messaging & Verify Normal Message Persistence
  try {
    await paidCommunicationService.endPaidSession({
      actorUserId: userA._id,
      sessionId: messagingSession.sessionId,
      endReason: PaidSessionEndReasons.USER_HANGUP,
    });

    const endedSession = await PaidCommunicationSession.findOne({ sessionId: messagingSession.sessionId });
    assert.strictEqual(endedSession.status, PaidSessionStatuses.ENDED);

    // Verify messages persist and synchronize
    const msg = await Message.create({
      conversationId: conversation._id,
      senderId: userA._id,
      type: 'TEXT',
      text: 'Hello, this is a real paid chat message!',
    });
    assert(msg._id, 'Chat message persisted during session lifecycle');
    report('1.4 Paid messaging session ended cleanly; standard messages persist and sync', true);
  } catch (err) {
    report('1.4 Paid messaging session ended cleanly; standard messages persist and sync', false, err);
  }

  console.log('\n[JOURNEY 2: TWO-USER AUDIO CALL ACCEPTANCE (5 COINS/MIN)]');

  let audioSession;
  // 2.1 Initiate Audio Call & Verify Ringing Zero-Cost
  try {
    audioSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      conversationId: conversation._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    assert.strictEqual(audioSession.ratePerMinuteSnapshot, 5);

    const walletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletA.availableBalance, 98, 'Zero coins charged while ringing');
    report('2.1 Audio call initiated at 5 coins/min with zero charge while ringing', true);
  } catch (err) {
    report('2.1 Audio call initiated at 5 coins/min with zero charge while ringing', false, err);
  }

  // 2.2 Audio Call Acceptance & Media Connection -> Minute 1 Charged (5 coins)
  try {
    await paidCommunicationService.acceptPaidSession({ receiverId: userB._id, sessionId: audioSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA._id, sessionId: audioSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: audioSession.sessionId });

    const activeAudio = await PaidCommunicationSession.findOne({ sessionId: audioSession.sessionId });
    assert.strictEqual(activeAudio.status, PaidSessionStatuses.ACTIVE);
    assert.strictEqual(activeAudio.billedMinutes, 1);
    assert.strictEqual(activeAudio.totalCoinsCharged, 5);

    const walletA = await Wallet.findOne({ userId: userA._id });
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletA.availableBalance, 93, 'User A debited 5 coins');
    assert.strictEqual(walletB.availableBalance, 7, 'User B credited 5 coins (2 + 5 = 7)');
    report('2.2 Audio call connected: Initiator pays 5, Receiver earns 5', true);
  } catch (err) {
    report('2.2 Audio call connected: Initiator pays 5, Receiver earns 5', false, err);
  }

  // 2.3 Audio Call Minute 2 & Call Termination
  try {
    const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: audioSession.sessionId });
    sessionDoc.nextChargeAt = new Date(Date.now() - 1000);
    await sessionDoc.save();

    const worker = new PaidBillingWorker({ workerId: 'test-worker-audio' });
    await worker.runBillingPass();

    await paidCommunicationService.endPaidSession({
      actorUserId: userB._id,
      sessionId: audioSession.sessionId,
      endReason: PaidSessionEndReasons.USER_HANGUP,
    });

    const walletA = await Wallet.findOne({ userId: userA._id });
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletA.availableBalance, 88, 'User A debited 10 total coins for 2 audio minutes (98 - 10 = 88)');
    assert.strictEqual(walletB.availableBalance, 12, 'User B credited 10 total coins for 2 audio minutes (2 + 10 = 12)');
    report('2.3 Audio call completed 2 minutes: User A = 88, User B = 12', true);
  } catch (err) {
    report('2.3 Audio call completed 2 minutes: User A = 88, User B = 12', false, err);
  }

  console.log('\n[JOURNEY 3: TWO-USER VIDEO CALL ACCEPTANCE (10 COINS/MIN)]');

  let videoSession;
  // 3.1 Initiate Video Call & Verify Ringing Zero-Cost
  try {
    videoSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      conversationId: conversation._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    assert.strictEqual(videoSession.ratePerMinuteSnapshot, 10);

    const walletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletA.availableBalance, 88, 'Zero coins charged while ringing');
    report('3.1 Video call initiated at 10 coins/min with zero charge while ringing', true);
  } catch (err) {
    report('3.1 Video call initiated at 10 coins/min with zero charge while ringing', false, err);
  }

  // 3.2 Video Call Acceptance & Connection -> Minute 1 Charged (10 coins)
  try {
    await paidCommunicationService.acceptPaidSession({ receiverId: userB._id, sessionId: videoSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userA._id, sessionId: videoSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: userB._id, sessionId: videoSession.sessionId });

    const activeVideo = await PaidCommunicationSession.findOne({ sessionId: videoSession.sessionId });
    assert.strictEqual(activeVideo.status, PaidSessionStatuses.ACTIVE);
    assert.strictEqual(activeVideo.billedMinutes, 1);
    assert.strictEqual(activeVideo.totalCoinsCharged, 10);

    const walletA = await Wallet.findOne({ userId: userA._id });
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletA.availableBalance, 78, 'User A debited 10 coins (88 - 10 = 78)');
    assert.strictEqual(walletB.availableBalance, 22, 'User B credited 10 coins (12 + 10 = 22)');
    report('3.2 Video call connected: Initiator pays 10, Receiver earns 10', true);
  } catch (err) {
    report('3.2 Video call connected: Initiator pays 10, Receiver earns 10', false, err);
  }

  // 3.3 Video Call Minute 2 & Hangup
  try {
    const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: videoSession.sessionId });
    sessionDoc.nextChargeAt = new Date(Date.now() - 1000);
    await sessionDoc.save();

    const worker = new PaidBillingWorker({ workerId: 'test-worker-video' });
    await worker.runBillingPass();

    await paidCommunicationService.endPaidSession({
      actorUserId: userA._id,
      sessionId: videoSession.sessionId,
      endReason: PaidSessionEndReasons.USER_HANGUP,
    });

    const walletA = await Wallet.findOne({ userId: userA._id });
    const walletB = await Wallet.findOne({ userId: userB._id });
    assert.strictEqual(walletA.availableBalance, 68, 'User A debited 20 total coins for 2 video minutes (88 - 20 = 68)');
    assert.strictEqual(walletB.availableBalance, 32, 'User B credited 20 total coins for 2 video minutes (12 + 20 = 32)');
    report('3.3 Video call completed 2 minutes: User A = 68, User B = 32', true);
  } catch (err) {
    report('3.3 Video call completed 2 minutes: User A = 68, User B = 32', false, err);
  }

  console.log('\n[SECTION 4: BOUNDARY AND FAILURE ACCEPTANCE]');

  // 4.1 Declined Request Costs Exactly 0 Coins
  try {
    const declinedSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.declinePaidSession({
      receiverId: userB._id,
      sessionId: declinedSession.sessionId,
    });

    const postDeclineSession = await PaidCommunicationSession.findOne({ sessionId: declinedSession.sessionId });
    assert.strictEqual(postDeclineSession.status, PaidSessionStatuses.DECLINED);
    assert.strictEqual(postDeclineSession.totalCoinsCharged, 0);

    const walletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletA.availableBalance, 68, 'Declined call deducted zero coins');
    report('4.1 Declined call costs exactly zero coins', true);
  } catch (err) {
    report('4.1 Declined call costs exactly zero coins', false, err);
  }

  // 4.2 Cancelled Request Costs Exactly 0 Coins
  try {
    const cancelledSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    await paidCommunicationService.cancelPaidSession({
      initiatorId: userA._id,
      sessionId: cancelledSession.sessionId,
    });

    const postCancelSession = await PaidCommunicationSession.findOne({ sessionId: cancelledSession.sessionId });
    assert.strictEqual(postCancelSession.status, PaidSessionStatuses.CANCELLED);
    assert.strictEqual(postCancelSession.totalCoinsCharged, 0);

    const walletA = await Wallet.findOne({ userId: userA._id });
    assert.strictEqual(walletA.availableBalance, 68, 'Cancelled call deducted zero coins');
    report('4.2 Cancelled request costs exactly zero coins', true);
  } catch (err) {
    report('4.2 Cancelled request costs exactly zero coins', false, err);
  }

  // 4.3 Insufficient Initial Balance Cannot Activate Session
  try {
    const brokeUser = await User.create({
      email: `broke_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const brokeWallet = await walletService.getOrCreateWallet(brokeUser._id);
    brokeWallet.availableBalance = 0;
    await brokeWallet.save();

    let initFailed = false;
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: brokeUser._id,
        receiverId: userB._id,
        communicationType: CommunicationTypes.AUDIO, // Requires 5 coins
      });
    } catch (e) {
      initFailed = true;
      assert.strictEqual(e.code, 'INSUFFICIENT_BALANCE');
    }
    assert.strictEqual(initFailed, true, 'Initiation rejected for insufficient balance');
    report('4.3 Insufficient initial balance prevents session initiation', true);
  } catch (err) {
    report('4.3 Insufficient initial balance prevents session initiation', false, err);
  }

  // 4.4 Frozen Wallet Rejection
  try {
    const frozenUser = await User.create({
      email: `frozen_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const frozenWallet = await walletService.getOrCreateWallet(frozenUser._id);
    frozenWallet.status = WalletStatuses.FROZEN;
    await frozenWallet.save();

    let frozenRejected = false;
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: frozenUser._id,
        receiverId: userB._id,
        communicationType: CommunicationTypes.MESSAGE,
      });
    } catch (e) {
      frozenRejected = true;
      assert.strictEqual(e.code, 'WALLET_NOT_ACTIVE');
    }
    assert.strictEqual(frozenRejected, true, 'Initiation rejected for frozen wallet');
    report('4.4 Frozen wallet is prohibited from starting paid sessions', true);
  } catch (err) {
    report('4.4 Frozen wallet is prohibited from starting paid sessions', false, err);
  }

  console.log('\n[SECTION 5: SECURITY AND AUTHORIZATION ACCEPTANCE]');

  // 5.1 Blocked User Cannot Be Called
  try {
    await Block.create({ blocker: userB._id, blocked: userA._id });

    let blockRejected = false;
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: userA._id,
        receiverId: userB._id,
        communicationType: CommunicationTypes.MESSAGE,
      });
    } catch (e) {
      blockRejected = true;
      assert.strictEqual(e.code, 'COMMUNICATION_BLOCKED');
    }
    assert.strictEqual(blockRejected, true, 'Blocked communication rejected');
    report('5.1 Safety restrictions prevent calling or messaging blocked users', true);

    await Block.deleteOne({ blocker: userB._id, blocked: userA._id });
  } catch (err) {
    report('5.1 Safety restrictions prevent calling or messaging blocked users', false, err);
  }

  // 5.2 Cross-User Session Access Forbidden
  try {
    const unauthorizedUser = await User.create({
      email: `intruder_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });

    let accessRejected = false;
    try {
      await paidCommunicationService.getPaidSession(messagingSession.sessionId, unauthorizedUser._id);
    } catch (e) {
      accessRejected = true;
      assert.strictEqual(e.code, 'UNAUTHORIZED_ACTION');
    }
    assert.strictEqual(accessRejected, true, 'Third party denied access to private paid session');
    report('5.2 Cross-user session inspection strictly forbidden', true);
  } catch (err) {
    report('5.2 Cross-user session inspection strictly forbidden', false, err);
  }

  console.log('\n[SECTION 6: FINAL FINANCIAL RECONCILIATION AUDIT]');

  // 6.1 Run Reconciliation Across Acceptance Data
  try {
    const testUserIds = [userA._id, userB._id];
    const reconReport = await reconciliationService.runFullReconciliation({ userIds: testUserIds });
    if (!reconReport.isHealthy) {
      console.error('Reconciliation issues found:', JSON.stringify(reconReport.allIssues, null, 2));
    }
    assert.strictEqual(reconReport.isHealthy, true, 'Reconciliation report must be 100% HEALTHY');
    assert.strictEqual(reconReport.summary.totalIssues, 0, 'Zero financial anomalies across test sessions');
    report('6.1 Final financial reconciliation audit: 100% HEALTHY (0 anomalies)', true);
  } catch (err) {
    report('6.1 Final financial reconciliation audit: 100% HEALTHY (0 anomalies)', false, err);
  }

  console.log('\n================================================================================');
  console.log(`PC-04 SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================================\n');

  if (server) server.close();
  if (mongoose.connection) await mongoose.connection.close();

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPC04Tests().catch((err) => {
    console.error('Fatal PC-04 test error:', err);
    process.exit(1);
  });
}

module.exports = runPC04Tests;
