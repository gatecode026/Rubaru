require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Import Backend Routes
const datingRoutes = require('../routes/datingRoutes');
const discoveryRoutes = require('../routes/discoveryRoutes');
const likeRoutes = require('../routes/likeRoutes');
const matchRoutes = require('../routes/matchRoutes');
const safetyRoutes = require('../routes/safetyRoutes');

// Models
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const DatingInteraction = require('../models/DatingInteraction');

async function runFrontendDatingIntegrationTests() {
  console.log('===========================================================');
  console.log('       RUBARU FRONTEND - BACKEND INTEGRATION TESTS        ');
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
  app.use('/v1/discovery', discoveryRoutes);
  app.use('/v1/likes', likeRoutes);
  app.use('/v1/matches', matchRoutes);
  app.use('/v1/users', safetyRoutes);

  const TEST_PORT = 5096;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // 1. Create Test Users
    const userClient = await User.create({ email: `f_user_client_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userClient._id, displayName: 'Client User', dateOfBirth: dob, age: 26, gender: 'Female', isDiscoverable: true, interests: ['Art', 'Music'] });
    await DatingPreference.create({
      user: userClient._id,
      genderPreference: ['Male'],
      ageRange: { min: 20, max: 35, isDealbreaker: true },
      maxDistanceKm: 50,
      version: 1,
    });
    await UserLocation.create({ user: userClient._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });
    const tokenClient = jwt.sign({ id: userClient._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = { Authorization: `Bearer ${tokenClient}`, 'Content-Type': 'application/json' };

    const userCandidate = await User.create({ email: `f_user_cand_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userCandidate._id, displayName: 'Candidate User', dateOfBirth: dob, age: 27, gender: 'Male', isDiscoverable: true, interests: ['Art'] });
    await DatingPreference.create({
      user: userCandidate._id,
      genderPreference: ['Female'],
      ageRange: { min: 20, max: 35, isDealbreaker: true },
      maxDistanceKm: 50,
      version: 1,
    });
    await UserLocation.create({ user: userCandidate._id, location: { type: 'Point', coordinates: [75.80, 26.92] } });

    // -------------------------------------------------------------
    // 1. Dating Preferences Frontend Flow
    // -------------------------------------------------------------
    console.log('\n--- 1. Dating Preferences Integration ---');
    const getPrefRes = await fetch(`${BASE_URL}/v1/dating/preferences`, { headers: authHeaders });
    const prefData = await getPrefRes.json();
    assert(getPrefRes.status === 200, 'GET /v1/dating/preferences returns 200 OK');
    assert(prefData.success === true && prefData.data.preferences.minimumAge === 20, 'Frontend loads dating preferences');

    const updatePrefRes = await fetch(`${BASE_URL}/v1/dating/preferences`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ minimumAge: 22, maximumAge: 32 }),
    });
    const updatePrefData = await updatePrefRes.json();
    assert(updatePrefRes.status === 200, 'PATCH /v1/dating/preferences returns 200 OK');
    assert(updatePrefData.data.preferences.minimumAge === 22 && updatePrefData.data.preferences.maximumAge === 32, 'Frontend updates preferences');

    // -------------------------------------------------------------
    // 2. Protected Location Updates Frontend Flow
    // -------------------------------------------------------------
    console.log('\n--- 2. Protected Location Integration ---');
    const updateLocRes = await fetch(`${BASE_URL}/v1/dating/location`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ latitude: 26.915, longitude: 75.79, accuracyMeters: 12 }),
    });
    const updateLocData = await updateLocRes.json();
    assert(updateLocRes.status === 200, 'PUT /v1/dating/location returns 200 OK');
    assert(updateLocData.success === true, 'Frontend updates user protected location');

    // -------------------------------------------------------------
    // 3. Discovery Candidates & Impression Flow
    // -------------------------------------------------------------
    console.log('\n--- 3. Discovery Candidates Integration ---');
    const discoveryRes = await fetch(`${BASE_URL}/v1/discovery/candidates`, { headers: authHeaders });
    const discoveryData = await discoveryRes.json();
    assert(discoveryRes.status === 200, 'GET /v1/discovery/candidates returns 200 OK');
    assert(discoveryData.success === true && Array.isArray(discoveryData.data.items), 'Discovery returns candidates items array');

    if (discoveryData.data.items.length > 0) {
      const firstCandidate = discoveryData.data.items[0];
      const recId = firstCandidate.recommendationId;
      const lastUnderscore = recId.lastIndexOf('_');
      const batchId = recId.substring(4, lastUnderscore);

      const impRes = await fetch(`${BASE_URL}/v1/discovery/impressions`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          batchId,
          impressions: [{ recommendationId: firstCandidate.recommendationId, visibleDurationMs: 2500 }],
        }),
      });
      const impData = await impRes.json();
      assert(impRes.status === 200, 'POST /v1/discovery/impressions returns 200 OK');
      assert(impData.success === true && impData.data.accepted === 1, 'Impression successfully tracked from frontend card visibility');
    }

    // -------------------------------------------------------------
    // 4. Outgoing Like & Incoming Inbox Flow
    // -------------------------------------------------------------
    console.log('\n--- 4. Outgoing Like & Incoming Inbox Flow ---');
    let candidateItem = null;
    if (discoveryData.data.items.length > 0) {
      candidateItem = discoveryData.data.items[0];
      const likeRes = await fetch(`${BASE_URL}/v1/likes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          recommendationId: candidateItem.recommendationId,
          type: 'LIKE',
          comment: 'Hey, nice photos!',
          targetElement: { type: 'PROFILE', elementId: 'profile_main' },
          idempotencyKey: `like_test_${Date.now()}`,
        }),
      });
      const likeData = await likeRes.json();
      assert(likeRes.status === 201, 'POST /v1/likes returns 201 Created');
      assert(likeData.success === true && likeData.data.like.status === 'PENDING', 'Like sent successfully');
    }

    // Candidate checks incoming likes
    const targetUserId = candidateItem.profile.userId;
    const tokenTarget = jwt.sign({ id: targetUserId }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersTarget = { Authorization: `Bearer ${tokenTarget}`, 'Content-Type': 'application/json' };

    const incomingRes = await fetch(`${BASE_URL}/v1/likes/incoming`, { headers: authHeadersTarget });
    const incomingData = await incomingRes.json();
    assert(incomingRes.status === 200, 'GET /v1/likes/incoming returns 200 OK');
    assert(incomingData.success === true && incomingData.data.items.length >= 1, 'Incoming likes inbox displays sent like');

    // -------------------------------------------------------------
    // 5. Like Acceptance & Match Creation Flow
    // -------------------------------------------------------------
    console.log('\n--- 5. Like Acceptance & Match Creation Flow ---');
    const incomingLikeId = incomingData.data.items[0].likeId;
    const acceptRes = await fetch(`${BASE_URL}/v1/likes/${incomingLikeId}/accept`, {
      method: 'POST',
      headers: authHeadersTarget,
      body: JSON.stringify({ idempotencyKey: `accept_test_${Date.now()}` }),
    });
    const acceptData = await acceptRes.json();
    assert(acceptRes.status === 200, 'POST /v1/likes/:id/accept returns 200 OK');
    assert(acceptData.success === true && acceptData.data.matched === true, 'Like accepted and match created');
    assert(typeof acceptData.data.match.id === 'string', 'Match ID returned to frontend');

    // -------------------------------------------------------------
    // 6. Matches List & Details Flow
    // -------------------------------------------------------------
    console.log('\n--- 6. Matches List & Details Flow ---');
    const matchesRes = await fetch(`${BASE_URL}/v1/matches`, { headers: authHeaders });
    const matchesData = await matchesRes.json();
    assert(matchesRes.status === 200, 'GET /v1/matches returns 200 OK');
    assert(matchesData.success === true && matchesData.data.items.length >= 1, 'Matches list returns newly created match');

    const matchId = matchesData.data.items[0].matchId;
    const matchDetailRes = await fetch(`${BASE_URL}/v1/matches/${matchId}`, { headers: authHeaders });
    const matchDetailData = await matchDetailRes.json();
    assert(matchDetailRes.status === 200, 'GET /v1/matches/:id returns 200 OK');
    assert(typeof matchDetailData.data.otherUser.displayName === 'string', 'Match details populated correctly');

    // -------------------------------------------------------------
    // 7. Unmatch & Safety Flow
    // -------------------------------------------------------------
    console.log('\n--- 7. Unmatch & Safety Flow ---');
    const unmatchRes = await fetch(`${BASE_URL}/v1/matches/${matchId}/unmatch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: 'LOST_INTEREST' }),
    });
    const unmatchData = await unmatchRes.json();
    assert(unmatchRes.status === 200, 'POST /v1/matches/:id/unmatch returns 200 OK');
    assert(unmatchData.data.unmatched === true, 'Match unmatched from frontend');

    console.log('\n===========================================================');
    console.log(`FRONTEND INTEGRATION TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runFrontendDatingIntegrationTests();
}

module.exports = runFrontendDatingIntegrationTests;
