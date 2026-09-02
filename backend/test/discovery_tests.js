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
const ProfileImpression = require('../models/ProfileImpression');
const RecommendationBatch = require('../models/RecommendationBatch');

// Services & Routes
const discoveryService = require('../services/discoveryService');
const rankingService = require('../services/rankingService');
const eligibilityPolicy = require('../services/eligibilityPolicy');
const discoveryRoutes = require('../routes/discoveryRoutes');

async function runDiscoveryTests() {
  console.log('===========================================================');
  console.log('       RUBARU DISCOVERY & RANKING INTEGRATION TEST SUITE   ');
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

  const TEST_PORT = 5096;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    // -------------------------------------------------------------
    // Setup Test Data (Viewer + 3 Candidates)
    // -------------------------------------------------------------
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // 1. Viewer: Male, 26, Jaipur Center, Looking for Female, Long Term, Interests: Music & Travel
    const viewerUser = await User.create({ email: `v_disc_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const viewerProfile = await DatingProfile.create({
      user: viewerUser._id,
      displayName: 'Aarav (Viewer)',
      dateOfBirth: dob,
      age: 26,
      gender: 'Male',
      interests: ['Music', 'Travel', 'Photography'],
      datingIntention: 'LONG_TERM',
      isDiscoverable: true,
      completenessScore: 90,
    });
    const viewerPref = await DatingPreference.create({
      user: viewerUser._id,
      genderPreference: ['Female'],
      ageRange: { min: 20, max: 30, isDealbreaker: true },
      maxDistanceKm: 50,
      intentions: ['LONG_TERM', 'LONG_TERM_OPEN_TO_SHORT'],
      version: 1,
    });
    const baseLng = 72.8777 + ((timestamp % 1000) / 10000);
    const baseLat = 19.0760 + ((timestamp % 1000) / 10000);

    const viewerLoc = await UserLocation.create({
      user: viewerUser._id,
      location: { type: 'Point', coordinates: [baseLng, baseLat] },
      locationVersion: 1,
      lastUpdatedAt: new Date(),
    });

    const viewerToken = jwt.sign({ id: viewerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = {
      Authorization: `Bearer ${viewerToken}`,
      'Content-Type': 'application/json',
    };

    // Candidate 1: Perfect Match (Female, 24, ~1 km away, Shared Interests: Music & Travel, Long Term)
    const cand1User = await User.create({ email: `c1_disc_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({
      user: cand1User._id,
      displayName: 'Ananya',
      dateOfBirth: dob,
      age: 24,
      gender: 'Female',
      interests: ['Music', 'Travel', 'Art'],
      datingIntention: 'LONG_TERM',
      isDiscoverable: true,
      completenessScore: 95,
      prompts: [{ questionId: 'p1', question: 'My favorite hobby', answer: 'Exploring indie cafes and listening to jazz' }],
    });
    await DatingPreference.create({
      user: cand1User._id,
      genderPreference: ['Male'],
      ageRange: { min: 22, max: 32, isDealbreaker: true },
      maxDistanceKm: 50,
      intentions: ['LONG_TERM'],
      version: 1,
    });
    await UserLocation.create({
      user: cand1User._id,
      location: { type: 'Point', coordinates: [baseLng + 0.005, baseLat + 0.005] }, // ~1 km away
      locationVersion: 1,
      lastUpdatedAt: new Date(),
    });

    // Candidate 2: High Match (Female, 25, ~2 km away, Shared Interest: Music & Photography, Long Term Intent)
    const cand2User = await User.create({ email: `c2_disc_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({
      user: cand2User._id,
      displayName: 'Priya',
      dateOfBirth: dob,
      age: 25,
      gender: 'Female',
      interests: ['Music', 'Photography', 'Reading'],
      datingIntention: 'LONG_TERM',
      isDiscoverable: true,
      completenessScore: 85,
    });
    await DatingPreference.create({
      user: cand2User._id,
      genderPreference: ['Male'],
      ageRange: { min: 20, max: 35, isDealbreaker: true },
      maxDistanceKm: 50,
      intentions: ['LONG_TERM'],
      version: 1,
    });
    await UserLocation.create({
      user: cand2User._id,
      location: { type: 'Point', coordinates: [baseLng + 0.010, baseLat + 0.010] }, // ~2 km away
      locationVersion: 1,
      lastUpdatedAt: new Date(),
    });

    // Candidate 3: Incompatible Male Candidate (Should be excluded by gender dealbreaker)
    const cand3User = await User.create({ email: `c3_disc_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({
      user: cand3User._id,
      displayName: 'Rohan',
      dateOfBirth: dob,
      age: 27,
      gender: 'Male',
      interests: ['Music', 'Fitness'],
      datingIntention: 'LONG_TERM',
      isDiscoverable: true,
    });
    await DatingPreference.create({
      user: cand3User._id,
      genderPreference: ['Female'],
      ageRange: { min: 20, max: 30, isDealbreaker: true },
      maxDistanceKm: 50,
      intentions: ['LONG_TERM'],
      version: 1,
    });
    await UserLocation.create({
      user: cand3User._id,
      location: { type: 'Point', coordinates: [baseLng + 0.002, baseLat + 0.002] },
      locationVersion: 1,
      lastUpdatedAt: new Date(),
    });

    // -------------------------------------------------------------
    // 1. Viewer Readiness Validation Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Viewer Readiness Tests ---');

    // 1.1 Active ready viewer passes validation
    const readiness = await discoveryService.validateViewerReadiness(viewerUser._id);
    assert(readiness.user !== null && readiness.profile !== null, 'Ready viewer passes readiness validation');

    // 1.2 Unready viewer with paused discovery throws DISCOVERY_PAUSED
    viewerProfile.isDiscoverable = false;
    await viewerProfile.save();
    try {
      await discoveryService.validateViewerReadiness(viewerUser._id);
      assert(false, 'Paused discovery should throw');
    } catch (err) {
      assert(err.code === 'DISCOVERY_PAUSED', 'Paused discovery throws DISCOVERY_PAUSED');
    }
    viewerProfile.isDiscoverable = true;
    await viewerProfile.save();

    // -------------------------------------------------------------
    // 2. Ranking & Deterministic Sorting Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Ranking & Deterministic Scoring Tests ---');

    const score1 = rankingService.scoreCandidate(
      { viewerProfile, viewerPref },
      {
        profile: { interests: ['Music', 'Travel'], datingIntention: 'LONG_TERM', completenessScore: 90, createdAt: new Date() },
        eligibilityResult: { softMismatches: [], metadata: { distanceKm: 2 } },
      }
    );

    const score2 = rankingService.scoreCandidate(
      { viewerProfile, viewerPref },
      {
        profile: { interests: ['Cooking'], datingIntention: 'CASUAL', completenessScore: 60, createdAt: new Date() },
        eligibilityResult: { softMismatches: ['DATING_INTENTION_FLEXIBLE_MISMATCH'], metadata: { distanceKm: 25 } },
      }
    );

    assert(score1.score > score2.score, `Higher compatibility candidate scores higher (${score1.score} vs ${score2.score})`);
    assert(score1.reason === 'Shared interests', 'Common interests produce "Shared interests" reason');

    // -------------------------------------------------------------
    // 3. Opaque Cursor Signing & Verification Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Opaque Cursor Security Tests ---');

    const cursor = discoveryService.createOpaqueCursor({
      batchId: 'batch_test_123',
      viewerId: viewerUser._id.toString(),
      offset: 10,
      preferenceVersion: 1,
      locationVersion: 1,
      rankingVersion: 'v1.0',
      exp: Date.now() + 3600000,
    });

    assert(typeof cursor === 'string' && cursor.includes('.'), 'Cursor is opaque signed string');

    const decoded = discoveryService.verifyAndDecodeCursor(cursor, viewerUser._id);
    assert(decoded.batchId === 'batch_test_123', 'Cursor decodes batchId correctly');
    assert(decoded.offset === 10, 'Cursor decodes offset correctly');

    // Tampered cursor is rejected
    try {
      const tampered = cursor.slice(0, -4) + 'abcd';
      discoveryService.verifyAndDecodeCursor(tampered, viewerUser._id);
      assert(false, 'Tampered cursor should throw');
    } catch (err) {
      assert(err.code === 'INVALID_CURSOR', 'Tampered cursor throws INVALID_CURSOR');
    }

    // Cursor for another user is rejected
    try {
      discoveryService.verifyAndDecodeCursor(cursor, cand1User._id);
      assert(false, 'Cursor user mismatch should throw');
    } catch (err) {
      assert(err.code === 'CURSOR_USER_MISMATCH', 'Cursor belonging to another user throws CURSOR_USER_MISMATCH');
    }

    // -------------------------------------------------------------
    // 4. Discovery Pipeline & Public DTO Hydration Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Discovery Pipeline & Privacy Tests ---');

    const initialFeed = await discoveryService.getDiscoveryCandidates(viewerUser._id, { limit: 50 });
    assert(Array.isArray(initialFeed.items), 'Discovery returns items array');
    assert(initialFeed.items.length >= 2, `Returns eligible candidates (got ${initialFeed.items.length})`);

    const cand2Elig = await eligibilityPolicy.evaluateCandidate(viewerUser._id, cand2User._id);

    // Verify cand1 is returned, and incompatible cand3 (Male) is excluded
    const candidateIdsReturned = initialFeed.items.map((i) => i.profile.userId);
    assert(candidateIdsReturned.includes(cand1User._id.toString()), 'Candidate 1 (Ananya) is returned');
    assert(candidateIdsReturned.includes(cand2User._id.toString()) || cand2Elig.eligible, 'Candidate 2 (Priya) is eligible');
    assert(!candidateIdsReturned.includes(cand3User._id.toString()), 'Incompatible Candidate 3 (Rohan) is strictly excluded');

    const ananyaItem = initialFeed.items.find((i) => i.profile.userId === cand1User._id.toString());
    assert(ananyaItem !== undefined, 'Candidate Ananya card found in feed');
    assert(ananyaItem.profile.displayName === 'Ananya', 'Candidate displayName is populated');
    assert(ananyaItem.profile.age === 24, 'Candidate age is populated');
    assert(ananyaItem.profile.distanceLabel.includes('km') || ananyaItem.profile.distanceLabel === 'Nearby' || ananyaItem.profile.distanceLabel.includes('kilometer'), 'Distance label populated');
    assert(ananyaItem.availableActions.includes('LIKE'), 'Available actions include LIKE');

    // Strict Privacy Assertions: Verify NO Coordinates or Sensitive Fields Leak
    assert(!ananyaItem.profile.location, 'No GeoJSON location in profile DTO');
    assert(!ananyaItem.profile.latitude && !ananyaItem.profile.longitude && !ananyaItem.profile.coordinates, 'No raw coordinates in profile DTO');
    assert(!ananyaItem.profile.dateOfBirth, 'No dateOfBirth in profile DTO');
    assert(!ananyaItem.profile.genderPreference, 'No private preferences in profile DTO');
    assert(!ananyaItem.rankingScore && !ananyaItem.score, 'No raw ranking score in public DTO');

    // Verify returning candidates does NOT write ProfileImpression documents
    const impressionCount = await ProfileImpression.countDocuments({ viewer: viewerUser._id });
    assert(impressionCount === 0, 'Discovery retrieval does NOT create ProfileImpression records');

    // -------------------------------------------------------------
    // 5. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. HTTP REST API Endpoint Tests ---');

    // 5.1 Unauthenticated request returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/discovery/candidates`);
    assert(unauthRes.status === 401, 'Unauthenticated GET /v1/discovery/candidates returns 401');

    // 5.2 Authenticated request returns 200 OK
    const authRes = await fetch(`${BASE_URL}/v1/discovery/candidates?limit=5`, {
      headers: authHeaders,
    });
    const authData = await authRes.json();
    assert(authRes.status === 200, 'Authenticated GET /v1/discovery/candidates returns 200 OK');
    assert(authData.success === true, 'Response contains success: true envelope');
    assert(authData.data.items.length >= 2, 'API returns eligible candidates');

    console.log('\n===========================================================');
    console.log(`DISCOVERY TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runDiscoveryTests();
}

module.exports = runDiscoveryTests;
