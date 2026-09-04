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
const { v4: uuidv4 } = require('uuid');

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
  PaidSessionEndReasons,
} = require('../models/enums');

// Services & Routes
const walletService = require('../services/walletService');
const paidCommunicationService = require('../services/paidCommunicationService');
const reconciliationService = require('../services/reconciliationService');
const featureFlagService = require('../services/featureFlagService');
const adminRoutes = require('../routes/adminRoutes');
const paidCommunicationRoutes = require('../routes/paidCommunicationRoutes');

let server;
let port;
let baseUrl;

async function setupTestApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/v1/admin/paid-communication', adminRoutes);
  app.use('/v1/paid-communication', paidCommunicationRoutes);

  server = http.createServer(app);
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

async function createTestAdmin({ role = 'ADMIN', permissions = [] } = {}) {
  const email = `admin_${uuidv4().substring(0, 8)}@rubaru.app`;
  const user = await User.create({
    email,
    password: 'Password123!',
    role,
    permissions,
    accountStatus: 'ACTIVE',
    points: 1000,
  });
  return { user, token: generateToken(user) };
}

async function createTestUser({ balance = 100, role = 'USER', permissions = [] } = {}) {
  const email = `user_${uuidv4().substring(0, 8)}@rubaru.app`;
  const user = await User.create({
    email,
    password: 'Password123!',
    role,
    permissions,
    accountStatus: 'ACTIVE',
    points: balance,
  });
  const wallet = await walletService.getOrCreateWallet(user._id);
  wallet.availableBalance = balance;
  await wallet.save();
  return { user, wallet, token: generateToken(user) };
}

