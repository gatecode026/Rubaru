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
const DatingInteraction = require('../models/DatingInteraction');
const ProfileImpression = require('../models/ProfileImpression');
const UserEntitlement = require('../models/UserEntitlement');
const OutboxEvent = require('../models/OutboxEvent');

// Services & Routes
const interactionService = require('../services/interactionService');
const discoveryRoutes = require('../routes/discoveryRoutes');
const { evaluateCandidate, HardExclusionReasons } = require('../services/eligibilityPolicy');

async function runPassUndoTests() {
  console.log('===========================================================');
  console.log('       RUBARU PASS, REMOVE & UNDO INTEGRATION TESTS        ');
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

  const TEST_PORT = 5094;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // Create Viewer and Candidate users
    const viewerUser = await User.create({ email: `v_pass_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand1User = await User.create({ email: `c1_pass_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand2User = await User.create({ email: `c2_pass_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const otherUser = await User.create({ email: `other_pass_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });

    // Profiles and Preferences
    await DatingProfile.create({ user: viewerUser._id, displayName: 'Viewer User', dateOfBirth: dob, age: 26, gender: 'Male', isDiscoverable: true });
    await DatingPreference.create({ user: viewerUser._id, genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: viewerUser._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });

    await DatingProfile.create({ user: cand1User._id, displayName: 'Cand 1 Pass', dateOfBirth: dob, age: 24, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand1User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand1User._id, location: { type: 'Point', coordinates: [75.79, 26.92] } });

    await DatingProfile.create({ user: cand2User._id, displayName: 'Cand 2 Remove', dateOfBirth: dob, age: 25, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand2User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand2User._id, location: { type: 'Point', coordinates: [75.80, 26.93] } });

    // Entitlement for viewer: 3 daily undos
    await UserEntitlement.create({
      user: viewerUser._id,
      dailyUndoAllowance: 3,
      undoUsedToday: 0,
      undoResetsAt: new Date(Date.now() + 86400000),
    });

    const viewerToken = jwt.sign({ id: viewerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = {
      Authorization: `Bearer ${viewerToken}`,
      'Content-Type': 'application/json',
    };

    // Active Recommendation Batch
    const batchId = `batch_pass_test_${timestamp}`;
    await RecommendationBatch.create({
      batchId,
      viewer: viewerUser._id,
      candidates: [cand1User._id, cand2User._id],
      preferenceVersion: 1,
      locationVersion: 1,
      rankingConfigVersion: 'v1.0',
      expiresAt: new Date(Date.now() + 3600000),
    });

    const recId1 = `rec_${batchId}_${cand1User._id}`;
    const recId2 = `rec_${batchId}_${cand2User._id}`;

    // -------------------------------------------------------------
    // 1. Pass Validation & Execution Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Pass Validation & Execution Tests ---');

    // 1.1 Missing idempotencyKey throws error
    try {
      await interactionService.passCandidate(viewerUser._id, { recommendationId: recId1 });
      assert(false, 'Missing idempotencyKey should throw');
    } catch (err) {
      assert(err.code === 'INVALID_DISCOVERY_ACTION', 'Missing idempotencyKey throws INVALID_DISCOVERY_ACTION');
    }

    // 1.2 Batch ownership mismatch throws 403
    try {
      await interactionService.passCandidate(otherUser._id, { recommendationId: recId1, idempotencyKey: `idem_1_${timestamp}` });
      assert(false, 'Other user pass should throw');
    } catch (err) {
      assert(err.code === 'RECOMMENDATION_OWNERSHIP_INVALID', 'Batch ownership mismatch throws RECOMMENDATION_OWNERSHIP_INVALID (403)');
    }

    // 1.3 Successful Pass
    const passResult = await interactionService.passCandidate(viewerUser._id, {
      recommendationId: recId1,
      idempotencyKey: `idem_pass_${timestamp}`,
    });
    assert(passResult.passed === true, 'Pass action succeeds');
    assert(typeof passResult.undoToken === 'string' && passResult.undoToken.startsWith('undo_'), 'Returns valid signed undoToken');

    // 1.4 Impression reconciled
    const reconciledImp = await ProfileImpression.findOne({ viewer: viewerUser._id, candidate: cand1User._id, recommendationBatchId: batchId });
    assert(reconciledImp !== null, 'Profile impression reconciled for passed candidate');

    // 1.5 Idempotent retry returns original response
    const retryResult = await interactionService.passCandidate(viewerUser._id, {
      recommendationId: recId1,
      idempotencyKey: `idem_pass_${timestamp}`,
    });
    assert(retryResult.passed === true && typeof retryResult.undoToken === 'string', 'Idempotent pass retry returns valid undoToken');

    // 1.6 Outbox event profile.passed recorded
    const passOutbox = await OutboxEvent.findOne({ eventType: 'profile.passed', 'payload.candidateId': cand1User._id.toString() });
    assert(passOutbox !== null, 'profile.passed outbox event is recorded');

    // 1.7 Candidate now excluded by eligibility policy
    const eligAfterPass = await evaluateCandidate(viewerUser._id, cand1User._id);
    assert(eligAfterPass.eligible === false, 'Passed candidate is excluded from discovery');
    assert(eligAfterPass.hardExclusions.includes(HardExclusionReasons.PASS_SUPPRESSION_ACTIVE), 'Returns PASS_SUPPRESSION_ACTIVE exclusion');

    // -------------------------------------------------------------
    // 2. Remove Action Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Remove Action Tests ---');

    const removeResult = await interactionService.removeCandidate(viewerUser._id, {
      recommendationId: recId2,
      idempotencyKey: `idem_rem_${timestamp}`,
    });
    assert(removeResult.removed === true, 'Remove action succeeds');

    const removeOutbox = await OutboxEvent.findOne({ eventType: 'profile.removed', 'payload.candidateId': cand2User._id.toString() });
    assert(removeOutbox !== null, 'profile.removed outbox event is recorded');

    // -------------------------------------------------------------
    // 3. Undo Action Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Undo Action Tests ---');

    // 3.1 Tampered undo token throws error
    try {
      await interactionService.undoLatestPass(viewerUser._id, { undoToken: passResult.undoToken + 'tampered' });
      assert(false, 'Tampered token should throw');
    } catch (err) {
      assert(err.code === 'UNDO_TOKEN_INVALID', 'Tampered undo token throws UNDO_TOKEN_INVALID');
    }

    // 3.2 Undo token for another user throws 403
    try {
      await interactionService.undoLatestPass(otherUser._id, { undoToken: passResult.undoToken });
      assert(false, 'Cross-user undo should throw');
    } catch (err) {
      assert(err.code === 'RECOMMENDATION_OWNERSHIP_INVALID', 'Cross-user undo throws RECOMMENDATION_OWNERSHIP_INVALID (403)');
    }

    // 3.3 Successful Undo
    const undoResult = await interactionService.undoLatestPass(viewerUser._id, {
      undoToken: passResult.undoToken,
      idempotencyKey: `idem_undo_${timestamp}`,
    });
    assert(undoResult.restored === true, 'Undo action restores candidate');
    assert(undoResult.recommendation && undoResult.recommendation.profile.displayName === 'Cand 1 Pass', 'Restored candidate DTO returned');
    assert(undoResult.undoAllowance.remaining === 2, 'Undo allowance decremented from 3 to 2');

    // 3.4 Pass record is marked WITHDRAWN (not deleted)
    const passRecord = await DatingInteraction.findOne({ actor: viewerUser._id, target: cand1User._id, type: 'PASS' });
    assert(passRecord.status === 'WITHDRAWN' && passRecord.undoneAt !== null, 'Pass record marked WITHDRAWN with undoneAt');

    // 3.5 Outbox event profile.pass_undone recorded
    const undoOutbox = await OutboxEvent.findOne({ eventType: 'profile.pass_undone', 'payload.candidateId': cand1User._id.toString() });
    assert(undoOutbox !== null, 'profile.pass_undone outbox event is recorded');

    // 3.6 Candidate is no longer suppressed by PASS
    const eligAfterUndo = await evaluateCandidate(viewerUser._id, cand1User._id);
    assert(
      !eligAfterUndo.hardExclusions.includes(HardExclusionReasons.PASS_SUPPRESSION_ACTIVE),
      'Pass suppression is no longer active after undo'
    );

    // 3.7 Repeated undo of the same token fails
    try {
      await interactionService.undoLatestPass(viewerUser._id, { undoToken: passResult.undoToken });
      assert(false, 'Already undone pass should throw');
    } catch (err) {
      assert(err.code === 'UNDO_NOT_AVAILABLE', 'Already undone pass throws UNDO_NOT_AVAILABLE');
    }

    // -------------------------------------------------------------
    // 4. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. HTTP REST API Endpoint Tests ---');

    // 4.1 Unauthenticated POST /v1/discovery/pass returns 401
    const unauthPass = await fetch(`${BASE_URL}/v1/discovery/pass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: recId1 }),
    });
    assert(unauthPass.status === 401, 'Unauthenticated POST /v1/discovery/pass returns 401');

    // 4.2 Authenticated POST /v1/discovery/pass returns 200 OK
    const apiPassRes = await fetch(`${BASE_URL}/v1/discovery/pass`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        recommendationId: recId1,
        idempotencyKey: `idem_api_pass_${timestamp}`,
      }),
    });
    const apiPassData = await apiPassRes.json();
    assert(apiPassRes.status === 200, 'Authenticated POST /v1/discovery/pass returns 200 OK');
    assert(apiPassData.success === true && apiPassData.data.passed === true, 'Pass API response contains passed: true');

    // 4.3 Authenticated POST /v1/discovery/undo returns 200 OK
    const apiUndoRes = await fetch(`${BASE_URL}/v1/discovery/undo`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        undoToken: apiPassData.data.undoToken,
        idempotencyKey: `idem_api_undo_${timestamp}`,
      }),
    });
    const apiUndoData = await apiUndoRes.json();
    assert(apiUndoRes.status === 200, 'Authenticated POST /v1/discovery/undo returns 200 OK');
    assert(apiUndoData.success === true && apiUndoData.data.restored === true, 'Undo API response contains restored: true');

    // 4.4 Authenticated POST /v1/discovery/remove returns 200 OK
    const apiRemoveRes = await fetch(`${BASE_URL}/v1/discovery/remove`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        recommendationId: recId2,
        idempotencyKey: `idem_api_rem_${timestamp}`,
      }),
    });
    const apiRemoveData = await apiRemoveRes.json();
    assert(apiRemoveRes.status === 200, 'Authenticated POST /v1/discovery/remove returns 200 OK');
    assert(apiRemoveData.success === true && apiRemoveData.data.removed === true, 'Remove API response contains removed: true');

    console.log('\n===========================================================');
    console.log(`PASS, REMOVE & UNDO TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runPassUndoTests();
}

module.exports = runPassUndoTests;
