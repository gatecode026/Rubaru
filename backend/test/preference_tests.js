require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Models & Services
const User = require('../models/User');
const DatingPreference = require('../models/DatingPreference');
const preferenceService = require('../services/preferenceService');
const { Genders, DatingIntentions } = require('../models/enums');

// Routes
const datingRoutes = require('../routes/datingRoutes');
const authRoutes = require('../routes/authRoutes');
const profileRoutes = require('../routes/profileRoutes');

async function runPreferenceTests() {
  console.log('===========================================================');
  console.log('      RUBARU DATING PREFERENCES INTEGRATION TEST SUITE     ');
  console.log('===========================================================\n');

  await connectDB();

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // Setup test Express server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/v1/dating', datingRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profileRoutes);

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  // Helper function to create a test user and JWT token
  const testEmail = `pref_test_${Date.now()}@rubaru.app`;
  const testUser = await User.create({
    email: testEmail,
    password: 'hashed_password_123',
    isActive: true,
    accountStatus: 'ACTIVE',
  });

  const testToken = jwt.sign({ id: testUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const authHeaders = {
    Authorization: `Bearer ${testToken}`,
    'Content-Type': 'application/json',
  };

  try {
    // -------------------------------------------------------------
    // 1. Service Layer Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Preference Service Tests ---');

    // 1.1 First GET initializes approved defaults
    const initialPrefs = await preferenceService.getPreferences(testUser._id);
    assert(initialPrefs.preferences.version === 1, 'Initial getPreferences returns version 1 defaults');
    assert(initialPrefs.preferences.minimumAge === 21, 'Initial minimumAge is 21');
    assert(initialPrefs.preferences.maximumAge === 35, 'Initial maximumAge is 35');
    assert(initialPrefs.preferences.dealbreakers.gender === true, 'Gender preference dealbreaker is true');

    // 1.2 Valid partial update increments version
    const updated1 = await preferenceService.updatePreferences(testUser._id, {
      minimumAge: 23,
      maximumAge: 32,
      maximumDistance: 40,
    });
    assert(updated1.preferences.version === 2, 'Meaningful partial update increments version to 2');
    assert(updated1.preferences.minimumAge === 23, 'Minimum age successfully updated to 23');
    assert(updated1.preferences.maximumAge === 32, 'Maximum age successfully updated to 32');
    assert(updated1.preferences.maximumDistance === 40, 'Maximum distance successfully updated to 40 km');

    // 1.3 No-op update does not increment version
    const noOpResult = await preferenceService.updatePreferences(testUser._id, {
      minimumAge: 23,
      maximumAge: 32,
    });
    assert(noOpResult.preferences.version === 2, 'No-op update retains version 2 without unnecessary increment');

    // 1.4 Invalid age range (min > max) throws error
    try {
      await preferenceService.updatePreferences(testUser._id, {
        minimumAge: 35,
        maximumAge: 20,
      });
      assert(false, 'Invalid age range (min > max) should throw');
    } catch (err) {
      assert(err.code === 'INVALID_AGE_RANGE', 'Invalid age range (min > max) throws INVALID_AGE_RANGE');
    }

    // 1.5 Invalid distance throws error
    try {
      await preferenceService.updatePreferences(testUser._id, {
        maximumDistance: 999,
      });
      assert(false, 'Invalid distance > 500 km should throw');
    } catch (err) {
      assert(err.code === 'INVALID_DISTANCE', 'Invalid distance (> 500 km) throws INVALID_DISTANCE');
    }

    // 1.6 Invalid gender enum throws error
    try {
      await preferenceService.updatePreferences(testUser._id, {
        preferredGenders: ['Alien', 'Martian'],
      });
      assert(false, 'Invalid gender enum should throw');
    } catch (err) {
      assert(err.code === 'INVALID_PREFERENCE_VALUE', 'Invalid gender enum throws INVALID_PREFERENCE_VALUE');
    }

    // 1.7 Optimistic concurrency version conflict throws 409
    try {
      await preferenceService.updatePreferences(testUser._id, {
        minimumAge: 24,
        expectedVersion: 1, // Stored version is 2
      });
      assert(false, 'Stale expectedVersion should throw');
    } catch (err) {
      assert(err.code === 'PREFERENCE_VERSION_CONFLICT', 'Stale expectedVersion throws PREFERENCE_VERSION_CONFLICT (409)');
      assert(err.statusCode === 409, 'Conflict returns HTTP 409 status code');
    }

    // -------------------------------------------------------------
    // 2. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. HTTP REST API Endpoint Tests ---');

    // 2.1 Unauthenticated GET /v1/dating/preferences returns 401
    const unauthGetRes = await fetch(`${BASE_URL}/v1/dating/preferences`);
    assert(unauthGetRes.status === 401, 'Unauthenticated GET /v1/dating/preferences returns 401');

    // 2.2 Unauthenticated PATCH /v1/dating/preferences returns 401
    const unauthPatchRes = await fetch(`${BASE_URL}/v1/dating/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minimumAge: 25 }),
    });
    assert(unauthPatchRes.status === 401, 'Unauthenticated PATCH /v1/dating/preferences returns 401');

    // 2.3 Authenticated GET /v1/dating/preferences returns 200 OK
    const authGetRes = await fetch(`${BASE_URL}/v1/dating/preferences`, {
      headers: authHeaders,
    });
    const authGetData = await authGetRes.json();
    assert(authGetRes.status === 200, 'Authenticated GET /v1/dating/preferences returns 200 OK');
    assert(authGetData.success === true, 'Response contains success: true envelope');
    assert(authGetData.data.preferences.version === 2, 'Response returns current version 2');
    assert(!authGetData.data.preferences._id, 'Database internal _id is excluded from DTO');

    // 2.4 Authenticated PATCH /v1/dating/preferences returns 200 OK
    const authPatchRes = await fetch(`${BASE_URL}/v1/dating/preferences`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        preferredGenders: ['Female', 'Non-Binary'],
        minimumAge: 22,
        maximumAge: 28,
        distance: '30 km', // String distance from frontend filter
        datingIntentions: ['LONG_TERM', 'LONG_TERM_OPEN_TO_SHORT'],
        dealbreakers: { age: true, distance: false },
        expectedVersion: 2,
      }),
    });
    const authPatchData = await authPatchRes.json();
    assert(authPatchRes.status === 200, 'Authenticated PATCH /v1/dating/preferences returns 200 OK');
    assert(authPatchData.data.preferences.version === 3, 'PATCH increments version from 2 to 3');
    assert(authPatchData.data.preferences.maximumDistance === 30, 'Normalized "30 km" string to 30 integer');
    assert(authPatchData.data.preferences.dealbreakers.distance === false, 'Updated dealbreaker distance to false');

    // 2.5 Validation error returns 400 Bad Request
    const badPatchRes = await fetch(`${BASE_URL}/v1/dating/preferences`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        minimumAge: 50,
        maximumAge: 20,
      }),
    });
    const badPatchData = await badPatchRes.json();
    assert(badPatchRes.status === 400, 'Invalid age range in PATCH returns 400 Bad Request');
    assert(badPatchData.error.code === 'INVALID_AGE_RANGE', 'Error response returns code INVALID_AGE_RANGE');

    // 2.6 Version conflict in PATCH returns 409 Conflict
    const conflictPatchRes = await fetch(`${BASE_URL}/v1/dating/preferences`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        minimumAge: 22,
        expectedVersion: 1, // Stored version is 3
      }),
    });
    const conflictPatchData = await conflictPatchRes.json();
    assert(conflictPatchRes.status === 409, 'Version mismatch in PATCH returns 409 Conflict');
    assert(conflictPatchData.error.code === 'PREFERENCE_VERSION_CONFLICT', 'Error response returns code PREFERENCE_VERSION_CONFLICT');

    console.log('\n===========================================================');
    console.log(`PREFERENCE TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runPreferenceTests();
}

module.exports = runPreferenceTests;
