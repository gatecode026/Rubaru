require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const {
  WalletStatuses,
  LedgerEntryTypes,
  LedgerTransactionTypes,
} = require('../models/enums');

async function runMigration() {
  console.log('================================================================================');
  console.log('   MIGRATION 001: INITIALIZE RUBARU PAID COMMUNICATION & WALLET FOUNDATION      ');
  console.log('================================================================================\n');

  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  // 1. Ensure/Sync Indexes
  console.log('[STEP 1] Ensuring MongoDB Schema Indexes...');
  await PaidCommunicationConfig.syncIndexes();
  await Wallet.syncIndexes();
  await WalletLedger.syncIndexes();
  await PaidCommunicationSession.syncIndexes();
  console.log('  -> All schema indexes verified and synchronized.');

  // 2. Seed Initial Active Rate Configuration Idempotently
  console.log('\n[STEP 2] Seeding Initial Rate Configuration...');
  const existingConfig = await PaidCommunicationConfig.findOne({ version: 1 });
  if (!existingConfig) {
    const initialConfig = await PaidCommunicationConfig.create({
      version: 1,
      isActive: true,
      rates: {
        MESSAGE: 1,
        AUDIO: 5,
        VIDEO: 10,
      },
      billingIncrementSeconds: 60,
      connectionGraceSeconds: 15,
      heartbeatIntervalSeconds: 10,
      heartbeatTimeoutSeconds: 30,
      requestExpirationSeconds: 60,
      enabled: {
        MESSAGE: true,
        AUDIO: false, // Explicitly disabled until WebRTC verified
        VIDEO: false, // Explicitly disabled until WebRTC verified
      },
    });
    console.log(`  -> Initial Rate Config v1 created successfully (ID: ${initialConfig._id}).`);
  } else {
    console.log('  -> Rate Config v1 already exists. Preserving configuration.');
  }

  // 3. Idempotently Migrate Existing Users' Balances
  console.log('\n[STEP 3] Idempotently Migrating Existing User Balances to Wallet & Ledger...');
  const users = await User.find({}).lean();
  console.log(`  -> Found ${users.length} users to inspect.`);

  let createdWalletsCount = 0;
  let skippedWalletsCount = 0;

  for (const user of users) {
    const existingWallet = await Wallet.findOne({ userId: user._id });
    if (!existingWallet) {
      const initialBalance = Number.isInteger(user.points) && user.points >= 0 ? user.points : 0;
      const transactionId = uuidv4();

      const wallet = await Wallet.create({
        userId: user._id,
        availableBalance: initialBalance,
        lifetimeEarned: initialBalance,
        lifetimeSpent: 0,
        status: WalletStatuses.ACTIVE,
        version: 0,
      });

      if (initialBalance > 0) {
        await WalletLedger.create({
          transactionId,
          walletId: wallet._id,
          userId: user._id,
          entryType: LedgerEntryTypes.CREDIT,
          transactionType: LedgerTransactionTypes.INITIAL_MIGRATION,
          amount: initialBalance,
          balanceBefore: 0,
          balanceAfter: initialBalance,
          idempotencyKey: `migration-initial-credit:${user._id}`,
          metadata: {
            reason: 'Migrated from legacy user points field',
            migratedAt: new Date(),
          },
        });
      }

      createdWalletsCount++;
    } else {
      skippedWalletsCount++;
    }
  }

  console.log(`  -> Migration summary: ${createdWalletsCount} wallets created, ${skippedWalletsCount} already existed.`);
  console.log('\n================================================================================');
  console.log('   MIGRATION 001 COMPLETED SUCCESSFULLY                                         ');
  console.log('================================================================================\n');
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration script finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigration;
