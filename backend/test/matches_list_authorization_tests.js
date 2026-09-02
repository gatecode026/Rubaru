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
const UserLocation = require('../models/UserLocation');
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Block = require('../models/Block');

// Services & Routes
const matchService = require('../services/matchService');
const matchAuthorizationService = require('../services/matchAuthorizationService');
const matchRoutes = require('../routes/matchRoutes');
const chatRoutes = require('../routes/chatRoutes');

async function runMatchesListAuthTests() {
  console.log('===========================================================');
  console.log('       RUBARU MATCHES LIST & CHAT AUTH INTEGRATION TESTS    ');
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
  app.use('/api/chats', chatRoutes);

  const TEST_PORT = 5094;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // 1. Create Test Users
    // User 1 (Viewer)
    const user1 = await User.create({ email: `m_user1_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: user1._id, displayName: 'Kavya', dateOfBirth: dob, age: 26, gender: 'Female', isDiscoverable: true, interests: ['Art'] });
    await UserLocation.create({ user: user1._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });
    const token1 = jwt.sign({ id: user1._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders1 = { Authorization: `Bearer ${token1}`, 'Content-Type': 'application/json' };

    // User 2 (Match 1)
    const user2 = await User.create({ email: `m_user2_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: user2._id, displayName: 'Aarav (Match 1)', dateOfBirth: dob, age: 27, gender: 'Male', isDiscoverable: true, interests: ['Art', 'Music'] });
    await UserLocation.create({ user: user2._id, location: { type: 'Point', coordinates: [75.80, 26.92] } });

    // User 3 (Match 2)
    const user3 = await User.create({ email: `m_user3_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: user3._id, displayName: 'Dev (Match 2)', dateOfBirth: dob, age: 28, gender: 'Male', isDiscoverable: true, interests: ['Travel'] });
    await UserLocation.create({ user: user3._id, location: { type: 'Point', coordinates: [75.81, 26.93] } });

    // User 4 (Stranger / Third Party)
    const user4 = await User.create({ email: `m_user4_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: user4._id, displayName: 'Stranger', dateOfBirth: dob, age: 29, gender: 'Male', isDiscoverable: true });
    const token4 = jwt.sign({ id: user4._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders4 = { Authorization: `Bearer ${token4}`, 'Content-Type': 'application/json' };

    // 2. Create Active Dating Matches & Chats
    // Match 1: User 1 & User 2
    const chat12 = await Chat.create({ participants: [user1._id, user2._id], isGroup: false, status: 'ACTIVE' });
    const [lower12, higher12] = [user1._id.toString(), user2._id.toString()].sort();
    const match12 = await Match.create({
      canonicalPair: `${lower12}:${higher12}`,
      user1: lower12,
      user2: higher12,
      users: [lower12, higher12],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      conversation: chat12._id,
      matchedAt: new Date(Date.now() - 2000),
    });
    chat12.match = match12._id;
    await chat12.save();

    // Match 2: User 1 & User 3
    const chat13 = await Chat.create({ participants: [user1._id, user3._id], isGroup: false, status: 'ACTIVE' });
    const [lower13, higher13] = [user1._id.toString(), user3._id.toString()].sort();
    const match13 = await Match.create({
      canonicalPair: `${lower13}:${higher13}`,
      user1: lower13,
      user2: higher13,
      users: [lower13, higher13],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      conversation: chat13._id,
      matchedAt: new Date(Date.now() - 1000),
    });
    chat13.match = match13._id;
    await chat13.save();

    // -------------------------------------------------------------
    // 1. Matches List Query & Privacy DTO Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Matches List Query & Privacy DTO Tests ---');

    const matchList = await matchService.getMatchesList(user1._id, { limit: 10 });
    assert(Array.isArray(matchList.items), 'getMatchesList returns items array');
    assert(matchList.items.length === 2, `Returns exactly 2 active matches (got ${matchList.items.length})`);

    const firstMatchItem = matchList.items[0];
    assert(firstMatchItem.matchId === match13._id.toString(), 'Latest match is ranked first');
    assert(firstMatchItem.otherUser.displayName === 'Dev (Match 2)', 'otherUser displayName populated');
    assert(firstMatchItem.otherUser.age === 28, 'otherUser age populated');
    assert(firstMatchItem.conversation.id === chat13._id.toString(), 'Conversation reference populated');
    assert(firstMatchItem.availableActions.includes('OPEN_CONVERSATION'), 'Available actions include OPEN_CONVERSATION');

    // Strict Privacy Checks
    assert(!firstMatchItem.otherUser.location && !firstMatchItem.otherUser.coordinates, 'Zero coordinates in Match otherUser DTO');
    assert(!firstMatchItem.otherUser.dateOfBirth, 'No dateOfBirth in Match otherUser DTO');
    assert(!firstMatchItem.otherUser.genderPreference, 'No private preferences in Match otherUser DTO');

    // -------------------------------------------------------------
    // 2. Cursor Pagination & Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Cursor Pagination Tests ---');

    const page1 = await matchService.getMatchesList(user1._id, { limit: 1 });
    assert(page1.items.length === 1, 'Page 1 returns 1 item');
    assert(page1.hasMore === true, 'Page 1 hasMore is true');
    assert(typeof page1.nextCursor === 'string' && page1.nextCursor.startsWith('cur_m_'), 'Page 1 returns signed nextCursor');

    const page2 = await matchService.getMatchesList(user1._id, { cursor: page1.nextCursor, limit: 1 });
    assert(page2.items.length === 1, 'Page 2 returns remaining 1 item');
    assert(page2.hasMore === false, 'Page 2 hasMore is false');
    assert(page2.items[0].matchId === match12._id.toString(), 'Page 2 returns second match without duplicates');

    // Tampered cursor rejected
    try {
      await matchService.getMatchesList(user1._id, { cursor: page1.nextCursor + 'bad' });
      assert(false, 'Tampered cursor should throw');
    } catch (err) {
      assert(err.code === 'INVALID_MATCH_CURSOR', 'Tampered match cursor throws INVALID_MATCH_CURSOR');
    }

    // -------------------------------------------------------------
    // 3. Match Details & Authorization Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Match Details & Authorization Tests ---');

    // 3.1 Authorized member retrieves match details
    const matchDetail = await matchService.getMatchDetails(user1._id, match12._id);
    assert(matchDetail.matchId === match12._id.toString(), 'Member retrieves match details successfully');
    assert(matchDetail.otherUser.displayName === 'Aarav (Match 1)', 'Match details returns other user profile');

    // 3.2 Non-member (Stranger) cannot retrieve match details
    try {
      await matchService.getMatchDetails(user4._id, match12._id);
      assert(false, 'Stranger should not access match details');
    } catch (err) {
      assert(err.code === 'MATCH_ACCESS_DENIED', 'Stranger accessing match details throws MATCH_ACCESS_DENIED (403)');
    }

    // -------------------------------------------------------------
    // 4. Chat & Message Authorization Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Chat & Message Authorization Tests ---');

    // 4.1 Member sends message in active match chat
    const sendMsgRes = await fetch(`${BASE_URL}/api/chats/message`, {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({ chatId: chat12._id.toString(), text: 'Hello Aarav!' }),
    });
    assert(sendMsgRes.status === 201, 'Member successfully sends message in active match chat (201)');

    // 4.2 Member retrieves message history
    const getMsgRes = await fetch(`${BASE_URL}/api/chats/${chat12._id}/messages`, {
      headers: authHeaders1,
    });
    const msgData = await getMsgRes.json();
    assert(getMsgRes.status === 200, 'Member retrieves messages in active match chat (200)');
    assert(Array.isArray(msgData) && msgData.length >= 1, 'Returns message history array');

    // 4.3 Stranger (User 4) cannot send message in User 1 & 2 chat
    const strangerSendRes = await fetch(`${BASE_URL}/api/chats/message`, {
      method: 'POST',
      headers: authHeaders4,
      body: JSON.stringify({ chatId: chat12._id.toString(), text: 'Intrusion!' }),
    });
    assert(strangerSendRes.status === 403 || strangerSendRes.status === 404, 'Stranger cannot send message in other users match chat (403/404)');

    // 4.4 Inactive/Blocked Match rejects messaging
    match13.status = 'UNMATCHED';
    await match13.save();

    const inactiveMsgRes = await fetch(`${BASE_URL}/api/chats/message`, {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({ chatId: chat13._id.toString(), text: 'Should be blocked' }),
    });
    assert(inactiveMsgRes.status === 403, 'Sending message in UNMATCHED conversation is strictly rejected (403)');

    // -------------------------------------------------------------
    // 5. REST API Endpoints Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. REST API Endpoints Tests ---');

    // 5.1 Unauthenticated GET /v1/matches returns 401
    const unauthMatchesRes = await fetch(`${BASE_URL}/v1/matches`);
    assert(unauthMatchesRes.status === 401, 'Unauthenticated GET /v1/matches returns 401');

    // 5.2 Authenticated GET /v1/matches returns 200 OK
    const authMatchesRes = await fetch(`${BASE_URL}/v1/matches`, { headers: authHeaders1 });
    const authMatchesData = await authMatchesRes.json();
    assert(authMatchesRes.status === 200, 'Authenticated GET /v1/matches returns 200 OK');
    assert(authMatchesData.success === true && authMatchesData.data.items.length >= 1, 'API returns active matches list');

    // 5.3 Authenticated GET /v1/matches/:id returns 200 OK
    const authMatchDetailRes = await fetch(`${BASE_URL}/v1/matches/${match12._id}`, { headers: authHeaders1 });
    const authMatchDetailData = await authMatchDetailRes.json();
    assert(authMatchDetailRes.status === 200, 'Authenticated GET /v1/matches/:id returns 200 OK');
    assert(authMatchDetailData.success === true && authMatchDetailData.data.matchId === match12._id.toString(), 'Match detail API returns match object');

    console.log('\n===========================================================');
    console.log(`MATCHES LIST & CHAT AUTH TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runMatchesListAuthTests();
}

module.exports = runMatchesListAuthTests;
