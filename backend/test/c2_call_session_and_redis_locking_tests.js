const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const assert = require('assert');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Block = require('../models/Block');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const CallSession = require('../models/CallSession');

const {
  CallStatuses,
  PaidSessionStatuses,
  CommunicationTypes,
  CallEndReasons,
  MatchStatuses,
  AccountStatuses,
} = require('../models/enums');

// Services
const callService = require('../services/callService');
const callLockService = require('../services/callLockService');
const walletService = require('../services/walletService');

const { initRedis } = require('../config/redis');

let userA, userB, userC, userBlocked;
let matchAB, matchAC, matchCB;

async function setupTestData() {
  await connectDB();
  await initRedis().catch(() => initRedis({ mock: true }));

  // Create active configuration
  await PaidCommunicationConfig.deleteMany({});
  await PaidCommunicationConfig.create({
    version: 1,
    isActive: true,
    rates: {
      MESSAGE: 1,
      AUDIO: 5,
      VIDEO: 10,
    },
    billingIncrementSeconds: 60,
    requestExpirationSeconds: 45,
    enabled: {
      MESSAGE: true,
      AUDIO: true,
      VIDEO: true,
    },
  });

  // Create Users
  const timestamp = Date.now();
  userA = await User.create({
    email: `caller_a_${timestamp}@test.com`,
    password: 'TestPassword123!',
    phone: `+919900${Math.floor(100000 + Math.random() * 900000)}`,
    accountStatus: AccountStatuses.ACTIVE,
  });
  userB = await User.create({
    email: `callee_b_${timestamp}@test.com`,
    password: 'TestPassword123!',
    phone: `+919901${Math.floor(100000 + Math.random() * 900000)}`,
    accountStatus: AccountStatuses.ACTIVE,
  });
  userC = await User.create({
    email: `third_c_${timestamp}@test.com`,
    password: 'TestPassword123!',
    phone: `+919902${Math.floor(100000 + Math.random() * 900000)}`,
    accountStatus: AccountStatuses.ACTIVE,
  });
  userBlocked = await User.create({
    email: `blocked_${timestamp}@test.com`,
    password: 'TestPassword123!',
    phone: `+919903${Math.floor(100000 + Math.random() * 900000)}`,
    accountStatus: AccountStatuses.ACTIVE,
  });

  // Create Profiles
  await Profile.create([
    { user: userA._id, displayName: 'Caller A', gender: 'Male', dateOfBirth: new Date(1995, 0, 1) },
    { user: userB._id, displayName: 'Callee B', gender: 'Female', dateOfBirth: new Date(1996, 5, 15) },
    { user: userC._id, displayName: 'Third Party C', gender: 'Other', dateOfBirth: new Date(1997, 3, 20) },
    { user: userBlocked._id, displayName: 'Blocked User', gender: 'Male', dateOfBirth: new Date(1994, 8, 10) },
  ]);

  // Create Active Match between A and B
  matchAB = await Match.create({
    users: [userA._id, userB._id],
    status: MatchStatuses.ACTIVE,
    initiatorInteraction: new mongoose.Types.ObjectId(),
  });

  // Create Active Match between A and C
  matchAC = await Match.create({
    users: [userA._id, userC._id],
    status: MatchStatuses.ACTIVE,
    initiatorInteraction: new mongoose.Types.ObjectId(),
  });

  // Create Active Match between C and B
  matchCB = await Match.create({
    users: [userC._id, userB._id],
    status: MatchStatuses.ACTIVE,
    initiatorInteraction: new mongoose.Types.ObjectId(),
  });

  // Create Block between A and userBlocked
  await Block.create({
    blocker: userA._id,
    blocked: userBlocked._id,
    reason: 'Safety test block',
  });

  // Create Wallets with initial funds
  const walletA = await walletService.getOrCreateWallet(userA._id);
  walletA.availableBalance = 100;
  await walletA.save();

  const walletB = await walletService.getOrCreateWallet(userB._id);
  walletB.availableBalance = 50;
  await walletB.save();

  const walletC = await walletService.getOrCreateWallet(userC._id);
  walletC.availableBalance = 50;
  await walletC.save();
}

