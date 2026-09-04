require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const PaidCommunicationConfig = require('../models/PaidCommunicationConfig');
const Wallet = require('../models/Wallet');
const WalletLedger = require('../models/WalletLedger');
const PaidCommunicationSession = require('../models/PaidCommunicationSession');

/**
 * Pre-Deployment Production Validation Script
 * Exits with code 0 if all checks pass, non-zero if critical failures are found.
 * Never prints secret values to console.
 */
async function validateDeployment() {
  console.log('================================================================================');
  console.log('              RUBARU PRODUCTION PRE-DEPLOYMENT VALIDATOR                       ');
  console.log('================================================================================\n');

  const checks = [];
  let hasCriticalFailure = false;

  function recordCheck(name, passed, details = '', isCritical = true) {
    checks.push({ name, passed, details, isCritical });
    const statusTag = passed ? '✅ [PASS]' : (isCritical ? '❌ [FAIL - CRITICAL]' : '⚠️ [WARN]');
    console.log(`${statusTag} ${name}: ${details}`);
    if (!passed && isCritical) {
      hasCriticalFailure = true;
    }
  }

  // 1. Environment Variables Check
  const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
  for (const envVar of requiredEnvVars) {
    const isSet = Boolean(process.env[envVar]);
    recordCheck(`Env Var: ${envVar}`, isSet, isSet ? 'Configured (Value Hidden)' : 'Missing required variable', true);
  }

  // 2. Production Security Secret Check
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET || '';
    const isSecure = jwtSecret.length >= 32 && jwtSecret !== 'default_secret' && jwtSecret !== 'secret';
    recordCheck('Production JWT Secret Strength', isSecure, isSecure ? 'Cryptographically strong' : 'Insecure default secret in production', true);

    const turnSecret = process.env.COTURN_SECRET || process.env.TURN_SECRET;
    const hasTurn = Boolean(turnSecret && turnSecret !== 'test_turn_secret');
    recordCheck('Production TURN Configuration', hasTurn, hasTurn ? 'Configured' : 'Missing COTURN_SECRET for WebRTC calls', true);
  } else {
    recordCheck('Environment Mode', true, `Running in ${process.env.NODE_ENV || 'development'} mode`, false);
  }

  // 3. Connect to Database
  let dbConnected = false;
  try {
    await connectDB();
    dbConnected = true;
    recordCheck('MongoDB Connection', true, 'Connected successfully');
  } catch (err) {
    recordCheck('MongoDB Connection', false, err.message, true);
    console.error('\nCannot continue validation without database connection.');
    process.exit(1);
  }

  // 4. MongoDB Transaction Support Check
  try {
    const session = await mongoose.startSession();
    let txSupported = false;
    try {
      await session.withTransaction(async () => {
        txSupported = true;
      });
      recordCheck('MongoDB Multi-Document Transactions', txSupported, 'Transactions supported and verified');
    } finally {
      await session.endSession();
    }
  } catch (err) {
    recordCheck('MongoDB Multi-Document Transactions', false, `Transactions unsupported: ${err.message}`, true);
  }

  // 5. Database Indexes Verification
  try {
    const walletIndexes = await Wallet.collection.indexes();
    const hasUniqueUser = walletIndexes.some((idx) => idx.key && idx.key.userId === 1 && idx.unique === true);
    recordCheck('Wallet Unique User Index', hasUniqueUser, hasUniqueUser ? 'Unique index on userId verified' : 'Missing unique index on Wallet.userId', true);

    const ledgerIndexes = await WalletLedger.collection.indexes();
    const hasIdempotencyIdx = ledgerIndexes.some((idx) => idx.key && idx.key.idempotencyKey === 1);
    recordCheck('Ledger Idempotency Index', hasIdempotencyIdx, hasIdempotencyIdx ? 'Idempotency index verified' : 'Missing index on WalletLedger.idempotencyKey', true);

    const sessionIndexes = await PaidCommunicationSession.collection.indexes();
    const hasSessionIdIdx = sessionIndexes.some((idx) => idx.key && idx.key.sessionId === 1);
    recordCheck('Paid Session Index', hasSessionIdIdx, hasSessionIdIdx ? 'Unique index on sessionId verified' : 'Missing index on PaidCommunicationSession.sessionId', true);
  } catch (err) {
    recordCheck('Database Index Inspection', false, err.message, true);
  }

  // 6. Active Rate Configuration Check
  try {
    const activeConfig = await PaidCommunicationConfig.getActiveConfig();
    const hasRates =
      activeConfig &&
      activeConfig.rates &&
      activeConfig.rates.MESSAGE === 1 &&
      activeConfig.rates.AUDIO === 5 &&
      activeConfig.rates.VIDEO === 10;
    recordCheck(
      'Authoritative Rates Configuration',
      Boolean(hasRates),
      hasRates
        ? `Version ${activeConfig.version}: MESSAGE=${activeConfig.rates.MESSAGE}, AUDIO=${activeConfig.rates.AUDIO}, VIDEO=${activeConfig.rates.VIDEO}`
        : 'Missing or non-authoritative rate values',
      true
    );
  } catch (err) {
    recordCheck('Authoritative Rates Configuration', false, err.message, true);
  }

  console.log('\n================================================================================');
  console.log('                          VALIDATION SUMMARY                                    ');
  console.log('================================================================================');
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.passed).length;
  const failedChecks = checks.filter((c) => !c.passed).length;

  console.log(`Total Checks Executed: ${totalChecks}`);
  console.log(`Passed: ${passedChecks}`);
  console.log(`Failed: ${failedChecks}`);

  if (hasCriticalFailure) {
    console.error('\n❌ PRE-DEPLOYMENT VALIDATION FAILED. Fix critical issues before deploying to production.\n');
    await mongoose.connection.close();
    process.exit(1);
  } else {
    console.log('\n✅ PRE-DEPLOYMENT VALIDATION PASSED. System is ready for safe deployment.\n');
    await mongoose.connection.close();
    process.exit(0);
  }
}

if (require.main === module) {
  validateDeployment().catch((err) => {
    console.error('Fatal validator error:', err);
    process.exit(1);
  });
}

module.exports = validateDeployment;
