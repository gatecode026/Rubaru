const assert = require('assert');
const { initRedis, getRedisHealth } = require('../config/redis');
const pushAdapter = require('../services/pushAdapter');
const turnService = require('../services/turnService');
const { getSafeTestMongoUri } = require('../config/testDbGuard');

/**
 * PC-13: Production Fail-Closed & Mock Elimination Test Suite
 * Proves that production environment strictly forbids in-memory mocks,
 * fails readiness on missing infrastructure, and enforces database protection guards.
 */

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
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

async function runSuite() {
  console.log('================================================================');
  console.log('   PC-13: PRODUCTION FAIL-CLOSED & MOCK ELIMINATION TESTS       ');
  console.log('================================================================\n');

  // Save original environment
  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // 1. Database Protection & Safety Guard Verification
    // -------------------------------------------------------------------------
    console.log('--- 1. Database Protection & Safety Guard ---');

    await test('Direct connection to production database name is intercepted and guarded', async () => {
      // Trying to target production URI: .../dating_app
      const prodUri = 'mongodb+srv://user:pass@cluster0.1meot8l.mongodb.net/dating_app?retryWrites=true';
      const safeTarget = getSafeTestMongoUri(prodUri);

      assert.strictEqual(safeTarget.dbName, 'dating_app_test', 'Must rewrite production target to isolated test database');
      assert.ok(safeTarget.uri.includes('/dating_app_test?'), 'Safe URI must target test database');
      assert.ok(!safeTarget.maskedHost.includes('pass'), 'Masked host must never leak password');
    });

    await test('Unidentified non-test database name throws fatal safety error', async () => {
      const unsafeUri = 'mongodb+srv://user:pass@cluster0.1meot8l.mongodb.net/customer_production_data';
      assert.throws(
        () => getSafeTestMongoUri(unsafeUri),
        /TEST_DB_SAFETY_VIOLATION/i,
        'Must abort execution when database name does not end with _test or match allowlist'
      );
    });

    // -------------------------------------------------------------------------
    // 2. Redis Production Mock Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Redis Production Mock Rejection & Readiness Failure ---');

    await test('Production mode rejects mock Redis initialization', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_MOCK_REDIS = 'true';

      await assert.rejects(
        async () => {
          await initRedis({ mock: true });
        },
        /PRODUCTION_REDIS_MOCK_FORBIDDEN/i,
        'Must reject mock Redis in production mode'
      );
    });

    await test('Production mode without Redis connection fails startup and readiness', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_MOCK_REDIS;
      process.env.REDIS_URL = 'redis://127.0.0.1:63799'; // Non-existent port
      process.env.REDIS_REQUIRED = 'true';

      await assert.rejects(
        async () => {
          await initRedis({ connectTimeout: 500, maxRetriesPerRequest: 0 });
        },
        /REDIS_REQUIRED_STARTUP_FAILURE/i,
        'Production must fail startup when real Redis is down'
      );

      const health = getRedisHealth();
      assert.strictEqual(health.distributedReady, false);
    });

    // -------------------------------------------------------------------------
    // 3. Push Provider (FCM / APNs) Production Fail-Closed
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Push Provider Production Fail-Closed ---');

    await test('Production mode without real FCM credentials fails closed (no fake success)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
      delete process.env.APNS_KEY_ID;

      const dummyDevice = {
        pushToken: 'sample_android_fcm_token_12345',
        platform: 'ANDROID',
        installationId: 'inst-test-01',
      };

      const result = await pushAdapter._dispatchToDevice(dummyDevice, {
        title: 'Test',
        body: 'Test Notification',
      });

      assert.strictEqual(result.success, false, 'Must not report fake success in production');
      assert.strictEqual(result.error, 'PRODUCTION_PUSH_PROVIDER_UNCONFIGURED');
    });

    await test('Production mode without real APNs VoIP credentials fails closed', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.APNS_KEY_ID;
      delete process.env.APNS_TEAM_ID;

      const dummyDevice = {
        voipPushToken: 'sample_ios_voip_token_12345',
        platform: 'IOS',
        installationId: 'inst-test-ios',
      };

      const result = await pushAdapter._dispatchCallPush(dummyDevice, { sessionId: 'test_call' }, true);
      assert.strictEqual(result.success, false, 'Must not report fake success for APNs VoIP');
      assert.strictEqual(result.error, 'PRODUCTION_PUSH_PROVIDER_UNCONFIGURED');
    });

    // -------------------------------------------------------------------------
    // 4. TURN Server Production Fail-Closed
    // -------------------------------------------------------------------------
    console.log('\n--- 4. TURN Server Production Fail-Closed ---');

    await test('Production mode without real COTURN_SECRET fails closed', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.COTURN_SECRET;
      delete process.env.TURN_SECRET;

      assert.throws(
        () => turnService.generateTurnCredentials('test_user'),
        /PRODUCTION_TURN_UNAVAILABLE/i,
        'Must throw error when TURN secret is missing in production'
      );
    });

    console.log('\n================================================================');
    console.log(`  FAIL-CLOSED SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
    console.log('================================================================\n');

  } finally {
    // Restore environment
    process.env = originalEnv;
  }
}

runSuite().catch((err) => {
  console.error('\nFail-closed test runner terminated with error:', err);
  process.exit(1);
});
