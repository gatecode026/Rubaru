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
const UserEntitlement = require('../models/UserEntitlement');
const DatingInteraction = require('../models/DatingInteraction');
const OutboxEvent = require('../models/OutboxEvent');
const Block = require('../models/Block');
const Match = require('../models/Match');
const Chat = require('../models/Chat');

// Services & Routes
const matchService = require('../services/matchService');
const likeService = require('../services/likeService');
const incomingLikeService = require('../services/incomingLikeService');
const discoveryService = require('../services/discoveryService');
const likeRoutes = require('../routes/likeRoutes');

async function runMatchTests() {
  console.log('===========================================================');
  console.log('       RUBARU ATOMIC MATCH CREATION INTEGRATION TESTS      ');
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

    // 1. Create Users
    // User A (Sender)
    const userA = await User.create({ email: `user_a_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userA._id, displayName: 'Aarav (User A)', dateOfBirth: dob, age: 26, gender: 'Male', isDiscoverable: true, interests: ['Tech'] });
    await UserLocation.create({ user: userA._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });
    await UserEntitlement.create({ user: userA._id, dailyFreeLikesLimit: 25, likesUsedToday: 0, rosesBalance: 1, priorityLikesBalance: 0 });

    // User B (Recipient / Acceptor)
    const userB = await User.create({ email: `user_b_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userB._id, displayName: 'Diya (User B)', dateOfBirth: dob, age: 25, gender: 'Female', isDiscoverable: true, interests: ['Tech'] });
    await UserLocation.create({ user: userB._id, location: { type: 'Point', coordinates: [75.80, 26.92] } });
    await UserEntitlement.create({ user: userB._id, dailyFreeLikesLimit: 25, likesUsedToday: 0, rosesBalance: 1, priorityLikesBalance: 0 });

    // User C & User D for Reciprocal Like Path
    const userC = await User.create({ email: `user_c_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userC._id, displayName: 'Chetan (User C)', dateOfBirth: dob, age: 28, gender: 'Male', isDiscoverable: true });
    await DatingPreference.create({ user: userC._id, genderPreference: ['Female'], ageRange: { min: 20, max: 35, isDealbreaker: false }, maxDistanceKm: 100, version: 1 });
    await UserLocation.create({ user: userC._id, location: { type: 'Point', coordinates: [75.79, 26.93] } });
    await UserEntitlement.create({ user: userC._id, dailyFreeLikesLimit: 25, likesUsedToday: 0, rosesBalance: 1, priorityLikesBalance: 0 });

    const userD = await User.create({ email: `user_d_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userD._id, displayName: 'Divya (User D)', dateOfBirth: dob, age: 27, gender: 'Female', isDiscoverable: true });
    await DatingPreference.create({ user: userD._id, genderPreference: ['Male'], ageRange: { min: 20, max: 35, isDealbreaker: false }, maxDistanceKm: 100, version: 1 });
    await UserLocation.create({ user: userD._id, location: { type: 'Point', coordinates: [75.81, 26.92] } });
    await UserEntitlement.create({ user: userD._id, dailyFreeLikesLimit: 25, likesUsedToday: 0, rosesBalance: 1, priorityLikesBalance: 0 });

    const tokenB = jwt.sign({ id: userB._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersB = {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    };

    // -------------------------------------------------------------
    // 1. Path A: Incoming Like Acceptance Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Path A: Incoming Like Acceptance Tests ---');

    // User A sends Like to User B
    const likeDocAB = await DatingInteraction.create({
      actor: userA._id,
      target: userB._id,
      type: 'LIKE',
      status: 'PENDING',
      idempotencyKey: `match_like_ab_${timestamp}`,
    });

    // 1.1 Sender cannot accept own like
    try {
      await matchService.acceptIncomingLike(userA._id, likeDocAB._id);
      assert(false, 'Sender cannot accept their own like');
    } catch (err) {
      assert(err.code === 'LIKE_OWNERSHIP_INVALID', 'Sender accepting own like throws LIKE_OWNERSHIP_INVALID (403)');
    }

    // 1.2 User B accepts Like from User A
    const matchResAB = await matchService.acceptIncomingLike(userB._id, likeDocAB._id);
    assert(matchResAB.matched === true, 'Like acceptance returns matched: true');
    assert(typeof matchResAB.match.id === 'string', 'Returns match ID');
    assert(typeof matchResAB.conversation.id === 'string', 'Returns conversation ID');
    assert(matchResAB.match.otherUser.displayName === 'Aarav (User A)', 'otherUser populated with sender details');

    // 1.3 Verify Database States
    const updatedLikeAB = await DatingInteraction.findById(likeDocAB._id);
    assert(updatedLikeAB.status === 'ACCEPTED', 'Like status updated to ACCEPTED');
    assert(updatedLikeAB.acceptedAt !== null, 'acceptedAt timestamp is stored');

    const createdMatchAB = await Match.findById(matchResAB.match.id);
    assert(createdMatchAB !== null && createdMatchAB.status === 'ACTIVE', 'Match document created with status ACTIVE');
    const [lowerAB, higherAB] = [userA._id.toString(), userB._id.toString()].sort();
    assert(createdMatchAB.canonicalPair === `${lowerAB}:${higherAB}`, 'Canonical pair is deterministic and sorted');

    const createdChatAB = await Chat.findById(matchResAB.conversation.id);
    assert(createdChatAB !== null && createdChatAB.status === 'ACTIVE', 'Chat document created with status ACTIVE');
    assert(createdChatAB.participants.length === 2, 'Chat has exactly two participants');
    assert(createdChatAB.match.toString() === createdMatchAB._id.toString(), 'Chat references Match ID');

    // 1.4 Outbox Event Recorded
    const outboxMatch = await OutboxEvent.findOne({ eventType: 'match.created', aggregateId: createdMatchAB._id.toString() });
    assert(outboxMatch !== null, 'match.created outbox event is recorded');

    // 1.5 Idempotent retry returns original match
    const retryMatchRes = await matchService.acceptIncomingLike(userB._id, likeDocAB._id);
    assert(retryMatchRes.match.id === matchResAB.match.id, 'Idempotent accept retry returns original match ID');

    // -------------------------------------------------------------
    // 2. Path B: Reciprocal Outgoing Like Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Path B: Reciprocal Outgoing Like Tests ---');

    // Setup Recommendation Batches for C and D
    const RecommendationBatch = require('../models/RecommendationBatch');
    const { v4: uuidv4 } = require('uuid');

    const batchCD = await RecommendationBatch.create({
      viewer: userC._id,
      batchId: `batch_c_${uuidv4()}`,
      preferenceVersion: 1,
      candidates: [userD._id],
      candidateIds: [userD._id],
      expiresAt: new Date(Date.now() + 86400000),
    });

    const batchDC = await RecommendationBatch.create({
      viewer: userD._id,
      batchId: `batch_d_${uuidv4()}`,
      preferenceVersion: 1,
      candidates: [userC._id],
      candidateIds: [userC._id],
      expiresAt: new Date(Date.now() + 86400000),
    });

    // Step 1: User C sends Like to User D (via likeService)
    const recD = `rec_${batchCD.batchId}_${userD._id}`;
    const sendLikeCD = await likeService.createLike(userC._id, {
      recommendationId: recD,
      type: 'LIKE',
      idempotencyKey: `idem_cd_${timestamp}`,
    });
    assert(sendLikeCD.mutualInterestPending === false, 'First outgoing like has mutualInterestPending: false');
    assert(sendLikeCD.like.status === 'PENDING', 'First outgoing like is PENDING');

    // Step 2: User D independently sends Like to User C (Reciprocal Like)
    const recC = `rec_${batchDC.batchId}_${userC._id}`;
    const sendLikeDC = await likeService.createLike(userD._id, {
      recommendationId: recC,
      type: 'LIKE',
      idempotencyKey: `idem_dc_${timestamp}`,
    });

    assert(sendLikeDC.mutualInterestPending === true, 'Reciprocal outgoing like detects mutual interest');
    assert(sendLikeDC.match !== null && typeof sendLikeDC.match.id === 'string', 'Reciprocal like returns match document');
    assert(sendLikeDC.conversation !== null && typeof sendLikeDC.conversation.id === 'string', 'Reciprocal like returns conversation document');

    // Verify both interactions are now ACCEPTED
    const likeCD = await DatingInteraction.findOne({ actor: userC._id, target: userD._id });
    const likeDC = await DatingInteraction.findOne({ actor: userD._id, target: userC._id });
    assert(likeCD.status === 'ACCEPTED', 'Initiator interaction updated to ACCEPTED');
    assert(likeDC.status === 'ACCEPTED', 'Acceptor interaction created as ACCEPTED');

    // -------------------------------------------------------------
    // 3. Safety, Blocking & Rematch Rules
    // -------------------------------------------------------------
    console.log('\n--- 3. Safety, Blocking & Rematch Rules ---');

    const blockedUser = await User.create({ email: `blocked_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Block.create({ blocker: userB._id, blocked: blockedUser._id });

    const blockedLike = await DatingInteraction.create({
      actor: blockedUser._id,
      target: userB._id,
      type: 'LIKE',
      status: 'PENDING',
      idempotencyKey: `blocked_like_${timestamp}`,
    });

    try {
      await matchService.acceptIncomingLike(userB._id, blockedLike._id);
      assert(false, 'Blocked user cannot be matched');
    } catch (err) {
      assert(err.code === 'MATCH_NOT_ALLOWED', 'Accepting like from blocked user throws MATCH_NOT_ALLOWED (403)');
    }

    // -------------------------------------------------------------
    // 4. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. HTTP REST API Endpoint Tests ---');

    // Create a new like for User B
    const userE = await User.create({ email: `user_e_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userE._id, displayName: 'Esha (User E)', dateOfBirth: dob, age: 24, gender: 'Female', isDiscoverable: true });
    await UserLocation.create({ user: userE._id, location: { type: 'Point', coordinates: [75.82, 26.94] } });

    const likeEB = await DatingInteraction.create({
      actor: userE._id,
      target: userB._id,
      type: 'ROSE',
      status: 'PENDING',
      idempotencyKey: `api_accept_like_${timestamp}`,
    });

    // 4.1 Unauthenticated POST /v1/likes/:id/accept returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/likes/${likeEB._id}/accept`, { method: 'POST' });
    assert(unauthRes.status === 401, 'Unauthenticated POST /v1/likes/:id/accept returns 401');

    // 4.2 Authenticated POST /v1/likes/:id/accept returns 200 OK
    const authAcceptRes = await fetch(`${BASE_URL}/v1/likes/${likeEB._id}/accept`, {
      method: 'POST',
      headers: authHeadersB,
      body: JSON.stringify({ idempotencyKey: `idem_api_accept_${timestamp}` }),
    });
    const authAcceptData = await authAcceptRes.json();
    assert(authAcceptRes.status === 200, 'Authenticated POST /v1/likes/:id/accept returns 200 OK');
    assert(authAcceptData.success === true && authAcceptData.data.matched === true, 'Accept API response confirms matched: true');
    assert(authAcceptData.data.match && authAcceptData.data.conversation, 'Accept API returns match and conversation payload');

    // 4.3 Matched user no longer appears in pending incoming likes
    const recipientInbox = await incomingLikeService.getIncomingLikes(userB._id);
    const pendingIds = recipientInbox.items.map((i) => i.likeId);
    assert(!pendingIds.includes(likeEB._id.toString()), 'Accepted like is removed from incoming inbox');

    console.log('\n===========================================================');
    console.log(`MATCH CREATION TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runMatchTests();
}

module.exports = runMatchTests;
