#!/usr/bin/env node

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const reconciliationService = require('../services/callBillingReconciliationService');

async function run() {
  console.log('================================================================================');
  console.log('   RUBARU CALLING: BILLING & LEDGER RECONCILIATION AUDIT (READ-ONLY)            ');
  console.log('================================================================================\n');

  await connectDB();

  try {
    const result = await reconciliationService.runReconciliationScan({ limit: 500 });

    console.log('RECONCILIATION AUDIT RESULTS:');
    console.log(`   - Sessions Audited:         ${result.totalChecked}`);
    console.log(`   - Reconciled (100% Match):  ${result.reconciledCount}`);
    console.log(`   - Discrepancies Detected:   ${result.discrepancyCount}`);
    console.log(`   - Fully Reconciled:         ${result.isFullyReconciled ? 'YES' : 'NO'}\n`);

    if (result.discrepancies.length > 0) {
      console.log('DISCREPANCY DETAILS:');
      result.discrepancies.forEach((d, idx) => {
        console.log(`   [#${idx + 1}] Session: ${d.sessionId} (Status: ${d.status})`);
        d.issues.forEach((iss) => console.log(`       - ${iss}`));
      });
      console.log('');
    }

    if (result.isFullyReconciled) {
      console.log('Verdict: BILLING DATA 100% RECONCILED WITH LEDGER');
      process.exit(0);
    } else {
      console.log('Verdict: DISCREPANCIES DETECTED');
      process.exit(1);
    }
  } catch (err) {
    console.error('Reconciliation error:', err.message);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

run();