async function cleanupTestData() {
  await Promise.all([
    User.deleteMany({ _id: { $in: [userA._id, userB._id, userC._id, userBlocked._id] } }),
    Profile.deleteMany({ user: { $in: [userA._id, userB._id, userC._id, userBlocked._id] } }),
    Match.deleteMany({ _id: { $in: [matchAB._id, matchAC._id, matchCB._id] } }),
    Block.deleteMany({ blocker: userA._id }),
    Wallet.deleteMany({ userId: { $in: [userA._id, userB._id, userC._id, userBlocked._id] } }),
    PaidCommunicationSession.deleteMany({ caller: { $in: [userA._id, userB._id, userC._id, userBlocked._id] } }),
  ]);
}

async function runTests() {
  console.log('================================================================================');
  console.log('   ROOBARU CALLING R4-C2: AUTHORITATIVE SESSION, STATE & LOCKING TEST SUITE     ');
  console.log('================================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(`         Error: ${err.message}`);
      failed++;
    }
  }

  await setupTestData();

  // -------------------------------------------------------------
  // 1. Authoritative Model & State Machine Tests
  // -------------------------------------------------------------
  console.log('\n--- 1. State Machine & Transition Tests ---');

  await test('CallSession model maps to unified PaidCommunicationSession', async () => {
    assert.strictEqual(CallSession, PaidCommunicationSession);
  });

  await test('State Machine allows valid sequential lifecycle transitions', async () => {
    const session = new CallSession({
      sessionId: `test_seq_${Date.now()}`,
      initiatorId: userA._id,
      receiverId: userB._id,
      communicationType: 'AUDIO',
      ratePerMinuteSnapshot: 5,
      status: CallStatuses.INITIATED,
    });

    assert.strictEqual(session.canTransitionTo(CallStatuses.RINGING), true);
    session.status = CallStatuses.RINGING;
    assert.strictEqual(session.canTransitionTo(CallStatuses.ACCEPTED), true);
    session.status = CallStatuses.ACCEPTED;
    assert.strictEqual(session.canTransitionTo(CallStatuses.CONNECTING), true);
    session.status = CallStatuses.CONNECTING;
    assert.strictEqual(session.canTransitionTo(CallStatuses.ACTIVE), true);
    session.status = CallStatuses.ACTIVE;
    assert.strictEqual(session.canTransitionTo(CallStatuses.RECONNECTING), true);
    session.status = CallStatuses.RECONNECTING;
    assert.strictEqual(session.canTransitionTo(CallStatuses.ACTIVE), true);
    session.status = CallStatuses.ACTIVE;
    assert.strictEqual(session.canTransitionTo(CallStatuses.ENDED), true);
    session.status = CallStatuses.ENDED;
    assert.strictEqual(session.canTransitionTo(CallStatuses.ACTIVE), false);
  });

  await test('Terminal states strictly prohibit any further transitions', async () => {
    const terminalStates = [
      CallStatuses.REJECTED,
      CallStatuses.CANCELLED,
      CallStatuses.MISSED,
      CallStatuses.BUSY,
      CallStatuses.FAILED,
      CallStatuses.ENDED,
    ];

    for (const status of terminalStates) {
      const session = new CallSession({
        sessionId: `term_${status}_${Date.now()}`,
        initiatorId: userA._id,
        receiverId: userB._id,
        communicationType: 'AUDIO',
        ratePerMinuteSnapshot: 5,
        status,
      });
      assert.strictEqual(session.canTransitionTo(CallStatuses.ACTIVE), false);
      assert.strictEqual(session.canTransitionTo(CallStatuses.RINGING), false);
      assert.strictEqual(session.canTransitionTo(CallStatuses.ACCEPTED), false);
    }
  });

  // -------------------------------------------------------------
  // 2. Eligibility and Authorization Tests
  // -------------------------------------------------------------
  console.log('\n--- 2. Call Eligibility & Authorization Tests ---');

  await test('Rejects call initiation between unmatched users', async () => {
    const unmatchedUser = await User.create({
      email: `unmatched_${Date.now()}@test.com`,
      password: 'TestPassword123!',
      accountStatus: AccountStatuses.ACTIVE,
    });

    try {
      await callService.initiateCall({
        callerId: userA._id,
        receiverId: unmatchedUser._id,
        callType: 'AUDIO',
      });
      assert.fail('Expected MATCH_REQUIRED error');
    } catch (err) {
      assert.strictEqual(err.code, 'MATCH_REQUIRED');
    } finally {
      await User.deleteOne({ _id: unmatchedUser._id });
    }
  });

  await test('Rejects call initiation to blocked user', async () => {
    try {
      await callService.initiateCall({
        callerId: userA._id,
        receiverId: userBlocked._id,
        callType: 'AUDIO',
      });
      assert.fail('Expected USER_BLOCKED error');
    } catch (err) {
      assert.strictEqual(err.code, 'USER_BLOCKED');
    }
  });

  await test('Rejects call initiation with yourself', async () => {
    try {
      await callService.initiateCall({
        callerId: userA._id,
        receiverId: userA._id,
        callType: 'AUDIO',
      });
      assert.fail('Expected SELF_COMMUNICATION_PROHIBITED error');
    } catch (err) {
      assert.strictEqual(err.code, 'SELF_COMMUNICATION_PROHIBITED');
    }
  });

  await test('Rejects call initiation when caller balance is insufficient', async () => {
    const poorUser = await User.create({
      email: `poor_${Date.now()}@test.com`,
      password: 'TestPassword123!',
      accountStatus: AccountStatuses.ACTIVE,
    });
    const matchPoor = await Match.create({
      users: [poorUser._id, userB._id],
      status: MatchStatuses.ACTIVE,
      initiatorInteraction: new mongoose.Types.ObjectId(),
    });
    const poorWallet = await walletService.getOrCreateWallet(poorUser._id);
    poorWallet.availableBalance = 2; // Needs at least 5 for audio
    await poorWallet.save();

    try {
      await callService.initiateCall({
        callerId: poorUser._id,
        receiverId: userB._id,
        callType: 'AUDIO',
      });
      assert.fail('Expected INSUFFICIENT_BALANCE error');
    } catch (err) {
      assert.strictEqual(err.code, 'INSUFFICIENT_BALANCE');
    } finally {
      await User.deleteOne({ _id: poorUser._id });
      await Match.deleteOne({ _id: matchPoor._id });
      await Wallet.deleteOne({ userId: poorUser._id });
    }
  });

  // -------------------------------------------------------------
  // 3. Distributed Redis Locking & Concurrency Tests
  // -------------------------------------------------------------
  console.log('\n--- 3. Distributed Redis Locking & Concurrency Tests ---');

  await test('Acquires atomic dual-user lock and prevents simultaneous calls', async () => {
    const call1 = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
    });

    assert.ok(call1.callId);
    assert.strictEqual(call1.status, CallStatuses.INITIATED);

    // Caller A tries to start another call with C while A is locked
    try {
      await callService.initiateCall({
        callerId: userA._id,
        receiverId: userC._id,
        callType: 'AUDIO',
      });
      assert.fail('Expected USER_BUSY error for caller A');
    } catch (err) {
      assert.strictEqual(err.code, 'USER_BUSY');
    }

    // Third party C tries to call Callee B while B is locked
    try {
      await callService.initiateCall({
        callerId: userC._id,
        receiverId: userB._id,
        callType: 'AUDIO',
      });
      assert.fail('Expected USER_BUSY error for receiver B');
    } catch (err) {
      assert.strictEqual(err.code, 'USER_BUSY');
    }

    // Clean up call 1
    await callService.cancelCall({ callId: call1.callId, callerId: userA._id });
  });

  await test('Releasing locks allows users to enter new calls immediately', async () => {
    // User A calls User B
    const call = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'VIDEO',
    });

    // Callee B rejects call
    await callService.rejectCall({ callId: call.callId, receiverId: userB._id });

    // Now User A should be able to call User C without lock errors
    const nextCall = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userC._id,
      callType: 'AUDIO',
    });

    assert.ok(nextCall.callId);
    assert.strictEqual(nextCall.status, CallStatuses.INITIATED);

    await callService.cancelCall({ callId: nextCall.callId, callerId: userA._id });
  });

  await test('Idempotent initiation returns same call session for identical key', async () => {
    const idempotencyKey = `idem_${Date.now()}`;

    const res1 = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
      idempotencyKey,
    });

    const res2 = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
      idempotencyKey,
    });

    assert.strictEqual(res1.callId, res2.callId);
    assert.strictEqual(res2.status, CallStatuses.INITIATED);

    // Conflicting reuse with different receiver
    try {
      await callService.initiateCall({
        callerId: userA._id,
        receiverId: userC._id,
        callType: 'AUDIO',
        idempotencyKey,
      });
      assert.fail('Expected IDEMPOTENCY_CONFLICT error');
    } catch (err) {
      assert.strictEqual(err.code, 'IDEMPOTENCY_CONFLICT');
    }

    await callService.cancelCall({ callId: res1.callId, callerId: userA._id });
  });

  // -------------------------------------------------------------
  // 4. Media Connection Confirmation & Billing Tests
  // -------------------------------------------------------------
  console.log('\n--- 4. Media Confirmation & Billing Integration Tests ---');

  await test('Single participant reporting connected does not start billing', async () => {
    const initialWallet = await walletService.getOrCreateWallet(userA._id);
    const startingBalance = initialWallet.availableBalance;

    const call = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'VIDEO', // 10 coins/min
    });

    await callService.markRinging({ callId: call.callId, actorUserId: userA._id });
    await callService.acceptCall({ callId: call.callId, receiverId: userB._id });

    // Only Caller reports ready
    const partial = await callService.markMediaConnected({
      callId: call.callId,
      userId: userA._id,
    });

    assert.strictEqual(partial.status, CallStatuses.CONNECTING);

    // Balance should remain unchanged (0 coins charged while connecting)
    const walletCheck = await walletService.getOrCreateWallet(userA._id);
    assert.strictEqual(walletCheck.availableBalance, startingBalance);

    // Callee also reports ready -> moves to ACTIVE and charges Minute 1!
    const active = await callService.markMediaConnected({
      callId: call.callId,
      userId: userB._id,
    });

    assert.strictEqual(active.status, CallStatuses.ACTIVE);
    assert.ok(active.connectedAt);

    // Balance must be debited exactly 10 coins for Video Call Minute 1
    const billedWallet = await walletService.getOrCreateWallet(userA._id);
    assert.strictEqual(billedWallet.availableBalance, startingBalance - 10);

    // End call
    await callService.endCall({ callId: call.callId, actorUserId: userA._id });
  });

  await test('Non-connected calls (cancelled, rejected, missed) charge zero coins', async () => {
    await PaidCommunicationSession.deleteMany({ caller: userA._id });
    const initialWallet = await walletService.getOrCreateWallet(userA._id);
    const balanceBefore = initialWallet.availableBalance;

    // 1. Cancelled Call
    const call1 = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
    });
    await callService.cancelCall({ callId: call1.callId, callerId: userA._id });

    // 2. Rejected Call
    const call2 = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
    });
    await callService.markRinging({ callId: call2.callId, actorUserId: userA._id });
    await callService.rejectCall({ callId: call2.callId, receiverId: userB._id });

    // 3. Missed Call
    const call3 = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
    });
    await callService.markMissed({ callId: call3.callId });

    const balanceAfter = (await walletService.getOrCreateWallet(userA._id)).availableBalance;
    assert.strictEqual(balanceBefore, balanceAfter);
  });

  await test('Reconnection grace period moves to RECONNECTING and restores to ACTIVE', async () => {
    await PaidCommunicationSession.deleteMany({ caller: userA._id });
    const call = await callService.initiateCall({
      callerId: userA._id,
      receiverId: userB._id,
      callType: 'AUDIO',
    });
    await callService.acceptCall({ callId: call.callId, receiverId: userB._id });
    await callService.markMediaConnected({ callId: call.callId, userId: userA._id });
    await callService.markMediaConnected({ callId: call.callId, userId: userB._id });

    // Network drop
    const reconnecting = await callService.markReconnecting({
      callId: call.callId,
      actorUserId: userA._id,
      reason: 'ICE_DISCONNECTED',
    });

    assert.strictEqual(reconnecting.status, CallStatuses.RECONNECTING);
    assert.ok(reconnecting.reconnectionDeadline);

    // Successful ICE restart
    const restored = await callService.restoreActiveCall({
      callId: call.callId,
      actorUserId: userA._id,
    });

    assert.strictEqual(restored.status, CallStatuses.ACTIVE);

    await callService.endCall({ callId: call.callId, actorUserId: userB._id });
  });

  await cleanupTestData();

  console.log('\n================================================================================');
  console.log(`   R4-C2 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL TEST SUITE ERROR]:', err);
  process.exit(1);
});
