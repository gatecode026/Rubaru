#!/usr/bin/env node

require('dotenv').config();
const callingConfig = require('../config/callingConfig');

function runDiagnostic() {
  console.log('================================================================================');
  console.log('   RUBARU CALLING: CONFIGURATION & ENVIRONMENT DIAGNOSTIC TOOL                  ');
  console.log('================================================================================\n');

  const report = callingConfig.validateConfig();

  console.log('1. ENVIRONMENT SUMMARY:');
  console.log(`   - Mode:                     ${report.summary.environment}`);
  console.log(`   - Min App Version:          ${report.summary.minAppVersion}`);
  console.log(`   - Audio Rate:               ${report.summary.audioRatePerMinute} coins/min`);
  console.log(`   - Video Rate:               ${report.summary.videoRatePerMinute} coins/min`);
  console.log(`   - Ring Timeout:             ${report.summary.ringTimeoutSeconds}s`);
  console.log(`   - Reconnect Grace:          ${report.summary.reconnectGraceSeconds}s`);
  console.log(`   - STUN Server Endpoints:    ${report.summary.stunUrlsCount} configured`);
  console.log(`   - TURN Server Endpoints:    ${report.summary.turnUrlsCount} configured`);
  console.log(`   - Push Provider:            ${report.summary.pushProvider}`);
  console.log(`   - FCM Credentials:          ${report.summary.fcmConfigured ? 'CONFIGURED' : 'NOT_FOUND'}`);
  console.log(`   - APNs Credentials:         ${report.summary.apnsConfigured ? 'CONFIGURED' : 'NOT_FOUND'}\n`);

  if (report.warnings.length > 0) {
    console.log('2. WARNINGS:');
    report.warnings.forEach((w) => console.log(`   [!] ${w}`));
    console.log('');
  }

  if (report.errors.length > 0) {
    console.log('3. CRITICAL ERRORS:');
    report.errors.forEach((e) => console.log(`   [X] ${e}`));
    console.log('\nResult: CONFIGURATION INVALID');
    process.exit(1);
  } else {
    console.log('Result: CONFIGURATION VALID & READY');
    process.exit(0);
  }
}

runDiagnostic();
