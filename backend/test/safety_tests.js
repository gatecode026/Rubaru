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

// Services & Routes
const safetyService = require('../services/safetyService');
const matchRoutes = require('../routes/matchRoutes');
const safetyRoutes = require('../routes/safetyRoutes');

async function runSafetyTests() {
  console.log('===========================================================');
  console.log('       RUBARU SAFETY: UNMATCH, BLOCK & REPORT TESTS        ');
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
  app.use('/v1/matches', matchRoutes);
  app.use('/v1/users', safetyRoutes);

  const TEST_PORT = 5095;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // 1. Create Test Users
    const userA = await User.create({ email: `s_user_a_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userA._id, displayName: 'Ananya', dateOfBirth: dob, age: 25, gender: 'Female', isDiscoverable: true });
    await UserLocation.create({ user: userA._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });
    const tokenA = jwt.sign({ id: userA._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };

    const userB = await User.create({ email: `s_user_b_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userB._id, displayName: 'Kabir', dateOfBirth: dob, age: 27, gender: 'Male', isDiscoverable: true });
    await UserLocation.create({ user: userB._id, location: { type: 'Point', coordinates: [75.80, 26.92] } });

    const userC = await User.create({ email: `s_user_c_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: userC._id, displayName: 'Third Party', dateOfBirth: dob, age: 28, gender: 'Male', isDiscoverable: true });

    // 2. Create Active Match between userA and userB
    const chatAB = await Chat.create({ participants: [userA._id, userB._id], isGroup: false, status: 'ACTIVE' });
    const [lowerAB, higherAB] = [userA._id.toString(), userB._id.toString()].sort();
    const matchAB = await Match.create({
      canonicalPair: `${lowerAB}:${higherAB}`,
      user1: lowerAB,
      user2: higherAB,
      users: [lowerAB, higherAB],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      conversation: chatAB._id,
      matchedAt: new Date(),
    });
    chatAB.match = matchAB._id;
    await chatAB.save();

    // -------------------------------------------------------------
    // 1. Unmatch Flow Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Unmatch Flow Tests ---');

    // 1.1 Non-member cannot unmatch
    try {
      await safetyService.unmatchUser(userC._id, matchAB._id);
      assert(false, 'Non-member should not be able to unmatch');
    } catch (err) {
      assert(err.code === 'MATCH_ACCESS_DENIED', 'Non-member unmatch throws MATCH_ACCESS_DENIED (403)');
    }

    // 1.2 Member unmatches successfully
    const unmatchRes = await safetyService.unmatchUser(userA._id, matchAB._id, { reason: 'LOST_INTEREST' });
    assert(unmatchRes.unmatched === true, 'Unmatch action returns unmatched: true');

    const updatedMatchAB = await Match.findById(matchAB._id);
    assert(updatedMatchAB.status === 'UNMATCHED', 'Match status updated to UNMATCHED');
    assert(updatedMatchAB.endedBy.toString() === userA._id.toString(), 'endedBy records initiating user');

    const updatedChatAB = await Chat.findById(chatAB._id);
    assert(updatedChatAB.status === 'CLOSED', 'Chat status updated to CLOSED');

    const outboxUnmatch = await OutboxEvent.findOne({ eventType: 'match.unmatched', aggregateId: matchAB._id.toString() });
    assert(outboxUnmatch !== null, 'match.unmatched outbox event is recorded');

    // 1.3 Idempotent unmatch retry returns safe result
    const unmatchRetry = await safetyService.unmatchUser(userA._id, matchAB._id);
    assert(unmatchRetry.unmatched === true, 'Idempotent unmatch retry returns success');

    // -------------------------------------------------------------
    // 2. Block & Unblock Flow Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Block & Unblock Flow Tests ---');

    // 2.1 Self-block rejected
    try {
      await safetyService.blockUser(userA._id, userA._id);
      assert(false, 'Self-block should be rejected');
    } catch (err) {
      assert(err.code === 'SELF_BLOCK_NOT_ALLOWED', 'Self-block throws SELF_BLOCK_NOT_ALLOWED (400)');
    }

    // 2.2 User A blocks User B
    const blockRes = await safetyService.blockUser(userA._id, userB._id, { reason: 'SPAM' });
    assert(blockRes.blocked === true, 'Block action returns blocked: true');

    const blockDoc = await Block.findOne({ blocker: userA._id, blocked: userB._id });
    assert(blockDoc !== null, 'Block document persisted');

    const blockedMatchAB = await Match.findById(matchAB._id);
    assert(blockedMatchAB.status === 'BLOCKED', 'Match status transitioned to BLOCKED');

    const outboxBlock = await OutboxEvent.findOne({ eventType: 'user.blocked', aggregateId: blockDoc._id.toString() });
    assert(outboxBlock !== null, 'user.blocked outbox event is recorded');

    // 2.3 Unblock User B
    const unblockRes = await safetyService.unblockUser(userA._id, userB._id);
    assert(unblockRes.unblocked === true, 'Unblock action returns unblocked: true');

    const deletedBlock = await Block.findOne({ blocker: userA._id, blocked: userB._id });
    assert(deletedBlock === null, 'Block document deleted on unblock');

    const outboxUnblock = await OutboxEvent.findOne({ eventType: 'user.unblocked' });
    assert(outboxUnblock !== null, 'user.unblocked outbox event is recorded');

    // -------------------------------------------------------------
    // 3. Report Flow Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Report Flow Tests ---');

    // 3.1 Self-report rejected
    try {
      await safetyService.reportUser(userA._id, userA._id, { category: 'HARASSMENT', description: 'Test' });
      assert(false, 'Self-report should be rejected');
    } catch (err) {
      assert(err.code === 'SELF_REPORT_NOT_ALLOWED', 'Self-report throws SELF_REPORT_NOT_ALLOWED (400)');
    }

    // 3.2 Invalid category rejected
    try {
      await safetyService.reportUser(userA._id, userB._id, { category: 'NOT_A_CATEGORY', description: 'Test' });
      assert(false, 'Invalid category should be rejected');
    } catch (err) {
      assert(err.code === 'INVALID_REPORT_CATEGORY', 'Invalid category throws INVALID_REPORT_CATEGORY (400)');
    }

    // 3.3 Valid Report submission
    const reportRes = await safetyService.reportUser(userA._id, userB._id, {
      category: 'HARASSMENT',
      description: 'User was rude and harassing in chat',
    });
    assert(reportRes.reported === true, 'Report action returns reported: true');
    assert(typeof reportRes.reportId === 'string', 'Returns generated report ID');

    const reportDoc = await Report.findById(reportRes.reportId);
    assert(reportDoc !== null && reportDoc.status === 'PENDING', 'Report persisted with status PENDING');

    const outboxReport = await OutboxEvent.findOne({ eventType: 'report.created', aggregateId: reportDoc._id.toString() });
    assert(outboxReport !== null, 'report.created outbox event is recorded');

    // 3.4 Combined Report and Block
    const userD = await User.create({ email: `s_user_d_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const combinedRes = await safetyService.reportUser(userA._id, userD._id, {
      category: 'FAKE_PROFILE',
      description: 'Profile photos are stolen from a celebrity',
      alsoBlock: true,
    });
    assert(combinedRes.reported === true && combinedRes.alsoBlocked === true, 'Combined report and block succeeds');

    const combinedBlockDoc = await Block.findOne({ blocker: userA._id, blocked: userD._id });
    assert(combinedBlockDoc !== null, 'Block created automatically when alsoBlock is true');

    // -------------------------------------------------------------
    // 4. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. HTTP REST API Endpoint Tests ---');

    // Create a fresh match for API test
    const userE = await User.create({ email: `s_user_e_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const chatAE = await Chat.create({ participants: [userA._id, userE._id], isGroup: false, status: 'ACTIVE' });
    const [lowerAE, higherAE] = [userA._id.toString(), userE._id.toString()].sort();
    const matchAE = await Match.create({
      canonicalPair: `${lowerAE}:${higherAE}`,
      user1: lowerAE,
      user2: higherAE,
      users: [lowerAE, higherAE],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      conversation: chatAE._id,
      matchedAt: new Date(),
    });

    // 4.1 POST /v1/matches/:id/unmatch
    const apiUnmatchRes = await fetch(`${BASE_URL}/v1/matches/${matchAE._id}/unmatch`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ reason: 'NOT_A_MATCH' }),
    });
    const apiUnmatchData = await apiUnmatchRes.json();
    assert(apiUnmatchRes.status === 200, 'POST /v1/matches/:id/unmatch returns 200 OK');
    assert(apiUnmatchData.success === true && apiUnmatchData.data.unmatched === true, 'Unmatch API returns unmatched: true');

    // 4.2 POST /v1/users/:id/block
    const apiBlockRes = await fetch(`${BASE_URL}/v1/users/${userE._id}/block`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ reason: 'SAFETY_CONCERN' }),
    });
    const apiBlockData = await apiBlockRes.json();
    assert(apiBlockRes.status === 200, 'POST /v1/users/:id/block returns 200 OK');
    assert(apiBlockData.success === true && apiBlockData.data.blocked === true, 'Block API returns blocked: true');

    // 4.3 DELETE /v1/users/:id/block
    const apiUnblockRes = await fetch(`${BASE_URL}/v1/users/${userE._id}/block`, {
      method: 'DELETE',
      headers: authHeadersA,
    });
    const apiUnblockData = await apiUnblockRes.json();
    assert(apiUnblockRes.status === 200, 'DELETE /v1/users/:id/block returns 200 OK');
    assert(apiUnblockData.success === true && apiUnblockData.data.unblocked === true, 'Unblock API returns unblocked: true');

    // 4.4 POST /v1/users/:id/report
    const apiReportRes = await fetch(`${BASE_URL}/v1/users/${userE._id}/report`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        category: 'INAPPROPRIATE_CONTENT',
        description: 'Explicit messages sent',
        alsoBlock: true,
      }),
    });
    const apiReportData = await apiReportRes.json();
    assert(apiReportRes.status === 200, 'POST /v1/users/:id/report returns 200 OK');
    assert(apiReportData.success === true && apiReportData.data.reported === true, 'Report API returns reported: true');

    console.log('\n===========================================================');
    console.log(`SAFETY TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runSafetyTests();
}

module.exports = runSafetyTests;
