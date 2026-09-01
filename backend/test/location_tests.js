require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Models & Services
const User = require('../models/User');
const UserLocation = require('../models/UserLocation');
const locationService = require('../services/locationService');
const datingRoutes = require('../routes/datingRoutes');

async function runLocationTests() {
  console.log('===========================================================');
  console.log('       RUBARU PROTECTED LOCATION INTEGRATION TEST SUITE    ');
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

  const TEST_PORT = 5097;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  // Create test users
  const testUserA = await User.create({
    email: `loc_test_a_${Date.now()}@rubaru.app`,
    password: 'hashed_password_123',
    isActive: true,
    accountStatus: 'ACTIVE',
  });

  const testUserB = await User.create({
    email: `loc_test_b_${Date.now()}@rubaru.app`,
    password: 'hashed_password_123',
    isActive: true,
    accountStatus: 'ACTIVE',
  });

  const tokenA = jwt.sign({ id: testUserA._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  const authHeaders = {
    Authorization: `Bearer ${tokenA}`,
    'Content-Type': 'application/json',
  };

  try {
    // -------------------------------------------------------------
    // 1. Haversine & Distance Formatter Unit Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Math & Distance Label Unit Tests ---');

    // 1.1 Haversine distance between 2 points in Jaipur (~2.8 km)
    // Point 1: Hawa Mahal (26.9239, 75.8267), Point 2: Albert Hall (26.9116, 75.8195)
    const distMeters = locationService.calculateHaversineDistance(26.9239, 75.8267, 26.9116, 75.8195);
    assert(distMeters > 1300 && distMeters < 1600, `Haversine distance calculated accurately (${Math.round(distMeters)}m)`);

    // 1.2 Distance label formatting
    assert(locationService.formatDistanceLabel(0.4) === 'Less than a kilometer away', 'Distance < 1 km formatted');
    assert(locationService.formatDistanceLabel(3.2) === 'Around 3 km away', 'Distance 3.2 km formatted');
    assert(locationService.formatDistanceLabel(8.5) === 'Within 10 km', 'Distance 8.5 km formatted');
    assert(locationService.formatDistanceLabel(15) === 'Within 25 km', 'Distance 15 km formatted');
    assert(locationService.formatDistanceLabel(45) === 'Within 50 km', 'Distance 45 km formatted');
    assert(locationService.formatDistanceLabel(5, true) === 'Nearby', 'hideDistance returns "Nearby"');

    // -------------------------------------------------------------
    // 2. Coordinate Validation & Service Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Location Validation & Service Tests ---');

    // 2.1 First location update creates record with version 1
    const loc1 = await locationService.updateLocation(testUserA._id, {
      latitude: 26.9124,
      longitude: 75.7873,
      accuracyMeters: 15,
      requestId: 'req_001',
    });
    assert(loc1.locationStatus === 'CURRENT', 'First location update status is CURRENT');
    assert(loc1.locationVersion === 1, 'First location sets locationVersion to 1');
    assert(loc1.isSignificantMovement === true, 'First location marks isSignificantMovement as true');
    assert(!loc1.latitude && !loc1.longitude && !loc1.coordinates, 'Response contains zero coordinate fields');

    // 2.2 Insignificant movement (e.g. 50 meters) retains version 1
    // Moving 0.0004 deg lat is ~44 meters
    const loc2 = await locationService.updateLocation(testUserA._id, {
      latitude: 26.9128,
      longitude: 75.7873,
      accuracyMeters: 10,
    });
    assert(loc2.isSignificantMovement === false, 'Insignificant movement (< 500m) flagged as false');
    assert(loc2.locationVersion === 1, 'Insignificant movement does not increment locationVersion');

    // 2.3 Significant movement (e.g. moving 5 km) increments version to 2
    // Moving 0.045 deg lat is ~5 km
    const loc3 = await locationService.updateLocation(testUserA._id, {
      latitude: 26.9574,
      longitude: 75.7873,
      accuracyMeters: 20,
    });
    assert(loc3.isSignificantMovement === true, 'Significant movement (>= 500m) flagged as true');
    assert(loc3.locationVersion === 2, 'Significant movement increments locationVersion to 2');

    // 2.4 Retry with same requestId returns cached result without version increment
    const locRetry = await locationService.updateLocation(testUserA._id, {
      latitude: 26.9574,
      longitude: 75.7873,
      requestId: 'req_001',
    });
    assert(locRetry.locationVersion === 2, 'Retry with same requestId does not increment version');

    // 2.5 Validation error: Latitude out of range (> 90)
    try {
      await locationService.updateLocation(testUserA._id, { latitude: 95.0, longitude: 75.0 });
      assert(false, 'Latitude > 90 should throw');
    } catch (err) {
      assert(err.code === 'INVALID_LATITUDE', 'Latitude > 90 throws INVALID_LATITUDE');
    }

    // 2.6 Validation error: Longitude out of range (< -180)
    try {
      await locationService.updateLocation(testUserA._id, { latitude: 26.0, longitude: -185.0 });
      assert(false, 'Longitude < -180 should throw');
    } catch (err) {
      assert(err.code === 'INVALID_LONGITUDE', 'Longitude < -180 throws INVALID_LONGITUDE');
    }

    // 2.7 Validation error: Accuracy > 2000m
    try {
      await locationService.updateLocation(testUserA._id, { latitude: 26.0, longitude: 75.0, accuracyMeters: 2500 });
      assert(false, 'Accuracy > 2000m should throw');
    } catch (err) {
      assert(err.code === 'INVALID_LOCATION_ACCURACY', 'Accuracy > 2000m throws INVALID_LOCATION_ACCURACY');
    }

    // 2.8 Validation error: Stale capturedAt (> 60 mins old)
    try {
      const staleTime = new Date(Date.now() - 70 * 60 * 1000);
      await locationService.updateLocation(testUserA._id, { latitude: 26.0, longitude: 75.0, capturedAt: staleTime });
      assert(false, 'CapturedAt > 60 mins old should throw');
    } catch (err) {
      assert(err.code === 'LOCATION_UPDATE_TOO_OLD', 'CapturedAt > 60 mins old throws LOCATION_UPDATE_TOO_OLD');
    }

    // -------------------------------------------------------------
    // 3. Internal Geospatial Query Tests ($geoNear)
    // -------------------------------------------------------------
    console.log('\n--- 3. Geospatial Index & Query Tests ---');

    // Setup User B location in Mumbai (close to User A, ~3 km away)
    await locationService.updateLocation(testUserB._id, {
      latitude: 19.0900,
      longitude: 72.8800,
    });

    // Query nearby users within 10 km of Mumbai center (19.0760, 72.8777)
    const nearbyList = await locationService.findNearbyUserIds(72.8777, 19.0760, 10);
    const foundUserB = nearbyList.find((item) => item.userId === testUserB._id.toString());
    assert(foundUserB !== undefined, 'Nearby query successfully finds User B within 10 km');
    assert(foundUserB.distanceKm <= 10, `User B distance within 10 km (${foundUserB.distanceKm} km)`);
    assert(!foundUserB.location && !foundUserB.coordinates, 'Nearby query results contain no raw coordinates');

    // Query within 1 km (should exclude User B who is ~3 km away)
    const tightList = await locationService.findNearbyUserIds(72.8777, 19.0760, 1);
    const excludedUserB = tightList.find((item) => item.userId === testUserB._id.toString());
    assert(excludedUserB === undefined, 'Tight 1 km query correctly excludes distant User B');

    // -------------------------------------------------------------
    // 4. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. HTTP REST API Endpoint Tests ---');

    // 4.1 Unauthenticated PUT /v1/dating/location returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/dating/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 26.9124, longitude: 75.7873 }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated PUT /v1/dating/location returns 401');

    // 4.2 Authenticated PUT /v1/dating/location returns 200 OK
    const authRes = await fetch(`${BASE_URL}/v1/dating/location`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 26.9124,
        longitude: 75.7873,
        accuracyMeters: 12,
        source: 'GPS',
      }),
    });
    const authData = await authRes.json();
    assert(authRes.status === 200, 'Authenticated PUT /v1/dating/location returns 200 OK');
    assert(authData.success === true, 'Response has success: true envelope');
    assert(authData.data.locationStatus === 'CURRENT', 'Response confirms locationStatus: CURRENT');
    assert(!authData.data.latitude && !authData.data.coordinates, 'Response is privacy-safe (zero coordinates returned)');

    // 4.3 Client attempting to spoof another user's ID is rejected (403)
    const spoofRes = await fetch(`${BASE_URL}/v1/dating/location`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        userId: testUserB._id.toString(), // Attacker trying to update User B
        latitude: 26.9124,
        longitude: 75.7873,
      }),
    });
    const spoofData = await spoofRes.json();
    assert(spoofRes.status === 403, 'Attempting to spoof another user ID in body returns 403 Forbidden');
    assert(spoofData.error.code === 'UNAUTHORIZED_USER_ID', 'Returns error code UNAUTHORIZED_USER_ID');

    console.log('\n===========================================================');
    console.log(`LOCATION TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runLocationTests();
}

module.exports = runLocationTests;