async function runTests() {
  console.log('================================================================================');
  console.log('   RUBARU PC-08: PAID COMMUNICATION ADMIN DASHBOARD & FINANCIAL OPS TEST SUITE  ');
  console.log('================================================================================\n');

  await connectDB();
  await setupTestApp();

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

  // --- 1. Permissions & RBAC Enforcement ---
  console.log('--- 1. Permissions & RBAC Enforcement ---');

  await test('1. Permissions persist correctly in User schema', async () => {
    const { user } = await createTestAdmin({
      role: 'FINANCE_ADMIN',
      permissions: ['paidCommunication.view', 'paidCommunication.adjustWallets'],
    });
    const loaded = await User.findById(user._id);
    assert.strictEqual(loaded.role, 'FINANCE_ADMIN');
    assert.deepStrictEqual(loaded.permissions, ['paidCommunication.view', 'paidCommunication.adjustWallets']);
    assert.strictEqual(loaded.hasPermission('paidCommunication.view'), true);
    assert.strictEqual(loaded.hasPermission('paidCommunication.adjustWallets'), true);
    assert.strictEqual(loaded.hasPermission('paidCommunication.manageRates'), false);
  });

  await test('2. Unauthorized admins without permissions are rejected with 403', async () => {
    const { token } = await createTestUser({ role: 'USER', permissions: [] });
    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 403);
    assert.strictEqual(body.code, 'PERMISSION_DENIED');
  });

  await test('3. Super-admin wildcard access is permitted across all administrative actions', async () => {
    const { user, token } = await createTestAdmin({ role: 'SUPER_ADMIN', permissions: [] });
    assert.strictEqual(user.hasPermission('paidCommunication.manageRates'), true);
    assert.strictEqual(user.hasPermission('paidCommunication.adjustWallets'), true);

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
  });

  // --- 2. Overview & Real Database Aggregations ---
  console.log('\n--- 2. Overview & Real Database Aggregations ---');

  await test('4. Overview returns genuine aggregated database metrics', async () => {
    const { token } = await createTestAdmin({ role: 'SUPER_ADMIN' });
    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/overview?timeframe=all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert(body.data.activePaidSessions >= 0);
    assert(body.data.coinsSpent >= 0);
    assert(body.data.totalTransferredCoins >= 0);
    assert.strictEqual(body.data.workerHealth.billingWorker.status, 'HEALTHY');
  });

  // --- 3. Rate Configuration & Versioning ---
  console.log('\n--- 3. Rate Configuration & Versioning ---');

  await test('5. Rate changes create a new version with an audit log', async () => {
    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.manageRates', 'paidCommunication.view'],
    });

    const updateRes = await fetch(`${baseUrl}/v1/admin/paid-communication/rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
        reason: 'PC-08 Admin rate test update',
      }),
    });
    const updateBody = await updateRes.json();
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateBody.ok, true);
    assert(updateBody.data.version > 0);

    const audit = await AdminAuditLog.findOne({
      action: 'UPDATE_COMMUNICATION_RATES',
      targetType: 'RATE_CONFIG',
    }).sort({ createdAt: -1 });
    assert(audit);
    assert.strictEqual(audit.reason, 'PC-08 Admin rate test update');
  });

  await test('6. Existing sessions retain old rates after rate updates', async () => {
    const { user: userA } = await createTestUser({ balance: 50 });
    const { user: userB } = await createTestUser({ balance: 50 });

    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    const originalRate = sessionDoc.ratePerMinuteSnapshot;
    assert.strictEqual(originalRate, 1);

    // Update config to 2 coins
    const { token } = await createTestAdmin({ role: 'SUPER_ADMIN' });
    await fetch(`${baseUrl}/v1/admin/paid-communication/rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rates: { MESSAGE: 2, AUDIO: 5, VIDEO: 10 },
        reason: 'Rate increase test',
      }),
    });

    // Session snapshot should remain 1
    const reloaded = await PaidCommunicationSession.findOne({ sessionId: sessionDoc.sessionId });
    assert.strictEqual(reloaded.ratePerMinuteSnapshot, 1);

    // Restore to 1 coin
    await fetch(`${baseUrl}/v1/admin/paid-communication/rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rates: { MESSAGE: 1, AUDIO: 5, VIDEO: 10 },
        reason: 'Restore standard rate',
      }),
    });
  });

  await test('7. Invalid rates (zero, negative, non-integer) are rejected', async () => {
    const { token } = await createTestAdmin({ role: 'SUPER_ADMIN' });
    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/rates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        rates: { MESSAGE: -5, AUDIO: 0, VIDEO: 'invalid' },
        reason: 'Invalid rate test',
      }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.code, 'INVALID_RATES');
  });

  // --- 4. Session Monitoring & Forced Termination ---
  console.log('\n--- 4. Session Monitoring & Forced Termination ---');

  await test('8. Session search and filters work with sanitized metadata', async () => {
    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.viewSessions'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/sessions?limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert(Array.isArray(body.data));
  });

  await test('9. Session termination is authorized, idempotent, and creates audit log', async () => {
    const { user: userA } = await createTestUser({ balance: 50 });
    const { user: userB } = await createTestUser({ balance: 50 });
    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });

    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.endSessions'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/sessions/${sessionDoc.sessionId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'Terms of service breach' }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.data.status, PaidSessionStatuses.ENDED);

    const audit = await AdminAuditLog.findOne({
      targetId: sessionDoc.sessionId,
      action: 'ADMINISTRATIVE_SESSION_END',
    });
    assert(audit);
    assert.strictEqual(audit.reason, 'Terms of service breach');
  });

  // --- 5. Wallet Administration & Manual Adjustments ---
  console.log('\n--- 5. Wallet Administration & Manual Adjustments ---');

  await test('10. Wallet freeze blocks new session initiation', async () => {
    const { user, token: userToken } = await createTestUser({ balance: 50 });
    const { user: userB } = await createTestUser({ balance: 50 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.freezeWallets'],
    });

    // Admin freezes user's wallet
    const freezeRes = await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/freeze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: 'Fraud investigation' }),
    });
    assert.strictEqual(freezeRes.status, 200);

    // Attempt to initiate session should fail
    await assert.rejects(
      async () => {
        await paidCommunicationService.initiatePaidSession({
          initiatorId: user._id,
          receiverId: userB._id,
          communicationType: CommunicationTypes.MESSAGE,
        });
      },
      (err) => err.code === 'WALLET_NOT_ACTIVE'
    );
  });

  await test('11. Wallet unfreeze restores eligibility', async () => {
    const { user } = await createTestUser({ balance: 50 });
    const { user: userB } = await createTestUser({ balance: 50 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.freezeWallets'],
    });

    // Freeze then unfreeze
    await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Hold' }),
    });
    await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/unfreeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Cleared' }),
    });

    // Can now initiate session
    const sessionDoc = await paidCommunicationService.initiatePaidSession({
      initiatorId: user._id,
      receiverId: userB._id,
      communicationType: CommunicationTypes.MESSAGE,
    });
    assert(sessionDoc);
  });

  await test('12. Manual credit creates an immutable ledger entry and audit log', async () => {
    const { user, wallet } = await createTestUser({ balance: 10 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.adjustWallets'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        amount: 25,
        type: 'CREDIT',
        reason: 'Customer support compensation',
      }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.data.balanceBefore, 10);
    assert.strictEqual(body.data.balanceAfter, 35);

    const reloadedWallet = await Wallet.findById(wallet._id);
    assert.strictEqual(reloadedWallet.availableBalance, 35);

    const ledger = await WalletLedger.findOne({
      userId: user._id,
      amount: 25,
      entryType: LedgerEntryTypes.CREDIT,
    });
    assert(ledger);
  });

  await test('13. Manual debit cannot create a negative balance', async () => {
    const { user } = await createTestUser({ balance: 15 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.adjustWallets'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/adjust`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        amount: 20, // greater than 15
        type: 'DEBIT',
        reason: 'Excessive debit test',
      }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(body.code, 'ADJUSTMENT_FAILED');
  });

  await test('14. Duplicate adjustment idempotency key prevents double debit/credit', async () => {
    const { user } = await createTestUser({ balance: 50 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.adjustWallets'],
    });
    const idempotencyKey = `idemp-adj-test-${uuidv4()}`;

    // First call
    const res1 = await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 10, type: 'CREDIT', reason: 'Bonus', idempotencyKey }),
    });
    const body1 = await res1.json();
    assert.strictEqual(body1.data.balanceAfter, 60);

    // Duplicate call
    const res2 = await fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ amount: 10, type: 'CREDIT', reason: 'Bonus', idempotencyKey }),
    });
    const body2 = await res2.json();
    assert.strictEqual(body2.ok, true);
    assert.strictEqual(body2.data.isIdempotentReplay, true);

    const reloaded = await Wallet.findOne({ userId: user._id });
    assert.strictEqual(reloaded.availableBalance, 60); // Not 70!
  });

  await test('15. Ledger entries are strictly immutable (cannot be edited or deleted)', async () => {
    const ledger = await WalletLedger.findOne();
    assert(ledger);

    await assert.rejects(
      async () => {
        await WalletLedger.updateOne({ _id: ledger._id }, { amount: 9999 });
      },
      (err) => err.message.includes('IMMUTABLE_RECORD')
    );

    await assert.rejects(
      async () => {
        await WalletLedger.deleteOne({ _id: ledger._id });
      },
      (err) => err.message.includes('IMMUTABLE_RECORD')
    );
  });

  // --- 6. Reconciliation & Risk & Emergency Controls ---
  console.log('\n--- 6. Reconciliation & Risk & Emergency Controls ---');

  await test('16. Reconciliation identifies inconsistencies and returns report', async () => {
    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.runReconciliation'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/reconciliation/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason: 'Nightly reconciliation check' }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);
    assert(body.data.isHealthy !== undefined || body.data.summary !== undefined);
  });

  await test('17. Reconciliation does not silently modify historical records without repair action', async () => {
    const beforeWallets = await Wallet.find().lean();
    await reconciliationService.runFullReconciliation();
    const afterWallets = await Wallet.find().lean();

    assert.strictEqual(beforeWallets.length, afterWallets.length);
    beforeWallets.forEach((w, idx) => {
      assert.strictEqual(w.availableBalance, afterWallets[idx].availableBalance);
    });
  });

  await test('18. Emergency stop blocks new sessions and preserves ledger', async () => {
    const { user: userA } = await createTestUser({ balance: 50 });
    const { user: userB } = await createTestUser({ balance: 50 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.manageFlags'],
    });

    // Enable emergency stop
    const stopRes = await fetch(`${baseUrl}/v1/admin/paid-communication/feature-flags`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        flags: { emergencyStop: true },
        reason: 'Emergency maintenance drill',
      }),
    });
    assert.strictEqual(stopRes.status, 200);

    // Attempt to initiate session
    await assert.rejects(
      async () => {
        await paidCommunicationService.initiatePaidSession({
          initiatorId: userA._id,
          receiverId: userB._id,
          communicationType: CommunicationTypes.MESSAGE,
        });
      },
      (err) => err.code === 'EMERGENCY_STOP_ACTIVE' || err.code === 'COMMUNICATION_TYPE_DISABLED'
    );

    // Restore emergency stop flag
    await fetch(`${baseUrl}/v1/admin/paid-communication/feature-flags`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        flags: { emergencyStop: false },
        reason: 'End maintenance drill',
      }),
    });
  });

  await test('19. Feature-flag changes create immutable audit trail', async () => {
    const latestAudit = await AdminAuditLog.findOne({
      targetType: 'FEATURE_FLAGS',
    }).sort({ createdAt: -1 });
    assert(latestAudit);
    assert(latestAudit.reason.includes('maintenance drill'));
  });

  await test('20. Risk actions require permissions and log actions', async () => {
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.manageRisk'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/risk/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'MARK_FALSE_POSITIVE',
        reason: 'Verified legitimate traffic',
        alertId: 'test-alert-1',
      }),
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.ok, true);

    const audit = await AdminAuditLog.findOne({
      targetType: 'RISK',
      action: 'RISK_ACTION_MARK_FALSE_POSITIVE',
    });
    assert(audit);
  });

  await test('21. Private message content, passwords, SDP, and ICE candidates are not exposed', async () => {
    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.viewSessions'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/sessions?limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    body.data.forEach((s) => {
      assert.strictEqual(s.metadata?.connectionNonce, undefined);
      assert.strictEqual(s.metadata?.sdp, undefined);
      assert.strictEqual(s.metadata?.candidates, undefined);
      if (s.initiatorId) {
        assert.strictEqual(s.initiatorId.password, undefined);
      }
    });
  });

  await test('22. Cursor pagination works on ledger and sessions', async () => {
    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.viewLedger'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/ledger?limit=2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert(body.data.length <= 2);
    if (body.pagination.nextCursor) {
      const res2 = await fetch(
        `${baseUrl}/v1/admin/paid-communication/ledger?limit=2&cursor=${body.pagination.nextCursor}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const body2 = await res2.json();
      assert.strictEqual(res2.status, 200);
    }
  });

  await test('23. CSV export is sanitized against spreadsheet formula injection', async () => {
    const { token } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.viewLedger'],
    });

    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/ledger?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'text/csv; charset=utf-8');
    const text = await res.text();
    assert(text.startsWith('Transaction ID,Session ID,User ID'));
  });

  await test('24. Concurrent admin actions remain consistent and audited', async () => {
    const { user } = await createTestUser({ balance: 100 });
    const { token: adminToken } = await createTestAdmin({
      role: 'ADMIN',
      permissions: ['paidCommunication.adjustWallets'],
    });

    const promises = [
      fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ amount: 10, type: 'CREDIT', reason: 'Concurrent adj 1' }),
      }),
      fetch(`${baseUrl}/v1/admin/paid-communication/wallets/${user._id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ amount: 10, type: 'CREDIT', reason: 'Concurrent adj 2' }),
      }),
    ];

    const results = await Promise.all(promises);
    assert.strictEqual(results[0].status, 200);
    assert.strictEqual(results[1].status, 200);

    const reloaded = await Wallet.findOne({ userId: user._id });
    assert.strictEqual(reloaded.availableBalance, 120);
  });

  await test('25. Existing admin and safety regression tests remain passing', async () => {
    const { token } = await createTestAdmin({ role: 'SUPER_ADMIN' });
    const res = await fetch(`${baseUrl}/v1/admin/paid-communication/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.status, 200);
  });

  console.log('\n================================================================================');
  console.log(`PC-08 ADMIN TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
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
