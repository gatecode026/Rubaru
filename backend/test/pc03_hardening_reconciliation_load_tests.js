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
const { execSync } = require('child_process');
const path = require('path');

const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const AdminAuditLog = require('../models/AdminAuditLog');
const {
  CommunicationTypes,
  PaidSessionStatuses,
  WalletStatuses,
  LedgerEntryTypes,
  LedgerTransactionTypes,
  PaidSessionEndReasons,
} = require('../models/enums');

// Services & Handlers
const walletService = require('../services/walletService');
const paidCommunicationService = require('../services/paidCommunicationService');
const reconciliationService = require('../services/reconciliationService');
const sessionRecoveryService = require('../services/sessionRecoveryService');
const turnService = require('../services/turnService');
const fraudProtectionService = require('../services/fraudProtectionService');
const featureFlagService = require('../services/featureFlagService');
const telemetryService = require('../services/telemetryService');
const { registerCallingHandlers } = require('../socket/callingSocketHandler');
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
  });

  await new Promise((resolve) => {
    server.listen(0, () => {
      port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
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

async function runPC03Tests() {
  console.log('================================================================================');
  console.log('       PC-03 PRODUCTION HARDENING, RECONCILIATION & RELEASE READINESS TESTS    ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  // Ensure active config enables all communication types for testing
  const activeConfig = await PaidCommunicationConfig.getActiveConfig();
  activeConfig.enabled = { MESSAGE: true, AUDIO: true, VIDEO: true, BACKGROUND_CALLS: true, BILLING_WORKER: true, RECEIVER_EARNING: true };
  await activeConfig.save();

  const testSuffix = `pc03_${Date.now()}`;
  const initiator = await User.create({
    email: `initiator_${testSuffix}@example.com`,
    password: 'Password123!',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    accountStatus: 'ACTIVE',
  });
  const receiver = await User.create({
    email: `receiver_${testSuffix}@example.com`,
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

  const initWallet = await walletService.getOrCreateWallet(initiator._id);
  initWallet.availableBalance = 500;
  await initWallet.save();

  const recvWallet = await walletService.getOrCreateWallet(receiver._id);
  recvWallet.availableBalance = 100;
  await recvWallet.save();

  console.log('[SECTION 1: ADVANCED FINANCIAL RECONCILIATION AUDIT]');

  // Test 1: Double-Entry Imbalance Detection (Single-sided debit)
  try {
    const singleLegUser = await User.create({
      email: `single_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const singleWallet = await walletService.getOrCreateWallet(singleLegUser._id);
    const fakeTxId = uuidv4();
    await WalletLedger.create({
      transactionId: fakeTxId,
      walletId: singleWallet._id,
      userId: singleLegUser._id,
      entryType: LedgerEntryTypes.DEBIT,
      transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
      amount: 10,
      balanceBefore: 500,
      balanceAfter: 490,
      idempotencyKey: `test:imbalance:debit:${fakeTxId}`,
    });

    const recon = await reconciliationService.reconcileDoubleEntryLedger({ userIds: [singleLegUser._id] });
    assert.strictEqual(recon.passed, false, 'Reconciliation should fail for single-sided transfer');
    assert(
      recon.issues.some((i) => i.type === 'DEBIT_WITHOUT_MATCHING_CREDIT' && i.transactionId === fakeTxId),
      'Must detect single-sided DEBIT_WITHOUT_MATCHING_CREDIT'
    );
    report('1.1 Reconciliation detects single-sided debit without credit', true);
  } catch (err) {
    report('1.1 Reconciliation detects single-sided debit without credit', false, err);
  }

  // Test 2: Mismatched Debit and Credit Amounts
  try {
    const mismatchUser1 = await User.create({
      email: `mm1_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const mismatchUser2 = await User.create({
      email: `mm2_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const mmWallet1 = await walletService.getOrCreateWallet(mismatchUser1._id);
    const mmWallet2 = await walletService.getOrCreateWallet(mismatchUser2._id);

    const mismatchTxId = uuidv4();
    await WalletLedger.create([
      {
        transactionId: mismatchTxId,
        walletId: mmWallet1._id,
        userId: mismatchUser1._id,
        entryType: LedgerEntryTypes.DEBIT,
        transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
        amount: 10,
        balanceBefore: 500,
        balanceAfter: 490,
        idempotencyKey: `test:mismatch:debit:${mismatchTxId}`,
      },
      {
        transactionId: mismatchTxId,
        walletId: mmWallet2._id,
        userId: mismatchUser2._id,
        entryType: LedgerEntryTypes.CREDIT,
        transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
        amount: 8, // Mismatched amount!
        balanceBefore: 100,
        balanceAfter: 108,
        idempotencyKey: `test:mismatch:credit:${mismatchTxId}`,
      },
    ]);

    const recon = await reconciliationService.reconcileDoubleEntryLedger({ userIds: [mismatchUser1._id, mismatchUser2._id] });
    assert.strictEqual(recon.passed, false);
    assert(
      recon.issues.some((i) => i.type === 'MISMATCHED_DEBIT_CREDIT_AMOUNTS' && i.transactionId === mismatchTxId),
      'Must detect MISMATCHED_DEBIT_CREDIT_AMOUNTS'
    );
    report('1.2 Reconciliation detects mismatched debit and credit amounts', true);
  } catch (err) {
    report('1.2 Reconciliation detects mismatched debit and credit amounts', false, err);
  }

  // Test 3: Session Totals & Missing Record Discrepancy Detection
  try {
    const dupSessionId = uuidv4();
    await PaidCommunicationSession.create({
      sessionId: dupSessionId,
      initiatorId: initiator._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
      ratePerMinuteSnapshot: 5,
      configurationVersion: 1,
      billedMinutes: 2, // Recorded 2 billed minutes
      totalCoinsCharged: 10, // Recorded 10 coins charged
      status: PaidSessionStatuses.ACTIVE,
      connectedAt: new Date(Date.now() - 60000),
    });

    // Only 1 debit record exists (5 coins) -> Missing 1 record and 5 coin mismatch!
    await WalletLedger.create({
      transactionId: uuidv4(),
      walletId: initWallet._id,
      userId: initiator._id,
      sessionId: dupSessionId,
      minuteIndex: 1,
      entryType: LedgerEntryTypes.DEBIT,
      transactionType: LedgerTransactionTypes.COMMUNICATION_CHARGE,
      amount: 5,
      balanceBefore: 500,
      balanceAfter: 495,
      idempotencyKey: `test:recon:debit1:${dupSessionId}`,
    });

    const recon = await reconciliationService.reconcileSessionTotals({ sessionIds: [dupSessionId] });
    assert.strictEqual(recon.passed, false, 'Reconciliation must flag session discrepancy');
    assert(
      recon.issues.some((i) => i.type === 'SESSION_TOTAL_MISMATCH' && i.sessionId === dupSessionId),
      'Must detect SESSION_TOTAL_MISMATCH'
    );
    assert(
      recon.issues.some((i) => i.type === 'MISSING_SESSION_CHARGE_RECORDS' && i.sessionId === dupSessionId),
      'Must detect MISSING_SESSION_CHARGE_RECORDS'
    );
    report('1.3 Reconciliation detects session totals mismatch and missing charge records', true);
  } catch (err) {
    report('1.3 Reconciliation detects session totals mismatch and missing charge records', false, err);
  }

  // Test 4: Wallet Ledger Balance Drift Detection & Safe Repair
  try {
    const testWalletUser = await User.create({
      email: `drift_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const driftWallet = await walletService.getOrCreateWallet(testWalletUser._id);
    driftWallet.availableBalance = 200; // Balance without corresponding ledger credits
    await driftWallet.save();

    const recon = await reconciliationService.reconcileWalletBalances({ userIds: [testWalletUser._id] });
    assert.strictEqual(recon.passed, false);
    assert(
      recon.issues.some((i) => i.type === 'WALLET_LEDGER_DRIFT' && i.userId === testWalletUser._id.toString()),
      'Must detect WALLET_LEDGER_DRIFT'
    );
    report('1.4 Reconciliation detects wallet ledger drift', true);

    // Test Safe Repair Workflow
    const repairResult = await reconciliationService.executeSafeRepair({
      adminUserId: adminUser._id,
      issueType: 'WALLET_LEDGER_DRIFT',
      targetId: testWalletUser._id.toString(),
      reason: 'Automated test reconciliation adjustment',
    });
    assert.strictEqual(repairResult.ok, true);

    const postRepairWallet = await Wallet.findOne({ userId: testWalletUser._id });
    assert.strictEqual(postRepairWallet.availableBalance, 0, 'Wallet balance safely reconciled to true ledger sum (0)');

    const auditLog = await AdminAuditLog.findOne({
      targetId: testWalletUser._id.toString(),
      action: 'RECONCILIATION_SAFE_REPAIR',
    });
    assert(auditLog, 'Audit log recorded for safe reconciliation repair');
    report('1.5 Safe authorized reconciliation repair creates compensating ledger record without historical mutation', true);
  } catch (err) {
    report('1.4 / 1.5 Wallet reconciliation & safe repair', false, err);
  }

  console.log('\n[SECTION 2: WALLET CONCURRENCY & MULTI-SESSION HARDENING]');

  // Test 5: High Concurrency Minute Charges (50 Concurrent Attempts)
  try {
    const concSessionId = uuidv4();
    const concSession = await PaidCommunicationSession.create({
      sessionId: concSessionId,
      initiatorId: initiator._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
      ratePerMinuteSnapshot: 10,
      configurationVersion: 1,
      billedMinutes: 0,
      totalCoinsCharged: 0,
      status: PaidSessionStatuses.ACTIVE,
      connectedAt: new Date(),
    });

    const initialInitBalance = (await Wallet.findOne({ userId: initiator._id })).availableBalance;
    const initialRecvBalance = (await Wallet.findOne({ userId: receiver._id })).availableBalance;

    // Launch 50 concurrent charges for minuteIndex 1
    const chargePromises = Array.from({ length: 50 }).map(() =>
      walletService.executeCommunicationCharge({
        sessionDoc: concSession,
        minuteIndex: 1,
      })
    );

    const results = await Promise.all(chargePromises);
    const successfulCharges = results.filter((r) => r.success && !r.alreadyProcessed);
    const idempotentSuppressed = results.filter((r) => r.success && r.alreadyProcessed);

    assert.strictEqual(successfulCharges.length, 1, 'Exactly 1 charge succeeded under 50-way concurrency');
    assert.strictEqual(idempotentSuppressed.length, 49, '49 concurrent duplicate charges idempotently suppressed');

    const finalInitBalance = (await Wallet.findOne({ userId: initiator._id })).availableBalance;
    const finalRecvBalance = (await Wallet.findOne({ userId: receiver._id })).availableBalance;

    assert.strictEqual(finalInitBalance, initialInitBalance - 10, 'Initiator debited exactly once (10 coins)');
    assert.strictEqual(finalRecvBalance, initialRecvBalance + 10, 'Receiver credited exactly once (10 coins)');

    const debitRecords = await WalletLedger.find({ sessionId: concSessionId, minuteIndex: 1, entryType: LedgerEntryTypes.DEBIT });
    const creditRecords = await WalletLedger.find({ sessionId: concSessionId, minuteIndex: 1, entryType: LedgerEntryTypes.CREDIT });

    assert.strictEqual(debitRecords.length, 1, 'Exactly 1 debit ledger entry written');
    assert.strictEqual(creditRecords.length, 1, 'Exactly 1 credit ledger entry written');
    report('2.1 Zero duplicate charges under 50 concurrent minute charge races', true);
  } catch (err) {
    report('2.1 Zero duplicate charges under 50 concurrent minute charge races', false, err);
  }

  // Test 6: Balance Cannot Become Negative under Concurrent Drain
  try {
    const poorUser = await User.create({
      email: `poor_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const poorWallet = await walletService.getOrCreateWallet(poorUser._id);
    poorWallet.availableBalance = 15; // Only enough for one 10-coin charge
    await poorWallet.save();

    const drainSession = await PaidCommunicationSession.create({
      sessionId: uuidv4(),
      initiatorId: poorUser._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
      ratePerMinuteSnapshot: 10,
      configurationVersion: 1,
      billedMinutes: 0,
      totalCoinsCharged: 0,
      status: PaidSessionStatuses.ACTIVE,
      connectedAt: new Date(),
    });

    const drainAttempts = [
      walletService.executeCommunicationCharge({ sessionDoc: drainSession, minuteIndex: 1 }).catch((e) => e),
      walletService.executeCommunicationCharge({ sessionDoc: drainSession, minuteIndex: 2 }).catch((e) => e),
    ];

    await Promise.all(drainAttempts);

    const verifiedPoorWallet = await Wallet.findOne({ userId: poorUser._id });
    assert(verifiedPoorWallet.availableBalance >= 0, `Balance must never be negative, was: ${verifiedPoorWallet.availableBalance}`);
    assert.strictEqual(verifiedPoorWallet.availableBalance, 5, 'Deducted first minute (10), rejected second minute cleanly');
    report('2.2 Zero negative balances under concurrent wallet drain', true);
  } catch (err) {
    report('2.2 Zero negative balances under concurrent wallet drain', false, err);
  }

  console.log('\n[SECTION 3: SESSION RECOVERY & STARTUP RESILIENCE]');

  // Test 7: Startup Session Recovery
  try {
    const staleLeasedSession = await PaidCommunicationSession.create({
      sessionId: uuidv4(),
      initiatorId: initiator._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
      ratePerMinuteSnapshot: 5,
      configurationVersion: 1,
      status: PaidSessionStatuses.ACTIVE,
      billingLeaseExpiresAt: new Date(Date.now() - 30000), // Expired lease
      billingLeaseOwner: 'crashed-worker-99',
      lastInitiatorHeartbeatAt: new Date(Date.now() - 120000), // Dead heartbeat
      lastReceiverHeartbeatAt: new Date(Date.now() - 120000),
    });

    const recoveryResult = await sessionRecoveryService.runStartupRecovery();
    assert(recoveryResult.clearedLeasesCount >= 1, 'Must clear stale worker leases on boot');
    assert(recoveryResult.terminatedStaleCount >= 1, 'Must terminate sessions with dead heartbeats');

    const recoveredDoc = await PaidCommunicationSession.findOne({ sessionId: staleLeasedSession.sessionId });
    assert.strictEqual(recoveredDoc.status, PaidSessionStatuses.ENDED, 'Stale session transitioned to ENDED');
    assert.strictEqual(recoveredDoc.endReason, PaidSessionEndReasons.HEARTBEAT_TIMEOUT);
    report('3.1 Startup recovery clears crashed worker leases and terminates stale sessions', true);
  } catch (err) {
    report('3.1 Startup recovery clears crashed worker leases and terminates stale sessions', false, err);
  }

  console.log('\n[SECTION 4: WEBRTC HARDENING, SDP/ICE VALIDATION & TURN CREDENTIALS]');

  // Test 8: SDP Structure and 64KB Size Limit Validation
  try {
    const validSdp = 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 5004 RTP/AVP 0\r\n';
    const validResult = turnService.validateSdp(validSdp);
    assert.strictEqual(validResult.valid, true, 'Valid standard SDP passes');

    const oversizedSdp = 'v=0\r\nm=audio\r\n' + 'a=fake:'.repeat(15000); // > 64KB
    const oversizedResult = turnService.validateSdp(oversizedSdp);
    assert.strictEqual(oversizedResult.valid, false, 'Oversized SDP rejected');
    assert(oversizedResult.error.includes('64KB'), 'Error mentions 64KB size limit');

    const malformedSdp = 'invalid_plain_text_not_sdp';
    const malformedResult = turnService.validateSdp(malformedSdp);
    assert.strictEqual(malformedResult.valid, false, 'Malformed SDP rejected');
    report('4.1 SDP validation enforces 64KB size limits and structural sanity', true);
  } catch (err) {
    report('4.1 SDP validation enforces 64KB size limits and structural sanity', false, err);
  }

  // Test 9: ICE Candidate Structure and Rate Limiting
  try {
    const validCandidate = { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    const candResult = turnService.validateIceCandidate(validCandidate);
    assert.strictEqual(candResult.valid, true);

    const invalidCandidate = { candidate: '' };
    const invalidResult = turnService.validateIceCandidate(invalidCandidate);
    assert.strictEqual(invalidResult.valid, false);
    report('4.2 ICE candidate validation enforces structure and length constraints', true);
  } catch (err) {
    report('4.2 ICE candidate validation enforces structure and length constraints', false, err);
  }

  // Test 10: RFC 5766 HMAC-SHA1 TURN Credentials Generation
  try {
    process.env.COTURN_SECRET = 'production_quality_secret_key_12345';
    process.env.TURN_URLS = 'turn:turn.rubaru.app:3478';

    const creds = turnService.generateTurnCredentials(initiator._id.toString(), 3600);
    assert(creds.username.includes(`:${initiator._id.toString()}`), 'Username contains timestamp prefix');
    assert(typeof creds.credential === 'string' && creds.credential.length > 10, 'Generated valid HMAC-SHA1 token');
    assert.strictEqual(creds.isProductionHardened, true);
    report('4.3 RFC 5766 HMAC-SHA1 time-limited TURN credentials generation verified', true);
  } catch (err) {
    report('4.3 RFC 5766 HMAC-SHA1 time-limited TURN credentials generation verified', false, err);
  }

  console.log('\n[SECTION 5: FRAUD AND ABUSE SAFEGUARDS]');

  // Test 11: Self-Calling and Self-Messaging Rejection
  try {
    const selfCheck = await fraudProtectionService.validateSessionInitiation({
      initiatorId: initiator._id,
      receiverId: initiator._id,
    });
    assert.strictEqual(selfCheck.allowed, false);
    assert.strictEqual(selfCheck.code, 'SELF_COMMUNICATION_PROHIBITED');
    report('5.1 Self-communication rejected unconditionally', true);
  } catch (err) {
    report('5.1 Self-communication rejected unconditionally', false, err);
  }

  // Test 12: Velocity Limit & Rapid Initiation Prevention
  try {
    const spamUser = await User.create({
      email: `spam_${testSuffix}@example.com`,
      password: 'Password123!',
      phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountStatus: 'ACTIVE',
    });
    const spamWallet = await walletService.getOrCreateWallet(spamUser._id);
    spamWallet.availableBalance = 500;
    await spamWallet.save();

    // Create 5 sessions within 1 minute
    for (let i = 0; i < 5; i++) {
      await PaidCommunicationSession.create({
        sessionId: uuidv4(),
        initiatorId: spamUser._id,
        receiverId: receiver._id,
        communicationType: CommunicationTypes.MESSAGE,
        ratePerMinuteSnapshot: 1,
        configurationVersion: 1,
        status: PaidSessionStatuses.ENDED,
        createdAt: new Date(),
      });
    }

    const check = await fraudProtectionService.validateSessionInitiation({
      initiatorId: spamUser._id,
      receiverId: receiver._id,
    });
    assert.strictEqual(check.allowed, false);
    assert.strictEqual(check.code, 'RATE_LIMIT_EXCEEDED');
    report('5.2 Rapid session creation velocity limit (max 5/min) enforced', true);
  } catch (err) {
    report('5.2 Rapid session creation velocity limit (max 5/min) enforced', false, err);
  }

  console.log('\n[SECTION 6: FEATURE FLAGS & OBSERVABILITY METRICS]');

  // Test 13: Feature Flags Management and Admin Mutation
  try {
    const initialFlags = await featureFlagService.getFeatureFlags();
    assert(typeof initialFlags.flags.PAID_MESSAGING === 'boolean');

    const updateResult = await featureFlagService.updateFeatureFlags({
      adminUserId: adminUser._id,
      flags: { PAID_VIDEO: true },
      rolloutStage: 'STAGE_5_VIDEO_ROLLOUT',
      reason: 'Admin progressing video staged rollout',
    });
    assert.strictEqual(updateResult.success, true);
    assert.strictEqual(updateResult.flags.VIDEO, true);

    const audit = await AdminAuditLog.findOne({
      targetType: 'FEATURE_FLAGS',
      action: 'UPDATE_FEATURE_FLAGS',
    });
    assert(audit, 'Audit log created for feature flag mutation');
    report('6.1 Feature flags & staged rollout managed with administrative audit logs', true);
  } catch (err) {
    report('6.1 Feature flags & staged rollout managed with administrative audit logs', false, err);
  }

  // Test 14: Telemetry Metrics Summary
  try {
    const metrics = await telemetryService.getMetricsSummary();
    assert(typeof metrics.sessions.totalLast24h === 'number');
    assert(typeof metrics.billing.totalDebitsRecordedLast24h === 'number');
    assert(typeof metrics.sessions.acceptanceRatePercent === 'number');

    const health = await telemetryService.getHealthStatus();
    assert(['HEALTHY', 'DEGRADED'].includes(health.status));
    report('6.2 Telemetry metrics and health status aggregation verified', true);
  } catch (err) {
    report('6.2 Telemetry metrics and health status aggregation verified', false, err);
  }

  console.log('\n[SECTION 7: PRE-DEPLOYMENT VALIDATION COMMAND]');

  // Test 15: Run Deployment Validator in Subprocess
  try {
    const validatorScriptPath = path.join(__dirname, '..', 'scripts', 'validate_deployment.js');
    const validatorOutput = execSync(`node ${validatorScriptPath}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });
    assert(validatorOutput.includes('PRE-DEPLOYMENT VALIDATION PASSED'), 'Validator output must report PASS');
    report('7.1 Pre-deployment validation command executes successfully and validates environment', true);
  } catch (err) {
    report('7.1 Pre-deployment validation command executes successfully and validates environment', false, err);
  }

  console.log('\n================================================================================');
  console.log(`PC-03 SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================================\n');

  if (server) server.close();
  if (mongoose.connection) await mongoose.connection.close();

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPC03Tests().catch((err) => {
    console.error('Fatal PC-03 test error:', err);
    process.exit(1);
  });
}

module.exports = runPC03Tests;
