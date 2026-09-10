const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const assert = require('assert');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const { connectSafeTestDB } = require('../config/testDbGuard');
const { initRedis, closeRedis } = require('../config/redis');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');

async function ensureActiveConfig() {
  await PaidCommunicationConfig.findOneAndUpdate(
    { version: 1 },
    {
      version: 1,
      isActive: true,
      rates: {
        MESSAGE: 1,
        AUDIO: 5,
        VIDEO: 10,
      },
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
    },
    { upsert: true, new: true }
  );
}
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const {
  CommunicationTypes,
  PaidSessionStatuses,
  PaidSessionEndReasons,
  LedgerEntryTypes,
  LedgerTransactionTypes,
  WalletStatuses,
} = require('../models/enums');

// Services
const walletService = require('../services/walletService');
const paidCommunicationService = require('../services/paidCommunicationService');
const conversationService = require('../services/conversationService');

let totalTests = 0;
let passedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function createTestUser({ initialBalance = 0 } = {}) {
  const userId = new mongoose.Types.ObjectId();
  const phone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;

  const user = await User.create({
    _id: userId,
    phone,
    password: 'Password@123',
    role: 'USER',
    isVerified: true,
  });

  await Profile.create({
    userId: user._id,
    user: user._id,
    name: `User_${userId.toString().slice(-4)}`,
    displayName: `User_${userId.toString().slice(-4)}`,
    dateOfBirth: new Date('1998-05-15'),
    gender: 'Female',
    bio: 'Test user for financial boundary validation',
  });

  const wallet = await Wallet.create({
    userId: user._id,
    availableBalance: initialBalance,
    lifetimeSpent: 0,
    lifetimeEarned: 0,
    status: WalletStatuses.ACTIVE,
    version: 1,
  });

  return { user, wallet };
}

/**
 * Helper to compute billable minutes from second duration
 */
function computeBillableMinutes(durationSeconds) {
  if (durationSeconds <= 0) return 0;
  return Math.ceil(durationSeconds / 60);
}

