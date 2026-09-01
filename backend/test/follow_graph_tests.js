require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');

// Services & Routes
const followService = require('../services/followService');
const safetyService = require('../services/safetyService');
const followRoutes = require('../routes/followRoutes');

async function runFollowGraphTests() {
  console.log('===========================================================');
  console.log('         RUBARU FOLLOW GRAPH INTEGRATION TEST SUITE        ');
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

  // Setup Test Server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/v1', followRoutes);

  const TEST_PORT = 5097;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users & Profiles
    const userA = await User.create({ email: `user_a_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileA = await Profile.create({ user: userA._id, displayName: 'Alice User', dateOfBirth: new Date('2000-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenA = jwt.sign({ id: userA._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };

    const userB = await User.create({ email: `user_b_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileB = await Profile.create({ user: userB._id, displayName: 'Bob User', dateOfBirth: new Date('1998-05-12'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenB = jwt.sign({ id: userB._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const userC = await User.create({ email: `user_c_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileC = await Profile.create({ user: userC._id, displayName: 'Charlie User', dateOfBirth: new Date('1999-09-09'), gender: 'Male', socialAccountVisibility: 'PRIVATE' });
    const tokenC = jwt.sign({ id: userC._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersC = { Authorization: `Bearer ${tokenC}`, 'Content-Type': 'application/json' };

    // -------------------------------------------------------------
    // 1. Model Level Validation Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Model Level Validation Tests ---');

    const validRel = new FollowRelationship({
      followerId: userA._id,
      followingId: userB._id,
      status: 'ACCEPTED',
    });
    await validRel.validate();
    assert(true, 'Valid FollowRelationship passes schema validation');

    let selfFollowFailed = false;
    try {
      const selfRel = new FollowRelationship({
        followerId: userA._id,
        followingId: userA._id,
        status: 'PENDING',
      });
      await selfRel.validate();
    } catch (e) {
      selfFollowFailed = true;
    }
    assert(selfFollowFailed, 'Self-follow is rejected by model validator');

    // -------------------------------------------------------------
    // 2. Public Account Follow API Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Public Account Follow API Tests ---');

    // 2.1 Unauthenticated request returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/users/${userB._id}/follow`, { method: 'POST' });
    assert(unauthRes.status === 401, 'Unauthenticated POST /v1/users/:id/follow returns 401');

    // 2.2 Self-follow returns 400
    const selfRes = await fetch(`${BASE_URL}/v1/users/${userA._id}/follow`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const selfData = await selfRes.json();
    assert(selfRes.status === 400, 'Self-follow returns 400 Bad Request');
    assert(selfData.code === 'SELF_FOLLOW_DISALLOWED', 'Returns SELF_FOLLOW_DISALLOWED code');

    // 2.3 Follow public user (Alice follows Bob) -> 200 ACCEPTED
    const followBRes = await fetch(`${BASE_URL}/v1/users/${userB._id}/follow`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const followBData = await followBRes.json();
    assert(followBRes.status === 200, 'Following public user returns 200 OK');
    assert(followBData.data.relationship.status === 'ACCEPTED', 'Public follow status is ACCEPTED');
    assert(followBData.data.relationship.isFollowing === true, 'isFollowing is true');

    // Check counters incremented
    const pA1 = await Profile.findOne({ user: userA._id });
    const pB1 = await Profile.findOne({ user: userB._id });
    assert(pA1.followingCount === 1, "Alice followingCount incremented to 1");
    assert(pB1.followersCount === 1, "Bob followersCount incremented to 1");

    // 2.4 Duplicate follow request is idempotent
    const dupFollowRes = await fetch(`${BASE_URL}/v1/users/${userB._id}/follow`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const dupFollowData = await dupFollowRes.json();
    assert(dupFollowRes.status === 200, 'Duplicate follow request returns 200 OK');
    assert(dupFollowData.data.relationship.status === 'ACCEPTED', 'Status remains ACCEPTED');

    // Counters must not change twice
    const pA2 = await Profile.findOne({ user: userA._id });
    assert(pA2.followingCount === 1, 'Duplicate follow does not increment counter twice');

    // -------------------------------------------------------------
    // 3. Private Account & Follow Requests Lifecycle Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Private Account & Follow Request Lifecycle Tests ---');

    // 3.1 Alice requests to follow private user Charlie -> PENDING
    const reqCRes = await fetch(`${BASE_URL}/v1/users/${userC._id}/follow`, {
      method: 'POST',
      headers: authHeadersA,
    });
    const reqCData = await reqCRes.json();
    assert(reqCRes.status === 200, 'Requesting private user returns 200 OK');
    assert(reqCData.data.relationship.status === 'PENDING', 'Relationship status is PENDING');
    assert(reqCData.data.relationship.requestPending === true, 'requestPending is true');

    // 3.2 Alice cancels the request
    const cancelRes = await fetch(`${BASE_URL}/v1/users/${userC._id}/follow`, {
      method: 'DELETE',
      headers: authHeadersA,
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, 'Cancelling pending request returns 200 OK');
    assert(cancelData.data.relationship.status === 'NONE', 'Status transitioned to NONE');

    // 3.3 Alice re-requests Charlie
    await fetch(`${BASE_URL}/v1/users/${userC._id}/follow`, { method: 'POST', headers: authHeadersA });

    // 3.4 Charlie views pending requests
    const pendingRes = await fetch(`${BASE_URL}/v1/follow-requests`, { headers: authHeadersC });
    const pendingData = await pendingRes.json();
    assert(pendingRes.status === 200, 'GET /v1/follow-requests returns 200 OK');
    assert(pendingData.data.items.length === 1, 'Charlie has 1 pending follow request');
    const requestId = pendingData.data.items[0].requestId;

    // 3.5 Bob (unauthorized) attempts to accept Alice's request to Charlie -> 403
    const unauthAcceptRes = await fetch(`${BASE_URL}/v1/follow-requests/${requestId}/accept`, {
      method: 'POST',
      headers: authHeadersB,
    });
    assert(unauthAcceptRes.status === 403, 'Unauthorized accept returns 403 Forbidden');

    // 3.6 Charlie accepts the request
    const acceptRes = await fetch(`${BASE_URL}/v1/follow-requests/${requestId}/accept`, {
      method: 'POST',
      headers: authHeadersC,
    });
    const acceptData = await acceptRes.json();
    assert(acceptRes.status === 200, 'Charlie accepts request returns 200 OK');
    assert(acceptData.data.status === 'ACCEPTED', 'Status transitioned to ACCEPTED');

    // Check counters
    const pA3 = await Profile.findOne({ user: userA._id });
    const pC3 = await Profile.findOne({ user: userC._id });
    assert(pA3.followingCount === 2, 'Alice followingCount is now 2');
    assert(pC3.followersCount === 1, 'Charlie followersCount is now 1');

    // -------------------------------------------------------------
    // 4. Followers & Following Lists & Privacy Authorization Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Followers & Following Lists Tests ---');

    // 4.1 Bob queries Bob's followers -> Alice is in list
    const bobFollowersRes = await fetch(`${BASE_URL}/v1/users/${userB._id}/followers`, { headers: authHeadersB });
    const bobFollowersData = await bobFollowersRes.json();
    assert(bobFollowersRes.status === 200, 'Get Bob followers returns 200 OK');
    assert(bobFollowersData.data.items.some((i) => i.userId === userA._id.toString()), 'Alice is in Bob followers list');

    // 4.2 Bob queries Charlie's followers (Bob does not follow private Charlie) -> 403
    const bobQueryCRes = await fetch(`${BASE_URL}/v1/users/${userC._id}/followers`, { headers: authHeadersB });
    assert(bobQueryCRes.status === 403, 'Non-follower accessing private account list returns 403 Forbidden');

    // 4.3 Alice queries Charlie's followers (Alice is accepted follower) -> 200 OK
    const aliceQueryCRes = await fetch(`${BASE_URL}/v1/users/${userC._id}/followers`, { headers: authHeadersA });
    const aliceQueryCData = await aliceQueryCRes.json();
    assert(aliceQueryCRes.status === 200, 'Accepted follower accessing private account list returns 200 OK');
    assert(aliceQueryCData.data.items.length === 1, 'Returns Charlie followers list');

    // -------------------------------------------------------------
    // 5. Follower Removal & Unfollow Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Follower Removal & Unfollow Tests ---');

    // 5.1 Bob removes Alice as follower
    const removeRes = await fetch(`${BASE_URL}/v1/users/${userA._id}/followers`, {
      method: 'DELETE',
      headers: authHeadersB,
    });
    const removeData = await removeRes.json();
    assert(removeRes.status === 200, 'Bob removing Alice as follower returns 200 OK');
    assert(removeData.data.removed === true, 'Response confirms removed: true');

    const pB4 = await Profile.findOne({ user: userB._id });
    assert(pB4.followersCount === 0, 'Bob followersCount safely decremented to 0');

    // 5.2 Alice unfollows Charlie
    const unfollowCRes = await fetch(`${BASE_URL}/v1/users/${userC._id}/follow`, {
      method: 'DELETE',
      headers: authHeadersA,
    });
    assert(unfollowCRes.status === 200, 'Alice unfollowing Charlie returns 200 OK');

    const pA4 = await Profile.findOne({ user: userA._id });
    assert(pA4.followingCount === 0, 'Alice followingCount safely decremented to 0');

    // -------------------------------------------------------------
    // 6. Bilateral Block Integration Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Bilateral Block Integration Tests ---');

    // Setup: Alice follows Bob again (ACCEPTED)
    await fetch(`${BASE_URL}/v1/users/${userB._id}/follow`, { method: 'POST', headers: authHeadersA });
    const pB5 = await Profile.findOne({ user: userB._id });
    assert(pB5.followersCount === 1, 'Bob followersCount is 1 prior to block');

    // Bob blocks Alice using safetyService
    await safetyService.blockUser(userB._id, userA._id, { reason: 'TEST_BLOCK' });

    // Verify relationship revoked
    const relAfterBlock = await FollowRelationship.findOne({ followerId: userA._id, followingId: userB._id });
    assert(relAfterBlock.status === 'REMOVED', 'Follow relationship transitioned to REMOVED after block');

    const pB6 = await Profile.findOne({ user: userB._id });
    assert(pB6.followersCount === 0, 'Bob followersCount decremented to 0 after block');

    // Alice attempting to follow Bob is rejected (400 USER_UNAVAILABLE)
    const blockFollowRes = await fetch(`${BASE_URL}/v1/users/${userB._id}/follow`, {
      method: 'POST',
      headers: authHeadersA,
    });
    assert(blockFollowRes.status === 400, 'Blocked user cannot follow (returns 400)');

    // -------------------------------------------------------------
    // 7. Privacy Settings & Reconciliation Tests
    // -------------------------------------------------------------
    console.log('\n--- 7. Privacy Settings & Reconciliation Tests ---');

    // 7.1 Alice changes privacy setting to PRIVATE
    const privacyRes = await fetch(`${BASE_URL}/v1/users/me/social-privacy`, {
      method: 'PATCH',
      headers: authHeadersA,
      body: JSON.stringify({ socialAccountVisibility: 'PRIVATE' }),
    });
    const privacyData = await privacyRes.json();
    assert(privacyRes.status === 200, 'PATCH /v1/users/me/social-privacy returns 200 OK');
    assert(privacyData.data.socialAccountVisibility === 'PRIVATE', 'Alice privacy setting is now PRIVATE');

    // 7.2 Run reconciliation tool
    const reconResult = await followService.reconcileFollowCounts(userA._id);
    assert(reconResult.actualFollowers === 0 && reconResult.actualFollowing === 0, 'Reconciliation confirms accurate counts (0, 0)');

    console.log('\n===========================================================');
    console.log(`FOLLOW GRAPH TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runFollowGraphTests();
}

module.exports = runFollowGraphTests;
