const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const testFiles = [
  'test/model_level_tests.js',
  'test/preference_tests.js',
  'test/location_tests.js',
  'test/eligibility_tests.js',
  'test/discovery_tests.js',
  'test/impression_tests.js',
  'test/pass_undo_tests.js',
  'test/like_tests.js',
  'test/incoming_likes_tests.js',
  'test/match_tests.js',
  'test/matches_list_authorization_tests.js',
  'test/safety_tests.js',
  'test/frontend_dating_integration_tests.js',
  'test/concurrency_security_audit_tests.js',
  'test/media_foundation_tests.js',
  'test/follow_graph_tests.js',
  'test/post_lifecycle_tests.js',
  'test/content_visibility_authorization_tests.js',
  'test/social_interaction_tests.js',
  'test/connected_feed_tests.js',
  'test/feed_impression_tests.js',
  'test/story_lifecycle_tests.js',
  'test/reel_playback_tests.js',
  'test/social_safety_moderation_tests.js',
  'test/social_notification_tests.js',
  'test/frontend_social_integration_tests.js',
  'test_all_endpoints.js',
];

console.log('================================================================================');
console.log('       RUBARU COMPLETE RESEARCH 1 & RESEARCH 2 MASTER TEST RUNNER & AUDIT       ');
console.log('================================================================================\n');

let grandTotalPassed = 0;
let grandTotalFailed = 0;
const results = [];
let fullRawOutput = '';

for (let i = 0; i < testFiles.length; i++) {
  const file = testFiles[i];
  const fullPath = path.join(__dirname, '..', file);
  console.log(`[SUITE ${i + 1}/${testFiles.length}] Executing: ${file}...`);

  const startTime = Date.now();
  try {
    const output = execSync(`node ${file}`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const elapsed = Date.now() - startTime;
    fullRawOutput += `\n--- [START OF TEST OUTPUT: ${file}] ---\n` + output + `\n--- [END OF TEST OUTPUT: ${file}] ---\n`;

    const passMatches = (output.match(/✅ \[PASS\]/g) || []).length;
    const failMatches = (output.match(/❌ \[FAIL\]/g) || []).length;

    grandTotalPassed += passMatches;
    grandTotalFailed += failMatches;

    results.push({
      file,
      passed: passMatches,
      failed: failMatches,
      elapsedMs: elapsed,
      status: failMatches === 0 ? 'PASS' : 'FAIL',
    });

    console.log(`  -> Result: ${passMatches} Passed, ${failMatches} Failed (${elapsed}ms)\n`);
  } catch (err) {
    const elapsed = Date.now() - startTime;
    const errOutput = (err.stdout || '') + '\n' + (err.stderr || '') + '\n' + err.message;
    fullRawOutput += `\n--- [START OF FAILED TEST OUTPUT: ${file}] ---\n` + errOutput + `\n--- [END OF FAILED TEST OUTPUT: ${file}] ---\n`;

    const passMatches = (errOutput.match(/✅ \[PASS\]/g) || []).length;
    const failMatches = (errOutput.match(/❌ \[FAIL\]/g) || []).length || 1;

    grandTotalPassed += passMatches;
    grandTotalFailed += failMatches;

    results.push({
      file,
      passed: passMatches,
      failed: failMatches,
      elapsedMs: elapsed,
      status: 'FAIL',
      error: err.message,
    });

    console.log(`  -> FAILED: ${passMatches} Passed, ${failMatches} Failed (${elapsed}ms)\n`);
  }
}

console.log('================================================================================');
console.log('                         EXACT ARITHMETIC BREAKDOWN                              ');
console.log('================================================================================');
console.table(results);

console.log(`\nGRAND TOTAL ASSERTIONS EXECUTED: ${grandTotalPassed + grandTotalFailed}`);
console.log(`TOTAL PASSED: ${grandTotalPassed}`);
console.log(`TOTAL FAILED: ${grandTotalFailed}`);
console.log(`SUCCESS RATE: ${((grandTotalPassed / (grandTotalPassed + grandTotalFailed)) * 100).toFixed(2)}%`);
console.log('================================================================================\n');

// Write raw output to file for absolute evidence audit
fs.writeFileSync(path.join(__dirname, '..', 'RAW_TEST_OUTPUT.log'), fullRawOutput);
console.log('[EVIDENCE] Written raw test execution log to RAW_TEST_OUTPUT.log');
