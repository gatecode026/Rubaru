require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const RecommendationBatch = require('../models/RecommendationBatch');
const ProfileImpression = require('../models/ProfileImpression');
const DatingInteraction = require('../models/DatingInteraction');
const OutboxEvent = require('../models/OutboxEvent');

// Services & Routes
const impressionService = require('../services/impressionService');
const discoveryRoutes = require('../routes/discoveryRoutes');
const { evaluateCandidate, HardExclusionReasons } = require('../services/eligibilityPolicy');

async function runImpressionTests() {
  console.log('===========================================================');
  console.log('     RUBARU PROFILE IMPRESSIONS INTEGRATION TEST SUITE     ');
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
  app.use('/v1/discovery', discoveryRoutes);

  const TEST_PORT = 5095;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // Create Viewer and Candidate users
    const viewerUser = await User.create({ email: `v_imp_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand1User = await User.create({ email: `c1_imp_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand2User = await User.create({ email: `c2_imp_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const otherUser = await User.create({ email: `other_imp_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });

    // Viewer profiles and preferences
    await DatingProfile.create({ user: viewerUser._id, displayName: 'Viewer', dateOfBirth: dob, age: 26, gender: 'Male', isDiscoverable: true });
    await DatingPreference.create({ user: viewerUser._id, genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: viewerUser._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });

    // Candidate 1
    await DatingProfile.create({ user: cand1User._id, displayName: 'Cand 1', dateOfBirth: dob, age: 24, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand1User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand1User._id, location: { type: 'Point', coordinates: [75.79, 26.92] } });

    // Candidate 2
    await DatingProfile.create({ user: cand2User._id, displayName: 'Cand 2', dateOfBirth: dob, age: 25, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand2User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand2User._id, location: { type: 'Point', coordinates: [75.80, 26.93] } });

    const viewerToken = jwt.sign({ id: viewerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = {
      Authorization: `Bearer ${viewerToken}`,
      'Content-Type': 'application/json',
    };

    // Create an active RecommendationBatch
    const batchId = `batch_imp_test_${timestamp}`;
    await RecommendationBatch.create({
      batchId,
      viewer: viewerUser._id,
      candidates: [cand1User._id, cand2User._id],
      preferenceVersion: 1,
      locationVersion: 1,
      rankingConfigVersion: 'v1.0-mvp',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour expiry
    });

    const recId1 = `rec_${batchId}_${cand1User._id}`;
    const recId2 = `rec_${batchId}_${cand2User._id}`;

    // -------------------------------------------------------------
    // 1. Validation & Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Validation & Security Tests ---');

    // 1.1 Missing batchId throws error
    try {
      await impressionService.recordConfirmedImpressions(viewerUser._id, {
        impressions: [{ recommendationId: recId1, visibleAt: new Date() }],
      });
      assert(false, 'Missing batchId should throw');
    } catch (err) {
      assert(err.code === 'INVALID_IMPRESSION_REQUEST', 'Missing batchId throws INVALID_IMPRESSION_REQUEST');
    }

    // 1.2 Empty impressions array throws error
    try {
      await impressionService.recordConfirmedImpressions(viewerUser._id, {
        batchId,
        impressions: [],
      });
      assert(false, 'Empty impressions array should throw');
    } catch (err) {
      assert(err.code === 'INVALID_IMPRESSION_REQUEST', 'Empty impressions array throws INVALID_IMPRESSION_REQUEST');
    }

    // 1.3 Batch ownership violation throws 403
    try {
      await impressionService.recordConfirmedImpressions(otherUser._id, {
        batchId, // Belongs to viewerUser, not otherUser
        impressions: [{ recommendationId: recId1, visibleAt: new Date() }],
      });
      assert(false, 'Submitting another user batch should throw');
    } catch (err) {
      assert(err.code === 'RECOMMENDATION_OWNERSHIP_INVALID', 'Batch ownership mismatch throws RECOMMENDATION_OWNERSHIP_INVALID (403)');
    }

    // -------------------------------------------------------------
    // 2. Idempotency & Deduplication Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Idempotency & Deduplication Tests ---');

    // 2.1 First submission accepts 2 items
    const firstSubmission = await impressionService.recordConfirmedImpressions(viewerUser._id, {
      batchId,
      impressions: [
        { recommendationId: recId1, visibleAt: new Date(), visibleDurationMs: 1500, position: 0 },
        { recommendationId: recId2, visibleAt: new Date(), visibleDurationMs: 2200, position: 1 },
      ],
    });
    assert(firstSubmission.accepted === 2, 'First submission accepts 2 impressions');
    assert(firstSubmission.duplicates === 0, 'First submission has 0 duplicates');
    assert(firstSubmission.rejected === 0, 'First submission has 0 rejected');

    // 2.2 Immediate resubmission of same batch marks them as duplicates (idempotent)
    const secondSubmission = await impressionService.recordConfirmedImpressions(viewerUser._id, {
      batchId,
      impressions: [
        { recommendationId: recId1, visibleAt: new Date(), visibleDurationMs: 1500, position: 0 },
        { recommendationId: recId2, visibleAt: new Date(), visibleDurationMs: 2200, position: 1 },
      ],
    });
    assert(secondSubmission.accepted === 0, 'Resubmission accepts 0 new impressions');
    assert(secondSubmission.duplicates === 2, 'Resubmission detects 2 duplicates idempotently');

    // 2.3 Verify OutboxEvent was recorded
    const outboxEvent = await OutboxEvent.findOne({
      eventType: 'profile.impression',
      'payload.candidateId': cand1User._id.toString(),
    });
    assert(outboxEvent !== null, 'profile.impression outbox event is recorded');

    // -------------------------------------------------------------
    // 3. Discovery Suppression Integration Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Discovery Suppression Integration Tests ---');

    // 3.1 Evaluating candidate 1 should now return RECENTLY_SHOWN hard exclusion
    const eligRes = await evaluateCandidate(viewerUser._id, cand1User._id);
    assert(eligRes.eligible === false, 'Confirmed impression candidate is excluded from immediate rediscovery');
    assert(eligRes.hardExclusions.includes(HardExclusionReasons.RECENTLY_SHOWN), 'Returns RECENTLY_SHOWN hard exclusion reason');

    // 3.2 Verify NO DatingInteraction (Like/Pass/Match) was created by the impression
    const interactionCount = await DatingInteraction.countDocuments({ actor: viewerUser._id });
    assert(interactionCount === 0, 'Impression confirmation strictly does NOT create Pass/Like/Match records');

    // -------------------------------------------------------------
    // 4. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. HTTP REST API Endpoint Tests ---');

    // 4.1 Unauthenticated POST /v1/discovery/impressions returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/discovery/impressions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, impressions: [{ recommendationId: recId1 }] }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated POST /v1/discovery/impressions returns 401');

    // 4.2 Authenticated POST /v1/discovery/impressions returns 200 OK
    const authRes = await fetch(`${BASE_URL}/v1/discovery/impressions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        batchId,
        impressions: [
          { recommendationId: recId1, visibleAt: new Date().toISOString(), visibleDurationMs: 1200, position: 0 },
        ],
      }),
    });
    const authData = await authRes.json();
    assert(authRes.status === 200, 'Authenticated POST /v1/discovery/impressions returns 200 OK');
    assert(authData.success === true, 'Response contains success: true envelope');
    assert(authData.data.duplicates === 1, 'API response confirms duplicate detection');

    console.log('\n===========================================================');
    console.log(`IMPRESSION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runImpressionTests();
}

module.exports = runImpressionTests;
