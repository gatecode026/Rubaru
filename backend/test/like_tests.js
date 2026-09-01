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
const Match = require('../models/Match');
const Chat = require('../models/Chat');

// Services & Routes
const likeService = require('../services/likeService');
const likeRoutes = require('../routes/likeRoutes');
const { evaluateCandidate, HardExclusionReasons } = require('../services/eligibilityPolicy');

async function runLikeTests() {
  console.log('===========================================================');
  console.log('       RUBARU LIKES, ROSES & QUOTAS INTEGRATION TESTS      ');
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
  app.use('/v1/likes', likeRoutes);

  const TEST_PORT = 5093;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // Create Viewer and Candidate users
    const viewerUser = await User.create({ email: `v_like_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand1User = await User.create({ email: `c1_like_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand2User = await User.create({ email: `c2_like_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const cand3User = await User.create({ email: `c3_like_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const otherUser = await User.create({ email: `other_like_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });

    // Profiles and Preferences
    await DatingProfile.create({ user: viewerUser._id, displayName: 'Viewer User', dateOfBirth: dob, age: 26, gender: 'Male', isDiscoverable: true });
    await DatingPreference.create({ user: viewerUser._id, genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: viewerUser._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });

    await DatingProfile.create({ user: cand1User._id, displayName: 'Cand 1 Like', dateOfBirth: dob, age: 24, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand1User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand1User._id, location: { type: 'Point', coordinates: [75.79, 26.92] } });

    await DatingProfile.create({ user: cand2User._id, displayName: 'Cand 2 Rose', dateOfBirth: dob, age: 25, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand2User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand2User._id, location: { type: 'Point', coordinates: [75.80, 26.93] } });

    await DatingProfile.create({ user: cand3User._id, displayName: 'Cand 3 Reciprocal', dateOfBirth: dob, age: 27, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand3User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand3User._id, location: { type: 'Point', coordinates: [75.81, 26.94] } });

    // Set entitlement for viewer: 2 daily likes limit, 1 rose, 1 priority like
    await UserEntitlement.create({
      user: viewerUser._id,
      dailyFreeLikesLimit: 2,
      likesUsedToday: 0,
      rosesBalance: 1,
      priorityLikesBalance: 1,
      likesResetsAt: new Date(Date.now() + 86400000),
    });

    const viewerToken = jwt.sign({ id: viewerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = {
      Authorization: `Bearer ${viewerToken}`,
      'Content-Type': 'application/json',
    };

    // Active Recommendation Batch
    const batchId = `batch_like_test_${timestamp}`;
    await RecommendationBatch.create({
      batchId,
      viewer: viewerUser._id,
      candidates: [cand1User._id, cand2User._id, cand3User._id],
      preferenceVersion: 1,
      locationVersion: 1,
      rankingConfigVersion: 'v1.0',
      expiresAt: new Date(Date.now() + 3600000),
    });

    const recId1 = `rec_${batchId}_${cand1User._id}`;
    const recId2 = `rec_${batchId}_${cand2User._id}`;
    const recId3 = `rec_${batchId}_${cand3User._id}`;

    // -------------------------------------------------------------
    // 1. Validation & Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Validation & Security Tests ---');

    // 1.1 Missing recommendationId throws error
    try {
      await likeService.createLike(viewerUser._id, { idempotencyKey: `idem_1_${timestamp}` });
      assert(false, 'Missing recommendationId should throw');
    } catch (err) {
      assert(err.code === 'INVALID_LIKE_REQUEST', 'Missing recommendationId throws INVALID_LIKE_REQUEST');
    }

    // 1.2 Batch ownership mismatch throws 403
    try {
      await likeService.createLike(otherUser._id, { recommendationId: recId1, idempotencyKey: `idem_2_${timestamp}` });
      assert(false, 'Cross user like should throw');
    } catch (err) {
      assert(err.code === 'RECOMMENDATION_OWNERSHIP_INVALID', 'Batch ownership mismatch throws RECOMMENDATION_OWNERSHIP_INVALID (403)');
    }

    // 1.3 Comment exceeding 280 chars throws error
    try {
      const longComment = 'a'.repeat(281);
      await likeService.createLike(viewerUser._id, {
        recommendationId: recId1,
        comment: longComment,
        idempotencyKey: `idem_3_${timestamp}`,
      });
      assert(false, 'Long comment should throw');
    } catch (err) {
      assert(err.code === 'LIKE_COMMENT_INVALID', 'Comment >280 chars throws LIKE_COMMENT_INVALID');
    }

    // -------------------------------------------------------------
    // 2. Standard Like Flow & Idempotency Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Standard Like Flow & Idempotency Tests ---');

    const likeResult1 = await likeService.createLike(viewerUser._id, {
      recommendationId: recId1,
      type: 'LIKE',
      targetElement: { type: 'PHOTO', id: 'photo_1' },
      comment: 'Loved your travel picture!',
      idempotencyKey: `idem_like_${timestamp}`,
    });

    assert(likeResult1.like && likeResult1.like.status === 'PENDING', 'Like created with status PENDING');
    assert(likeResult1.allowance.remainingLikes === 1, 'Remaining likes decremented from 2 to 1');
    assert(likeResult1.mutualInterestPending === false, 'mutualInterestPending is false when no reciprocal like');

    // 2.2 Impression reconciled
    const reconciledImp = await ProfileImpression.findOne({ viewer: viewerUser._id, candidate: cand1User._id, recommendationBatchId: batchId });
    assert(reconciledImp !== null, 'Profile impression reconciled for liked candidate');

    // 2.3 Outbox event like.created recorded
    const likeOutbox = await OutboxEvent.findOne({ eventType: 'like.created', 'payload.recipientId': cand1User._id.toString() });
    assert(likeOutbox !== null, 'like.created outbox event is recorded');

    // 2.4 Idempotent retry returns original result
    const retryResult = await likeService.createLike(viewerUser._id, {
      recommendationId: recId1,
      idempotencyKey: `idem_like_${timestamp}`,
    });
    assert(retryResult.like.id === likeResult1.like.id, 'Idempotent like retry returns original like ID');
    assert(retryResult.allowance.remainingLikes === 1, 'Idempotent retry does not consume extra like quota');

    // 2.5 Discovery exclusion verified
    const eligAfterLike = await evaluateCandidate(viewerUser._id, cand1User._id);
    assert(eligAfterLike.eligible === false, 'Liked candidate is excluded from discovery');
    assert(eligAfterLike.hardExclusions.includes(HardExclusionReasons.PENDING_OUTGOING_LIKE), 'Returns PENDING_OUTGOING_LIKE exclusion');

    // -------------------------------------------------------------
    // 3. Quotas & Rose Limits Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Quotas & Limits Tests ---');

    // 3.1 Send second like (consumes remaining 1 like quota)
    const likeResult2 = await likeService.createLike(viewerUser._id, {
      recommendationId: recId2,
      type: 'LIKE',
      idempotencyKey: `idem_like2_${timestamp}`,
    });
    assert(likeResult2.allowance.remainingLikes === 0, 'Remaining likes reached 0');

    // 3.2 Third standard like should fail due to quota limit
    try {
      await likeService.createLike(viewerUser._id, {
        recommendationId: recId3,
        type: 'LIKE',
        idempotencyKey: `idem_like3_${timestamp}`,
      });
      assert(false, 'Exceeded like quota should throw');
    } catch (err) {
      assert(err.code === 'LIKE_LIMIT_REACHED', 'Exceeded daily limit throws LIKE_LIMIT_REACHED (403)');
    }

    const cand4User = await User.create({ email: `c4_like_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: cand4User._id, displayName: 'Cand 4 Rose', dateOfBirth: dob, age: 24, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: cand4User._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: cand4User._id, location: { type: 'Point', coordinates: [75.82, 26.95] } });

    // Add cand4 to batch
    await RecommendationBatch.updateOne({ batchId }, { $push: { candidates: cand4User._id } });
    const recId4 = `rec_${batchId}_${cand4User._id}`;

    // 3.3 Send Rose to cand4 (uses rose balance instead of daily likes)
    const roseResult = await likeService.createLike(viewerUser._id, {
      recommendationId: recId4,
      type: 'ROSE',
      idempotencyKey: `idem_rose4_${timestamp}`,
    });
    assert(roseResult.like && roseResult.like.type === 'ROSE', 'Rose sent successfully');
    assert(roseResult.allowance.remainingRoses === 0, 'Roses balance decremented to 0');

    // 3.4 Second Rose should fail because balance is 0
    try {
      await likeService.createLike(viewerUser._id, {
        recommendationId: recId3,
        type: 'ROSE',
        idempotencyKey: `idem_rose_fail_${timestamp}`,
      });
      assert(false, 'Exhausted rose balance should throw');
    } catch (err) {
      assert(err.code === 'ROSE_NOT_AVAILABLE', 'Exhausted rose balance throws ROSE_NOT_AVAILABLE (403)');
    }

    // -------------------------------------------------------------
    // 4. Reciprocal Interest & Match Gating (CRITICAL TEST)
    // -------------------------------------------------------------
    console.log('\n--- 4. Reciprocal Interest & Match Gating Tests ---');

    // Candidate 1 sends a pending like to Viewer
    const reciprocalUser = await User.create({ email: `recip_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: reciprocalUser._id, displayName: 'Reciprocal Cand', dateOfBirth: dob, age: 23, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: reciprocalUser._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: reciprocalUser._id, location: { type: 'Point', coordinates: [75.80, 26.93] } });

    // Incoming like from reciprocalUser to viewerUser
    await DatingInteraction.create({
      actor: reciprocalUser._id,
      target: viewerUser._id,
      type: 'LIKE',
      status: 'PENDING',
      idempotencyKey: `incoming_like_${timestamp}`,
    });

    const recipBatchId = `batch_recip_${timestamp}`;
    await RecommendationBatch.create({
      batchId: recipBatchId,
      viewer: viewerUser._id,
      candidates: [reciprocalUser._id],
      preferenceVersion: 1,
      locationVersion: 1,
      rankingConfigVersion: 'v1.0',
      expiresAt: new Date(Date.now() + 3600000),
    });

    const recipRecId = `rec_${recipBatchId}_${reciprocalUser._id}`;

    // Viewer sends Priority Like to reciprocalUser
    const mutualLikeResult = await likeService.createLike(viewerUser._id, {
      recommendationId: recipRecId,
      type: 'PRIORITY_LIKE',
      idempotencyKey: `idem_mutual_${timestamp}`,
    });

    assert(mutualLikeResult.mutualInterestPending === true, 'mutualInterestPending is true on reciprocal like');
    assert(mutualLikeResult.match !== null && typeof mutualLikeResult.match.id === 'string', 'Reciprocal like creates Match document');
    assert(mutualLikeResult.conversation !== null && typeof mutualLikeResult.conversation.id === 'string', 'Reciprocal like creates Conversation document');

    // -------------------------------------------------------------
    // 5. Withdrawal Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Sent Like Withdrawal Tests ---');

    const withdrawRes = await likeService.withdrawLike(viewerUser._id, likeResult1.like.id);
    assert(withdrawRes.withdrawn === true, 'Sent like withdrawn successfully');

    const withdrawnDoc = await DatingInteraction.findById(likeResult1.like.id);
    assert(withdrawnDoc.status === 'WITHDRAWN' && withdrawnDoc.withdrawnAt !== null, 'Like status updated to WITHDRAWN');

    const withdrawOutbox = await OutboxEvent.findOne({ eventType: 'like.withdrawn', 'payload.likeId': likeResult1.like.id });
    assert(withdrawOutbox !== null, 'like.withdrawn outbox event is recorded');

    // -------------------------------------------------------------
    // 6. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. HTTP REST API Endpoint Tests ---');

    // 6.1 Unauthenticated POST /v1/likes returns 401
    const unauthLike = await fetch(`${BASE_URL}/v1/likes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: recId1 }),
    });
    assert(unauthLike.status === 401, 'Unauthenticated POST /v1/likes returns 401');

    // 6.2 Authenticated POST /v1/likes with valid request returns 201
    // Create new fresh candidate for API test
    const apiCand = await User.create({ email: `api_cand_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: apiCand._id, displayName: 'API Cand', dateOfBirth: dob, age: 24, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: apiCand._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50 });
    await UserLocation.create({ user: apiCand._id, location: { type: 'Point', coordinates: [75.80, 26.93] } });

    // Grant unlimited likes to viewer for API test
    await UserEntitlement.updateOne({ user: viewerUser._id }, { hasUnlimitedLikes: true });

    const apiBatchId = `batch_api_${timestamp}`;
    await RecommendationBatch.create({
      batchId: apiBatchId,
      viewer: viewerUser._id,
      candidates: [apiCand._id],
      preferenceVersion: 1,
      locationVersion: 1,
      rankingConfigVersion: 'v1.0',
      expiresAt: new Date(Date.now() + 3600000),
    });

    const apiRecId = `rec_${apiBatchId}_${apiCand._id}`;

    const apiLikeRes = await fetch(`${BASE_URL}/v1/likes`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        recommendationId: apiRecId,
        type: 'LIKE',
        comment: 'Hello from API test!',
        idempotencyKey: `idem_api_like_${timestamp}`,
      }),
    });
    const apiLikeData = await apiLikeRes.json();
    assert(apiLikeRes.status === 201, 'Authenticated POST /v1/likes returns 201 Created');
    assert(apiLikeData.success === true && apiLikeData.data.like.status === 'PENDING', 'API response contains like object');

    // 6.3 Authenticated DELETE /v1/likes/:id returns 200 OK
    const apiWithdrawRes = await fetch(`${BASE_URL}/v1/likes/${apiLikeData.data.like.id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    const apiWithdrawData = await apiWithdrawRes.json();
    assert(apiWithdrawRes.status === 200, 'Authenticated DELETE /v1/likes/:id returns 200 OK');
    assert(apiWithdrawData.success === true && apiWithdrawData.data.withdrawn === true, 'Withdraw API returns withdrawn: true');

    console.log('\n===========================================================');
    console.log(`LIKES, ROSES & QUOTAS TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runLikeTests();
}

module.exports = runLikeTests;
