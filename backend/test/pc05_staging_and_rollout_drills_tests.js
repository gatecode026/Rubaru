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
const featureFlagService = require('../services/featureFlagService');
const environmentGuard = require('../config/environmentGuard');
const { PaidBillingWorker } = require('../services/paidBillingWorker');
const verifyStagingMigrations = require('../migrations/verify_staging_migrations');
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

async function runPC05Tests() {
  console.log('================================================================================');
  console.log('       PC-05 STAGING DEPLOYMENT, DRILLS, ROLLOUT & MONITORING TESTS            ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

  // Ensure active config enables all communication types for testing
  const activeConfig = await PaidCommunicationConfig.getActiveConfig();
  activeConfig.enabled = { MESSAGE: true, AUDIO: true, VIDEO: true, BACKGROUND_CALLS: true, BILLING_WORKER: true, RECEIVER_EARNING: true };
  await activeConfig.save();

  const testSuffix = `pc05_${Date.now()}`;
  const initiator = await User.create({
    email: `init_${testSuffix}@example.com`,
    password: 'Password123!',
    phone: `+9198${Math.floor(10000000 + Math.random() * 90000000)}`,
    accountStatus: 'ACTIVE',
  });
  const receiver = await User.create({
    email: `recv_${testSuffix}@example.com`,
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

  const adminToken = generateToken(adminUser._id);
  // Fund initiator with 200 coins via admin adjustment
  await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${initiator._id}/adjust-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ amount: 200, reason: 'PC-05 test wallet funding' }),
  });

  console.log('[SECTION 1: ENVIRONMENT SEPARATION & MIGRATION AUDIT]');

  // Test 1: Environment Guard Startup Validation
  try {
    const guardInfo = environmentGuard.validateEnvironment();
    assert.strictEqual(guardInfo.status, 'GUARD_VERIFIED');
    assert(guardInfo.workerNamespace.includes('rubaru-paid-billing'));
    report('1.1 Environment separation guard validates runtime boundaries', true);
  } catch (err) {
    report('1.1 Environment separation guard validates runtime boundaries', false, err);
  }

  // Test 2: Staging Database Migration & Indexes Audit
  try {
    const migrationPassed = await verifyStagingMigrations();
    assert.strictEqual(migrationPassed, true, 'All staging indexes and schema rules verified');
    report('1.2 Staging database migration and index verification passed', true);
  } catch (err) {
    report('1.2 Staging database migration and index verification passed', false, err);
  }

  console.log('\n[SECTION 2: FAILURE AND RECOVERY DRILLS]');

  // Test 3: Backend Restart Drill during Active Session
  try {
    const activeSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: initiator._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.AUDIO,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: receiver._id, sessionId: activeSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: initiator._id, sessionId: activeSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: activeSession.sessionId });

    // Simulate backend crash with stale lease and dead heartbeats
    const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: activeSession.sessionId });
    sessionDoc.billingLeaseExpiresAt = new Date(Date.now() - 30000);
    sessionDoc.billingLeaseOwner = 'crashed-instance-42';
    sessionDoc.lastInitiatorHeartbeatAt = new Date(Date.now() - 120000);
    sessionDoc.lastReceiverHeartbeatAt = new Date(Date.now() - 120000);
    await sessionDoc.save();

    // Run startup recovery
    const recoveryStats = await sessionRecoveryService.runStartupRecovery();
    assert(recoveryStats.clearedLeasesCount >= 1, 'Stale lease cleared');

    const recoveredDoc = await PaidCommunicationSession.findOne({ sessionId: activeSession.sessionId });
    assert.strictEqual(recoveredDoc.status, PaidSessionStatuses.ENDED, 'Dead session ended cleanly');
    assert.strictEqual(recoveredDoc.endReason, PaidSessionEndReasons.HEARTBEAT_TIMEOUT);
    report('2.1 Restart drill: Stale worker lease recovered & dead session terminated cleanly', true);
  } catch (err) {
    report('2.1 Restart drill: Stale worker lease recovered & dead session terminated cleanly', false, err);
  }

  // Test 4: Worker Lease Race & Duplicate Minute Prevention Drill
  try {
    const raceSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: initiator._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.VIDEO,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: receiver._id, sessionId: raceSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: initiator._id, sessionId: raceSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: raceSession.sessionId });

    const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: raceSession.sessionId });
    sessionDoc.nextChargeAt = new Date(Date.now() - 1000);
    await sessionDoc.save();

    // Run two worker instances simultaneously
    const worker1 = new PaidBillingWorker({ workerId: 'worker-instance-1' });
    const worker2 = new PaidBillingWorker({ workerId: 'worker-instance-2' });

    const [pass1, pass2] = await Promise.all([worker1.runBillingPass(), worker2.runBillingPass()]);

    const finalSession = await PaidCommunicationSession.findOne({ sessionId: raceSession.sessionId });
    assert.strictEqual(finalSession.billedMinutes, 2, 'Minute 2 charged exactly once across competing workers');

    const debits = await WalletLedger.find({ sessionId: raceSession.sessionId, minuteIndex: 2, entryType: LedgerEntryTypes.DEBIT });
    assert.strictEqual(debits.length, 1, 'Exactly one debit recorded for minuteIndex 2');
    await paidCommunicationService.endPaidSession({ actorUserId: initiator._id, sessionId: raceSession.sessionId });
    report('2.2 Worker race drill: Competing worker instances process minute charge exactly once', true);
  } catch (err) {
    report('2.2 Worker race drill: Competing worker instances process minute charge exactly once', false, err);
  }

  // Test 5: Wallet Freeze during Active Call Drill
  try {
    const freezeSession = await paidCommunicationService.initiatePaidSession({
      initiatorId: initiator._id,
      receiverId: receiver._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    await paidCommunicationService.acceptPaidSession({ receiverId: receiver._id, sessionId: freezeSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: initiator._id, sessionId: freezeSession.sessionId });
    await paidCommunicationService.markParticipantConnected({ userId: receiver._id, sessionId: freezeSession.sessionId });

    // Admin freezes initiator wallet during call
    await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${initiator._id}/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Security drill wallet freeze' }),
    });

    const initWallet = await Wallet.findOne({ userId: initiator._id });
    assert.strictEqual(initWallet.status, WalletStatuses.FROZEN);

    // Attempt minute 2 charge on frozen wallet
    const sessionDoc = await PaidCommunicationSession.findOne({ sessionId: freezeSession.sessionId });
    let chargeFailed = false;
    try {
      await walletService.executeCommunicationCharge({ sessionDoc, minuteIndex: 2 });
    } catch (e) {
      chargeFailed = true;
      assert.strictEqual(e.code, 'WALLET_NOT_ACTIVE');
    }
    assert.strictEqual(chargeFailed, true, 'Minute charge on frozen wallet was rejected');

    // Unfreeze for subsequent test cleanup
    await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${initiator._id}/unfreeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Unfreezing after security drill' }),
    });
    report('2.3 Wallet freeze drill: Frozen wallet blocks subsequent minute deductions', true);
  } catch (err) {
    report('2.3 Wallet freeze drill: Frozen wallet blocks subsequent minute deductions', false, err);
  }

  console.log('\n[SECTION 3: EMERGENCY STOP & CANARY FEATURE FLAGS]');

  // Test 6: Emergency Stop Feature Flag Deactivation
  try {
    // Admin triggers emergency stop for VIDEO calling
    await featureFlagService.updateFeatureFlags({
      adminUserId: adminUser._id,
      flags: { PAID_VIDEO: false },
      rolloutStage: 'EMERGENCY_HALT_VIDEO',
      reason: 'Incident response drill',
    });

    let videoBlocked = false;
    try {
      await paidCommunicationService.initiatePaidSession({
        initiatorId: initiator._id,
        receiverId: receiver._id,
        communicationType: CommunicationTypes.VIDEO,
      });
    } catch (e) {
      videoBlocked = true;
      assert.strictEqual(e.code, 'COMMUNICATION_TYPE_DISABLED');
    }
    assert.strictEqual(videoBlocked, true, 'Disabled communication type prevented from initiating');

    // Re-enable VIDEO for normal staging operations
    await featureFlagService.updateFeatureFlags({
      adminUserId: adminUser._id,
      flags: { PAID_VIDEO: true },
      rolloutStage: 'STAGE_5_VIDEO_ROLLOUT',
      reason: 'Re-enabling video after drill',
    });
    report('3.1 Emergency stop drill: Immediate feature flag shutdown blocks new sessions', true);
  } catch (err) {
    report('3.1 Emergency stop drill: Immediate feature flag shutdown blocks new sessions', false, err);
  }

  console.log('\n[SECTION 4: FINAL RECONCILIATION GATE]');

  // Test 7: Post-Drills Financial Reconciliation Gate
  try {
    const testUserIds = [initiator._id, receiver._id];
    const reconReport = await reconciliationService.runFullReconciliation({ userIds: testUserIds });
    assert.strictEqual(reconReport.isHealthy, true, 'Reconciliation gate must pass with 0 anomalies');
    assert.strictEqual(reconReport.summary.totalIssues, 0, 'Zero issues across all drill sessions');
    report('4.1 Post-drills reconciliation gate: 100% HEALTHY (0 anomalies)', true);
  } catch (err) {
    report('4.1 Post-drills reconciliation gate: 100% HEALTHY (0 anomalies)', false, err);
  }

  console.log('\n================================================================================');
  console.log(`PC-05 SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================================\n');

  if (server) server.close();
  if (mongoose.connection) await mongoose.connection.close();

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPC05Tests().catch((err) => {
    console.error('Fatal PC-05 test error:', err);
    process.exit(1);
  });
}

module.exports = runPC05Tests;
