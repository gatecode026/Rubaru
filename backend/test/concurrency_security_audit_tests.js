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
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Chat = require('../models/Chat');
const Block = require('../models/Block');
const Report = require('../models/Report');
const OutboxEvent = require('../models/OutboxEvent');

// Services
const matchService = require('../services/matchService');
const safetyService = require('../services/safetyService');
const likeService = require('../services/likeService');

// Routes
const datingRoutes = require('../routes/datingRoutes');
const discoveryRoutes = require('../routes/discoveryRoutes');
const likeRoutes = require('../routes/likeRoutes');
const matchRoutes = require('../routes/matchRoutes');
const safetyRoutes = require('../routes/safetyRoutes');

async function runConcurrencySecurityAuditTests() {
  console.log('===========================================================');
  console.log('       RUBARU CONCURRENCY, SECURITY & IDOR AUDIT TESTS     ');
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

  const TEST_PORT = 5097;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // 1. Create Test Personas
    const userA = await User.create({ email: `audit_a_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userA._id, displayName: 'Audit User A', dateOfBirth: dob, age: 26, gender: 'Female', isDiscoverable: true, interests: ['Tech'] });
    await DatingPreference.create({ user: userA._id, genderPreference: ['Male'], ageRange: { min: 20, max: 35, isDealbreaker: true }, maxDistanceKm: 50, version: 1 });
    await UserLocation.create({ user: userA._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });
    const tokenA = jwt.sign({ id: userA._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };

    const userB = await User.create({ email: `audit_b_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userB._id, displayName: 'Audit User B', dateOfBirth: dob, age: 27, gender: 'Male', isDiscoverable: true, interests: ['Tech'] });
    await DatingPreference.create({ user: userB._id, genderPreference: ['Female'], ageRange: { min: 20, max: 35, isDealbreaker: true }, maxDistanceKm: 50, version: 1 });
    await UserLocation.create({ user: userB._id, location: { type: 'Point', coordinates: [75.80, 26.92] } });
    const tokenB = jwt.sign({ id: userB._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

    const userAttacker = await User.create({ email: `audit_att_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userAttacker._id, displayName: 'Attacker', dateOfBirth: dob, age: 30, gender: 'Male', isDiscoverable: true });
    const tokenAttacker = jwt.sign({ id: userAttacker._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAttacker = { Authorization: `Bearer ${tokenAttacker}`, 'Content-Type': 'application/json' };

    // -------------------------------------------------------------
    // 1. Concurrency & Race Condition Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Concurrency & Race Condition Tests ---');

    // 1.1 Create Like from User A to User B
    const likeDoc = await DatingInteraction.create({
      actor: userA._id,
      target: userB._id,
      type: 'LIKE',
      status: 'PENDING',
      targetElement: { type: 'PROFILE', elementId: 'main' },
      idempotencyKey: `audit_like_1_${Date.now()}`,
    });

    // Concurrent accept requests for the exact same like
    const [accept1, accept2] = await Promise.allSettled([
      matchService.acceptIncomingLike(userB._id, likeDoc._id),
      matchService.acceptIncomingLike(userB._id, likeDoc._id),
    ]);

    assert(accept1.status === 'fulfilled' && accept2.status === 'fulfilled', 'Concurrent accept requests both complete safely (200 OK)');
    assert(accept1.value.matched === true && accept2.value.matched === true, 'Both concurrent accepts confirm matched: true');
    assert(accept1.value.match.id === accept2.value.match.id, 'Idempotent canonical match ID returned to both concurrent requests');

    const matchCount = await Match.countDocuments({
      canonicalPair: `${[userA._id.toString(), userB._id.toString()].sort().join(':')}`,
    });
    assert(matchCount === 1, `Zero duplicate matches created under concurrency (total: ${matchCount})`);

    // -------------------------------------------------------------
    // 2. IDOR & Authorization Security Audit Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. IDOR & Authorization Security Audit Tests ---');

    // 2.1 Attacker attempting to accept User B's like
    const likeDoc2 = await DatingInteraction.create({
      actor: userA._id,
      target: userB._id,
      type: 'LIKE',
      status: 'PENDING',
      targetElement: { type: 'PROFILE', elementId: 'main' },
      idempotencyKey: `audit_like_2_${Date.now()}`,
    });

    try {
      await matchService.acceptIncomingLike(userAttacker._id, likeDoc2._id);
      assert(false, 'Attacker should not be able to accept another user like');
    } catch (err) {
      assert(err.code === 'LIKE_OWNERSHIP_INVALID', 'IDOR like acceptance rejected with LIKE_OWNERSHIP_INVALID (403)');
    }

    // 2.2 Attacker attempting to access User A & B match details
    const matchAB = await Match.findOne({
      canonicalPair: `${[userA._id.toString(), userB._id.toString()].sort().join(':')}`,
    });
    try {
      await matchService.getMatchDetails(userAttacker._id, matchAB._id);
      assert(false, 'Attacker should not access other users match details');
    } catch (err) {
      assert(err.code === 'MATCH_ACCESS_DENIED', 'IDOR match details access rejected with MATCH_ACCESS_DENIED (403)');
    }

    // 2.3 Self-block rejected
    try {
      await safetyService.blockUser(userA._id, userA._id);
      assert(false, 'Self-block should be rejected');
    } catch (err) {
      assert(err.code === 'SELF_BLOCK_NOT_ALLOWED', 'Self-block rejected with SELF_BLOCK_NOT_ALLOWED (400)');
    }

    // 2.4 Self-report rejected
    try {
      await safetyService.reportUser(userA._id, userA._id, { category: 'HARASSMENT', description: 'Test' });
      assert(false, 'Self-report should be rejected');
    } catch (err) {
      assert(err.code === 'SELF_REPORT_NOT_ALLOWED', 'Self-report rejected with SELF_REPORT_NOT_ALLOWED (400)');
    }

    // -------------------------------------------------------------
    // 3. Privacy & Leakage Audit Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Privacy & Leakage Audit Tests ---');

    const matchesList = await matchService.getMatchesList(userA._id);
    const matchItem = matchesList.items[0];

    assert(!matchItem.otherUser.coordinates && !matchItem.otherUser.location, 'Zero exact coordinates in Match DTO');
    assert(!matchItem.otherUser.dateOfBirth, 'Zero dateOfBirth in Match DTO');
    assert(!matchItem.otherUser.genderPreference, 'Zero private preferences in Match DTO');

    const outboxEvents = await OutboxEvent.find({
      aggregateId: { $in: [matchAB._id.toString(), userA._id.toString()] },
    });
    const hasCoordinatesInOutbox = outboxEvents.some((ev) => JSON.stringify(ev.payload).includes('coordinates'));
    assert(!hasCoordinatesInOutbox, 'Zero exact coordinates recorded in Outbox event payloads');

    console.log('\n===========================================================');
    console.log(`CONCURRENCY & SECURITY AUDIT TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runConcurrencySecurityAuditTests();
}

module.exports = runConcurrencySecurityAuditTests;
