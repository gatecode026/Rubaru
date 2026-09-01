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
const OutboxEvent = require('../models/OutboxEvent');
const Block = require('../models/Block');
const Match = require('../models/Match');
const Chat = require('../models/Chat');

// Services & Routes
const incomingLikeService = require('../services/incomingLikeService');
const likeRoutes = require('../routes/likeRoutes');

async function runIncomingLikesTests() {
  console.log('===========================================================');
  console.log('       RUBARU INCOMING LIKES & DECLINE INTEGRATION TESTS   ');
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

  const TEST_PORT = 5092;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();
    const dob = new Date('1998-05-15');

    // 1. Create Recipient (Viewer)
    const recipientUser = await User.create({ email: `recip_inbox_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({
      user: recipientUser._id,
      displayName: 'Pooja (Recipient)',
      dateOfBirth: dob,
      age: 26,
      gender: 'Female',
      isDiscoverable: true,
      prompts: [{ questionId: 'pr_recip_1', question: 'A life goal of mine', answer: 'To build a sanctuary for animals' }],
    });
    await UserLocation.create({ user: recipientUser._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });

    const recipientToken = jwt.sign({ id: recipientUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeaders = {
      Authorization: `Bearer ${recipientToken}`,
      'Content-Type': 'application/json',
    };

    // 2. Create Senders
    // Sender 1: Standard Like
    const sender1User = await User.create({ email: `s1_inbox_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: sender1User._id, displayName: 'Karan (Standard)', dateOfBirth: dob, age: 27, gender: 'Male', isDiscoverable: true });
    await UserLocation.create({ user: sender1User._id, location: { type: 'Point', coordinates: [75.80, 26.92] } });

    // Sender 2: Rose
    const sender2User = await User.create({ email: `s2_inbox_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: sender2User._id, displayName: 'Vikram (Rose)', dateOfBirth: dob, age: 28, gender: 'Male', isDiscoverable: true });
    await UserLocation.create({ user: sender2User._id, location: { type: 'Point', coordinates: [75.81, 26.93] } });

    // Sender 3: Priority Like with Comment on prompt
    const sender3User = await User.create({ email: `s3_inbox_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: sender3User._id, displayName: 'Rohan (Priority)', dateOfBirth: dob, age: 25, gender: 'Male', isDiscoverable: true });
    await UserLocation.create({ user: sender3User._id, location: { type: 'Point', coordinates: [75.79, 26.92] } });

    // Sender 4: Blocked Sender
    const sender4User = await User.create({ email: `s4_inbox_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await DatingProfile.create({ user: sender4User._id, displayName: 'Blocked Sender', dateOfBirth: dob, age: 29, gender: 'Male', isDiscoverable: true });
    await Block.create({ blocker: recipientUser._id, blocked: sender4User._id, reason: 'SAFETY_HARASSMENT' });

    // 3. Create Pending Incoming Likes
    const like1 = await DatingInteraction.create({
      actor: sender1User._id,
      target: recipientUser._id,
      type: 'LIKE',
      status: 'PENDING',
      idempotencyKey: `inbox_like1_${timestamp}`,
      createdAt: new Date(Date.now() - 3000),
    });

    const like2 = await DatingInteraction.create({
      actor: sender2User._id,
      target: recipientUser._id,
      type: 'ROSE',
      status: 'PENDING',
      idempotencyKey: `inbox_like2_${timestamp}`,
      createdAt: new Date(Date.now() - 2000),
    });

    const like3 = await DatingInteraction.create({
      actor: sender3User._id,
      target: recipientUser._id,
      type: 'PRIORITY_LIKE',
      status: 'PENDING',
      targetElement: { elementType: 'PROMPT', elementId: 'pr_recip_1' },
      comment: 'I love that animal sanctuary goal!',
      idempotencyKey: `inbox_like3_${timestamp}`,
      createdAt: new Date(Date.now() - 1000),
    });

    // Blocked like
    await DatingInteraction.create({
      actor: sender4User._id,
      target: recipientUser._id,
      type: 'LIKE',
      status: 'PENDING',
      idempotencyKey: `inbox_like4_${timestamp}`,
    });

    // -------------------------------------------------------------
    // 1. Inbox Querying & Priority Sorting Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Inbox Querying & Priority Sorting Tests ---');

    const inbox = await incomingLikeService.getIncomingLikes(recipientUser._id, { limit: 10 });
    assert(Array.isArray(inbox.items), 'getIncomingLikes returns items array');
    assert(inbox.items.length === 3, `Returns exactly 3 unblocked pending likes (got ${inbox.items.length})`);

    // Verify Rose is top-ranked (Priority weight 3), followed by Priority Like (Weight 2), then Standard Like (Weight 1)
    assert(inbox.items[0].type === 'ROSE' && inbox.items[0].sender.displayName === 'Vikram (Rose)', 'Rose like is ranked first');
    assert(inbox.items[1].type === 'PRIORITY_LIKE' && inbox.items[1].sender.displayName === 'Rohan (Priority)', 'Priority like is ranked second');
    assert(inbox.items[2].type === 'LIKE' && inbox.items[2].sender.displayName === 'Karan (Standard)', 'Standard like is ranked third');

    // -------------------------------------------------------------
    // 2. Public DTO & Privacy Sanitization Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Public DTO & Privacy Sanitization Tests ---');

    const priorityItem = inbox.items[1];
    assert(priorityItem.sender.userId === sender3User._id.toString(), 'Sender userId populated');
    assert(priorityItem.sender.age === 25, 'Sender age populated');
    assert(priorityItem.sender.distanceLabel.includes('km') || priorityItem.sender.distanceLabel === 'Nearby', 'Approximate distance populated');
    assert(priorityItem.comment === 'I love that animal sanctuary goal!', 'Sanitized plain text comment returned');
    assert(priorityItem.likedElement.type === 'PROMPT' && priorityItem.likedElement.preview.question === 'A life goal of mine', 'Target element preview populated');
    assert(priorityItem.availableActions.includes('DECLINE'), 'Available actions include DECLINE');
    assert(!priorityItem.availableActions.includes('ACCEPT'), 'ACCEPT action strictly omitted in Prompt 10');

    // Strict Privacy Assertions
    assert(!priorityItem.sender.location && !priorityItem.sender.latitude && !priorityItem.sender.coordinates, 'Zero coordinates in sender DTO');
    assert(!priorityItem.sender.dateOfBirth, 'No dateOfBirth in sender DTO');
    assert(!priorityItem.sender.genderPreference, 'No private preferences in sender DTO');

    // -------------------------------------------------------------
    // 3. Cursor Pagination & Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Cursor Pagination & Security Tests ---');

    const page1 = await incomingLikeService.getIncomingLikes(recipientUser._id, { limit: 2 });
    assert(page1.items.length === 2, 'Page 1 returns 2 items');
    assert(page1.hasMore === true, 'Page 1 hasMore is true');
    assert(typeof page1.nextCursor === 'string' && page1.nextCursor.startsWith('cur_'), 'Page 1 returns signed nextCursor');

    const page2 = await incomingLikeService.getIncomingLikes(recipientUser._id, { cursor: page1.nextCursor, limit: 2 });
    assert(page2.items.length === 1, 'Page 2 returns remaining 1 item');
    assert(page2.hasMore === false, 'Page 2 hasMore is false');
    assert(page2.items[0].likeId === like1._id.toString(), 'Page 2 returns third like (Karan) without duplicates');

    // Tampered cursor rejected
    try {
      await incomingLikeService.getIncomingLikes(recipientUser._id, { cursor: page1.nextCursor + 'bad' });
      assert(false, 'Tampered cursor should throw');
    } catch (err) {
      assert(err.code === 'INVALID_LIKES_CURSOR', 'Tampered cursor throws INVALID_LIKES_CURSOR');
    }

    // Cross-user cursor rejected
    try {
      await incomingLikeService.getIncomingLikes(sender1User._id, { cursor: page1.nextCursor });
      assert(false, 'Cross-user cursor should throw');
    } catch (err) {
      assert(err.code === 'INVALID_LIKES_CURSOR', 'Cross-user cursor throws INVALID_LIKES_CURSOR (403)');
    }

    // -------------------------------------------------------------
    // 4. Decline Flow & Rediscovery Suppression Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Decline Flow Tests ---');

    // 4.1 Sender attempting to decline their own sent like throws 404/403
    try {
      await incomingLikeService.declineIncomingLike(sender1User._id, like1._id);
      assert(false, 'Sender cannot decline incoming like');
    } catch (err) {
      assert(err.code === 'LIKE_NOT_FOUND', 'Sender attempting to decline throws LIKE_NOT_FOUND');
    }

    // 4.2 Recipient declines Like 1 (Karan)
    const declineRes = await incomingLikeService.declineIncomingLike(recipientUser._id, like1._id, {
      idempotencyKey: `idem_dec_${timestamp}`,
    });
    assert(declineRes.declined === true, 'Decline action succeeds');

    // 4.3 Like document updated to DECLINED
    const updatedLike1 = await DatingInteraction.findById(like1._id);
    assert(updatedLike1.status === 'DECLINED' && updatedLike1.declinedAt !== null, 'Like status updated to DECLINED');

    // 4.4 Outbox event like.declined recorded
    const declineOutbox = await OutboxEvent.findOne({ eventType: 'like.declined', 'payload.likeId': like1._id.toString() });
    assert(declineOutbox !== null, 'like.declined outbox event is recorded');

    // 4.5 Declined like no longer returned in inbox
    const refreshedInbox = await incomingLikeService.getIncomingLikes(recipientUser._id, { limit: 10 });
    const remainingLikeIds = refreshedInbox.items.map((i) => i.likeId);
    assert(!remainingLikeIds.includes(like1._id.toString()), 'Declined like is removed from incoming inbox');

    // 4.6 Reusable helper for Prompt 11
    const pendingDoc = await incomingLikeService.getPendingIncomingLikeForDecision(recipientUser._id, like2._id);
    assert(pendingDoc && pendingDoc._id.toString() === like2._id.toString(), 'getPendingIncomingLikeForDecision successfully resolves pending like');

    // -------------------------------------------------------------
    // 5. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. HTTP REST API Endpoint Tests ---');

    // 5.1 Unauthenticated GET /v1/likes/incoming returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/likes/incoming`);
    assert(unauthRes.status === 401, 'Unauthenticated GET /v1/likes/incoming returns 401');

    // 5.2 Authenticated GET /v1/likes/incoming returns 200 OK
    const authInboxRes = await fetch(`${BASE_URL}/v1/likes/incoming?limit=5`, {
      headers: authHeaders,
    });
    const authInboxData = await authInboxRes.json();
    assert(authInboxRes.status === 200, 'Authenticated GET /v1/likes/incoming returns 200 OK');
    assert(authInboxData.success === true && authInboxData.data.items.length === 2, 'Inbox API returns remaining 2 likes');

    // 5.3 Authenticated POST /v1/likes/:id/decline returns 200 OK
    const authDeclineRes = await fetch(`${BASE_URL}/v1/likes/${like2._id}/decline`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ idempotencyKey: `idem_api_dec_${timestamp}` }),
    });
    const authDeclineData = await authDeclineRes.json();
    assert(authDeclineRes.status === 200, 'Authenticated POST /v1/likes/:id/decline returns 200 OK');
    assert(authDeclineData.success === true && authDeclineData.data.declined === true, 'Decline API returns declined: true');

    // 5.4 CRITICAL: Zero Matches and Zero Chats created in Prompt 10
    const matchCount = await Match.countDocuments({ users: recipientUser._id });
    assert(matchCount === 0, 'CRITICAL: Zero Match documents created in Prompt 10');

    const chatCount = await Chat.countDocuments({ participants: recipientUser._id });
    assert(chatCount === 0, 'CRITICAL: Zero Chat documents created in Prompt 10');

    console.log('\n===========================================================');
    console.log(`INCOMING LIKES & DECLINE TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runIncomingLikesTests();
}

module.exports = runIncomingLikesTests;