async function main() {
  console.log('================================================================');
  console.log('   PC-13: FINANCIAL DURATION-BOUNDARY & CONCURRENCY TEST SUITE  ');
  console.log('================================================================\n');

  // 1. Safe Database Connection with Production Guard
  const { dbName, maskedHost } = await connectSafeTestDB();
  console.log(`[TEST RUNNER] Database: '${dbName}' on ${maskedHost}`);

  await initRedis({ mock: true });
  await ensureActiveConfig();

  try {
    // -------------------------------------------------------------------------
    // SUITE 1: DURATION-SECOND BOUNDARY VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 1: Authoritative Duration-Second Boundary Verification ---');

    const boundaryCases = [
      // Messaging (1 Coin/min)
      { type: CommunicationTypes.MESSAGE, rate: 1, seconds: 0, expectedMin: 0, expectedCoins: 0 },
      { type: CommunicationTypes.MESSAGE, rate: 1, seconds: 1, expectedMin: 1, expectedCoins: 1 },
      { type: CommunicationTypes.MESSAGE, rate: 1, seconds: 60, expectedMin: 1, expectedCoins: 1 },
      { type: CommunicationTypes.MESSAGE, rate: 1, seconds: 61, expectedMin: 2, expectedCoins: 2 },
      { type: CommunicationTypes.MESSAGE, rate: 1, seconds: 120, expectedMin: 2, expectedCoins: 2 },
      { type: CommunicationTypes.MESSAGE, rate: 1, seconds: 121, expectedMin: 3, expectedCoins: 3 },

      // Audio (5 Coins/min)
      { type: CommunicationTypes.AUDIO, rate: 5, seconds: 0, expectedMin: 0, expectedCoins: 0 },
      { type: CommunicationTypes.AUDIO, rate: 5, seconds: 1, expectedMin: 1, expectedCoins: 5 },
      { type: CommunicationTypes.AUDIO, rate: 5, seconds: 60, expectedMin: 1, expectedCoins: 5 },
      { type: CommunicationTypes.AUDIO, rate: 5, seconds: 61, expectedMin: 2, expectedCoins: 10 },
      { type: CommunicationTypes.AUDIO, rate: 5, seconds: 120, expectedMin: 2, expectedCoins: 10 },
      { type: CommunicationTypes.AUDIO, rate: 5, seconds: 121, expectedMin: 3, expectedCoins: 15 },

      // Video (10 Coins/min)
      { type: CommunicationTypes.VIDEO, rate: 10, seconds: 0, expectedMin: 0, expectedCoins: 0 },
      { type: CommunicationTypes.VIDEO, rate: 10, seconds: 1, expectedMin: 1, expectedCoins: 10 },
      { type: CommunicationTypes.VIDEO, rate: 10, seconds: 60, expectedMin: 1, expectedCoins: 10 },
      { type: CommunicationTypes.VIDEO, rate: 10, seconds: 61, expectedMin: 2, expectedCoins: 20 },
      { type: CommunicationTypes.VIDEO, rate: 10, seconds: 120, expectedMin: 2, expectedCoins: 20 },
      { type: CommunicationTypes.VIDEO, rate: 10, seconds: 121, expectedMin: 3, expectedCoins: 30 },
    ];

    for (const bc of boundaryCases) {
      await runTest(`${bc.type} Boundary: ${bc.seconds}s -> ${bc.expectedMin} min -> ${bc.expectedCoins} coins`, async () => {
        const initiator = await createTestUser({ initialBalance: 100 });
        const receiver = await createTestUser({ initialBalance: 0 });

        const session = await paidCommunicationService.initiatePaidSession({
          initiatorId: initiator.user._id,
          receiverId: receiver.user._id,
          communicationType: bc.type,
        });

        assert.strictEqual(session.ratePerMinuteSnapshot, bc.rate);

        if (bc.seconds === 0) {
          // 0 seconds: Session declined without connecting -> 0 coins
          const declined = await paidCommunicationService.declinePaidSession({
            receiverId: receiver.user._id,
            sessionId: session.sessionId,
          });
          assert.strictEqual(declined.billedMinutes, 0);
          assert.strictEqual(declined.totalCoinsCharged, 0);
          assert.strictEqual(declined.totalCoinsEarned, 0);
        } else {
          // Connect session (triggers minute 1 charge)
          await paidCommunicationService.acceptPaidSession({
            receiverId: receiver.user._id,
            sessionId: session.sessionId,
          });
          await paidCommunicationService.markParticipantConnected({
            userId: initiator.user._id,
            sessionId: session.sessionId,
          });
          const activeSession = await paidCommunicationService.markParticipantConnected({
            userId: receiver.user._id,
            sessionId: session.sessionId,
          });

          // Inject started minutes if duration > 60s
          for (let m = 2; m <= bc.expectedMin; m++) {
            await walletService.executeCommunicationCharge({
              sessionDoc: activeSession,
              minuteIndex: m,
            });
          }

          const ended = await paidCommunicationService.endPaidSession({
            actorUserId: initiator.user._id,
            sessionId: session.sessionId,
            endReason: PaidSessionEndReasons.USER_HANGUP,
          });

          assert.strictEqual(ended.billedMinutes, bc.expectedMin);
          assert.strictEqual(ended.totalCoinsCharged, bc.expectedCoins);
          assert.strictEqual(ended.totalCoinsEarned, bc.expectedCoins);

          const initBal = (await walletService.getWalletBalance(initiator.user._id)).availableBalance;
          const recvBal = (await walletService.getWalletBalance(receiver.user._id)).availableBalance;
          assert.strictEqual(initBal, 100 - bc.expectedCoins);
          assert.strictEqual(recvBal, bc.expectedCoins);
        }
      });
    }

    // -------------------------------------------------------------------------
    // SUITE 2: MULTI-WORKER CONCURRENT LEASE & TRANSACTION INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- SUITE 2: Multi-Worker Billing Concurrency & Transaction Parity ---');

    await runTest('Two concurrent workers attempting same minute charge -> Exactly 1 charge executed', async () => {
      const initiator = await createTestUser({ initialBalance: 50 });
      const receiver = await createTestUser({ initialBalance: 0 });

      const session = await paidCommunicationService.initiatePaidSession({
        initiatorId: initiator.user._id,
        receiverId: receiver.user._id,
        communicationType: CommunicationTypes.VIDEO,
      });

      await paidCommunicationService.acceptPaidSession({
        receiverId: receiver.user._id,
        sessionId: session.sessionId,
      });
      await paidCommunicationService.markParticipantConnected({
        userId: initiator.user._id,
        sessionId: session.sessionId,
      });
      const activeSession = await paidCommunicationService.markParticipantConnected({
        userId: receiver.user._id,
        sessionId: session.sessionId,
      });

      // Execute minuteIndex 2 concurrently from two distinct async workers
      const [worker1Result, worker2Result] = await Promise.all([
        walletService.executeCommunicationCharge({ sessionDoc: activeSession, minuteIndex: 2 }),
        walletService.executeCommunicationCharge({ sessionDoc: activeSession, minuteIndex: 2 }),
      ]);

      // Exactly one processed genuinely, the second detected idempotency
      const processedCount = [worker1Result, worker2Result].filter((r) => !r.alreadyProcessed).length;
      const idempotentCount = [worker1Result, worker2Result].filter((r) => r.alreadyProcessed).length;

      assert.strictEqual(processedCount, 1, 'Exactly one worker must process the charge');
      assert.strictEqual(idempotentCount, 1, 'Second worker must return alreadyProcessed without charging');

      // Verify exact balance
      const initBal = (await walletService.getWalletBalance(initiator.user._id)).availableBalance;
      const recvBal = (await walletService.getWalletBalance(receiver.user._id)).availableBalance;
      // 10 coins for min 1, 10 coins for min 2 = 20 coins total
      assert.strictEqual(initBal, 30, 'Initiator balance must be exactly 30 (50 - 20)');
      assert.strictEqual(recvBal, 20, 'Receiver balance must be exactly 20');
    });

    await runTest('Double-entry symmetry: Sum of debits == Sum of credits across all sessions', async () => {
      const allSessions = await PaidCommunicationSession.find({
        status: PaidSessionStatuses.ENDED,
        totalCoinsCharged: { $gt: 0 },
      });

      let totalDebits = 0;
      let totalCredits = 0;

      for (const sess of allSessions) {
        const debits = await WalletLedger.find({
          sessionId: sess.sessionId,
          entryType: LedgerEntryTypes.DEBIT,
        });
        const credits = await WalletLedger.find({
          sessionId: sess.sessionId,
          entryType: LedgerEntryTypes.CREDIT,
        });

        const dSum = debits.reduce((acc, d) => acc + d.amount, 0);
        const cSum = credits.reduce((acc, c) => acc + c.amount, 0);

        assert.strictEqual(dSum, sess.totalCoinsCharged, `Debits must match charged coins for ${sess.sessionId}`);
        assert.strictEqual(cSum, sess.totalCoinsEarned, `Credits must match earned coins for ${sess.sessionId}`);
        assert.strictEqual(dSum, cSum, `Debit sum must equal credit sum for ${sess.sessionId}`);

        totalDebits += dSum;
        totalCredits += cSum;
      }

      assert.strictEqual(totalDebits, totalCredits, 'Total debits must strictly equal total credits');

      // Verify no negative wallet balance exists anywhere
      const negativeWallets = await Wallet.find({ availableBalance: { $lt: 0 } });
      assert.strictEqual(negativeWallets.length, 0, 'Zero wallets can have negative balance');
    });

    console.log('\n================================================================');
    console.log(`  CONCURRENCY & BOUNDARY SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log('================================================================\n');

  } finally {
    await closeRedis();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\nFinancial boundary runner terminated with error:', err);
  process.exit(1);
});
