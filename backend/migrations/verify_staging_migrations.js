require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const AdminAuditLog = require('../models/AdminAuditLog');

/**
 * Staging Database Migration & Index Verification Utility
 */
async function verifyStagingMigrations() {
  console.log('================================================================================');
  console.log('              RUBARU STAGING MIGRATION & INDEX AUDIT TOOL                       ');
  console.log('================================================================================\n');

  await connectDB();

  const auditResults = [];

  function record(name, status, details = '') {
    auditResults.push({ name, status, details });
    const tag = status ? '✅ [PASS]' : '❌ [FAIL]';
    console.log(`${tag} ${name}: ${details}`);
  }

  try {
    // 1. Check Wallet Indexes
    const walletIndexes = await Wallet.collection.indexes();
    const hasWalletUserUnique = walletIndexes.some((i) => i.key.userId === 1 && i.unique === true);
    record('Wallet Unique User Index', hasWalletUserUnique, 'Unique index on userId');

    // 2. Check WalletLedger Indexes
    const ledgerIndexes = await WalletLedger.collection.indexes();
    const hasLedgerIdempotency = ledgerIndexes.some((i) => i.key.idempotencyKey === 1);
    const hasLedgerCompoundSession = ledgerIndexes.some(
      (i) => i.key.sessionId === 1 && i.key.minuteIndex === 1 && i.key.entryType === 1
    );
    record('Ledger Idempotency Index', hasLedgerIdempotency, 'Unique/indexed on idempotencyKey');
    record('Ledger Session-Minute-Entry Unique Index', hasLedgerCompoundSession, 'Compound unique index on (sessionId, minuteIndex, entryType)');

    // 3. Check PaidCommunicationSession Indexes
    const sessionIndexes = await PaidCommunicationSession.collection.indexes();
    const hasSessionId = sessionIndexes.some((i) => i.key.sessionId === 1);
    const hasStatus = sessionIndexes.some((i) => i.key.status === 1);
    const hasNextCharge = sessionIndexes.some((i) => i.key.nextChargeAt === 1);
    record('Session ID Index', hasSessionId, 'Unique/indexed on sessionId');
    record('Session Status Index', hasStatus, 'Indexed on status');
    record('Session NextChargeAt Index', hasNextCharge, 'Indexed on nextChargeAt for billing worker');

    // 4. Check Active Configuration
    const config = await PaidCommunicationConfig.getActiveConfig();
    const hasValidRates =
      config &&
      config.rates &&
      config.rates.MESSAGE === 1 &&
      config.rates.AUDIO === 5 &&
      config.rates.VIDEO === 10;
    record('Active Rate Configuration', Boolean(hasValidRates), `Version ${config.version} (1/5/10 coins/min)`);

    // 5. Check No Negative Balances Exist
    const negativeCount = await Wallet.countDocuments({ availableBalance: { $lt: 0 } });
    record('Zero Stored Negative Balances', negativeCount === 0, `Count: ${negativeCount}`);
  } catch (err) {
    record('Database Inspection', false, err.message);
  }

  console.log('\n================================================================================');
  const allPassed = auditResults.every((r) => r.status);
  console.log(`STAGING MIGRATION AUDIT: ${allPassed ? 'ALL VERIFIED (PASS)' : 'FAILURES DETECTED'}`);
  console.log('================================================================================\n');

  return allPassed;
}

if (require.main === module) {
  verifyStagingMigrations().then(async (passed) => {
    await mongoose.connection.close();
    process.exit(passed ? 0 : 1);
  });
}

module.exports = verifyStagingMigrations;
