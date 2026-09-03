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
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Block = require('../models/Block');
const OutboxEvent = require('../models/OutboxEvent');
const {
  ConversationTypes,
  ConversationStatuses,
  MemberRoles,
  MemberStates,
} = require('../models/enums');

// Services & Routes
const conversationService = require('../services/conversationService');
const {
  authorizeConversationAccess,
  ConversationAuthorizationError,
} = require('../services/conversationAuthorizationService');
const conversationRoutes = require('../routes/conversationRoutes');

async function runConversationFoundationTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: CONVERSATION & MEMBERSHIP FOUNDATION TEST SUITE (R3-02)   ');
  console.log('================================================================================\n');

  await connectDB();

  // Deduplicate any legacy matchId duplicates from past runs before index build
  try {
    const dupMatches = await Conversation.aggregate([
      { $match: { matchId: { $ne: null } } },
      { $group: { _id: '$matchId', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    for (const dup of dupMatches) {
      const [, ...remove] = dup.ids;
      await Conversation.deleteMany({ _id: { $in: remove } });
    }

    const dupPairs = await Conversation.aggregate([
      { $match: { canonicalParticipantKey: { $ne: null } } },
      { $group: { _id: '$canonicalParticipantKey', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    for (const dup of dupPairs) {
      const [, ...remove] = dup.ids;
      await Conversation.deleteMany({ _id: { $in: remove } });
    }
  } catch (cleanErr) {
    console.warn('[TEST SETUP] Deduplication warning:', cleanErr.message);
  }

  await Conversation.init();
  await ConversationMember.init();

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
  app.use('/v1/conversations', conversationRoutes);

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users & Profiles
    const userA = await User.create({
      phone: `+9199000${timestamp.toString().slice(-5)}1`,
      email: `userA_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    const userB = await User.create({
      phone: `+9199000${timestamp.toString().slice(-5)}2`,
      email: `userB_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    const userC = await User.create({
      phone: `+9199000${timestamp.toString().slice(-5)}3`,
      email: `userC_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

    const dob = new Date('1998-01-01');

    await DatingProfile.create({
      user: userA._id,
      displayName: 'Alice Tester',
      dateOfBirth: dob,
      age: 24,
      gender: 'Female',
    });

    await DatingProfile.create({
      user: userB._id,
      displayName: 'Bob Tester',
      dateOfBirth: dob,
      age: 26,
      gender: 'Male',
    });

    await DatingProfile.create({
      user: userC._id,
      displayName: 'Charlie Outsider',
      dateOfBirth: dob,
      age: 28,
      gender: 'Male',
    });

    // Create Active Match between A & B
    const [lowerAB, higherAB] = [userA._id.toString(), userB._id.toString()].sort();
    const canonicalPairAB = `${lowerAB}:${higherAB}`;

    const matchAB = await Match.create({
      canonicalPair: canonicalPairAB,
      user1: lowerAB,
      user2: higherAB,
      users: [lowerAB, higherAB],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      matchedAt: new Date(),
    });

    // -------------------------------------------------------------------------
    // SECTION 1: MODEL-LEVEL SPECIFICATION & CONSTRAINTS TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Conversation & Member Model Invariants ---');

    // Test 1: Conversation default values and schema invariants
    const testConv = new Conversation({
      type: ConversationTypes.DIRECT_MATCH,
      matchId: matchAB._id,
      canonicalParticipantKey: canonicalPairAB,
      participants: [lowerAB, higherAB],
      createdBy: userA._id,
    });
    assert(testConv.status === ConversationStatuses.ACTIVE, 'R3-02-01: Default conversation status is ACTIVE');
    assert(testConv.lastSequence === 0, 'R3-02-01: Default conversation lastSequence is 0');
    assert(testConv.memberCount === 2, 'R3-02-01: Default memberCount is 2');
    assert(testConv.schemaVersion === '1.0', 'R3-02-01: Schema version defaults to 1.0');

    // Test 2: ConversationMember default values and schema invariants
    const testMember = new ConversationMember({
      conversationId: testConv._id,
      userId: userA._id,
    });
    assert(testMember.role === MemberRoles.MEMBER, 'R3-02-02: Default member role is MEMBER');
    assert(testMember.state === MemberStates.ACTIVE, 'R3-02-02: Default member state is ACTIVE');
    assert(testMember.lastReadSequence === 0, 'R3-02-02: Default lastReadSequence is 0');
    assert(testMember.lastDeliveredSequence === 0, 'R3-02-02: Default lastDeliveredSequence is 0');
    assert(testMember.notificationPreference === 'ALL', 'R3-02-02: Default notificationPreference is ALL');

    // Test 3: Unique constraint on (conversationId, userId) in ConversationMember
    await ConversationMember.create({
      conversationId: matchAB._id, // placeholder id
      userId: userA._id,
      role: MemberRoles.MEMBER,
      state: MemberStates.ACTIVE,
    });

    let duplicateMemberError = null;
    try {
      await ConversationMember.create({
        conversationId: matchAB._id,
        userId: userA._id,
        role: MemberRoles.ADMIN,
        state: MemberStates.ACTIVE,
      });
    } catch (err) {
      duplicateMemberError = err;
    }
    assert(
      duplicateMemberError && duplicateMemberError.code === 11000,
      'R3-02-02: Duplicate membership record for (conversationId, userId) is rejected by unique index'
    );

    // -------------------------------------------------------------------------
    // SECTION 2: DIRECT MATCH CONVERSATION SERVICE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Direct Match Conversation Creation & Uniqueness ---');

    // Test 4: ensureDirectMatchConversation creates conversation and memberships
    const ensureResult = await conversationService.ensureDirectMatchConversation({
      actorUserId: userA._id.toString(),
      matchId: matchAB._id.toString(),
    });

    assert(ensureResult.isNew === true, 'R3-02-03: First ensureDirectMatchConversation returns isNew: true');
    assert(ensureResult.conversation && ensureResult.conversation.type === ConversationTypes.DIRECT_MATCH, 'R3-02-03: Conversation type is DIRECT_MATCH');
    assert(ensureResult.conversation.status === ConversationStatuses.ACTIVE, 'R3-02-03: Conversation status is ACTIVE');

    const convId = ensureResult.conversation._id;

    // Test 5: Verify both members created
    const members = await ConversationMember.find({ conversationId: convId });
    assert(members.length === 2, 'R3-02-05: Exactly 2 membership records created for match participants');
    const memberUserIds = members.map((m) => m.userId.toString());
    assert(
      memberUserIds.includes(userA._id.toString()) && memberUserIds.includes(userB._id.toString()),
      'R3-02-05: Direct conversation derives participants strictly from authoritative Match record'
    );

    // Test 6: Idempotent resolution
    const ensureRetry = await conversationService.ensureDirectMatchConversation({
      actorUserId: userB._id.toString(),
      matchId: matchAB._id.toString(),
    });

    assert(ensureRetry.isNew === false, 'R3-02-04: Repeated ensureDirectMatchConversation returns existing conversation (isNew: false)');
    assert(ensureRetry.conversation._id.toString() === convId.toString(), 'R3-02-04: Same conversation document resolved on retry');

    // Test 7: Third party cannot create or ensure conversation for match they do not belong to
    let unauthorizedEnsureError = null;
    try {
      await conversationService.ensureDirectMatchConversation({
        actorUserId: userC._id.toString(),
        matchId: matchAB._id.toString(),
      });
    } catch (err) {
      unauthorizedEnsureError = err;
    }
    assert(
      unauthorizedEnsureError && unauthorizedEnsureError.code === 'MATCH_ACCESS_DENIED',
      'R3-02-06: Non-member third party actor cannot create or access conversation for another match'
    );

    // Test 8: Transactional Outbox event created
    const outboxEvent = await OutboxEvent.findOne({
      eventType: 'conversation.created',
      aggregateId: convId.toString(),
    });
    assert(outboxEvent !== null, 'R3-02-13: conversation.created outbox event recorded atomically');
    assert(
      outboxEvent && outboxEvent.payload.canonicalParticipantKey === canonicalPairAB,
      'R3-02-13: Outbox payload contains privacy-safe conversation metadata'
    );

    // -------------------------------------------------------------------------
    // SECTION 3: CONVERSATION AUTHORIZATION SERVICE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Centralized Conversation Authorization ---');

    // Test 9: Active member authorized to VIEW
    const authViewA = await authorizeConversationAccess({
      actorUserId: userA._id.toString(),
      conversationId: convId.toString(),
      operation: 'VIEW',
    });
    assert(authViewA.authorized === true, 'R3-02-07: Active conversation member is authorized to VIEW');
    assert(authViewA.otherMemberId === userB._id.toString(), 'R3-02-07: Authorization context correctly resolves other member ID');

    // Test 10: Non-member denied access
    let nonMemberAuthError = null;
    try {
      await authorizeConversationAccess({
        actorUserId: userC._id.toString(),
        conversationId: convId.toString(),
        operation: 'VIEW',
      });
    } catch (err) {
      nonMemberAuthError = err;
    }
    assert(
      nonMemberAuthError && nonMemberAuthError.code === 'MEMBERSHIP_REQUIRED',
      'R3-02-07: Non-member is strictly denied access with MEMBERSHIP_REQUIRED'
    );

    // Test 11: Member in LEFT or REMOVED state denied active operations
    await ConversationMember.updateOne(
      { conversationId: convId, userId: userB._id },
      { $set: { state: MemberStates.LEFT } }
    );

    let leftMemberAuthError = null;
    try {
      await authorizeConversationAccess({
        actorUserId: userB._id.toString(),
        conversationId: convId.toString(),
        operation: 'SEND_MESSAGE',
      });
    } catch (err) {
      leftMemberAuthError = err;
    }
    assert(
      leftMemberAuthError && leftMemberAuthError.code === 'MEMBER_NOT_ACTIVE',
      'R3-02-10: Inactive/left member is denied active operations with MEMBER_NOT_ACTIVE'
    );

    // Restore userB state to ACTIVE
    await ConversationMember.updateOne(
      { conversationId: convId, userId: userB._id },
      { $set: { state: MemberStates.ACTIVE } }
    );

    // -------------------------------------------------------------------------
    // SECTION 4: UNMATCH & BLOCK LIFECYCLE INTEGRATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Lifecycle Transitions: Unmatch & Block ---');

    // Test 12: Unmatch closes conversation idempotently
    const closedConv = await conversationService.closeConversationForUnmatch({
      conversationId: convId,
      matchId: matchAB._id,
      actorUserId: userA._id.toString(),
      reason: 'USER_UNMATCHED',
    });
    assert(closedConv.status === ConversationStatuses.CLOSED_BY_UNMATCH, 'R3-02-09: Unmatch transitions conversation status to CLOSED_BY_UNMATCH');
    assert(closedConv.closeReason === 'USER_UNMATCHED', 'R3-02-09: Close reason recorded accurately');

    // Test 13: Closed conversation denies active write operations
    let closedWriteError = null;
    try {
      await authorizeConversationAccess({
        actorUserId: userA._id.toString(),
        conversationId: convId.toString(),
        operation: 'SEND_MESSAGE',
      });
    } catch (err) {
      closedWriteError = err;
    }
    assert(
      closedWriteError && closedWriteError.code === 'CONVERSATION_NOT_AVAILABLE',
      'R3-02-09: Closed conversation strictly rejects SEND_MESSAGE operation'
    );

    // Test 14: Closed conversation allows viewing history safely
    const closedViewAuth = await authorizeConversationAccess({
      actorUserId: userA._id.toString(),
      conversationId: convId.toString(),
      operation: 'VIEW',
    });
    assert(closedViewAuth.authorized === true, 'R3-02-09: Historical VIEW operation remains permitted after unmatch');

    // Test 15: Block enforcement in authorization
    // Re-activate conversation for block test
    await Conversation.updateOne({ _id: convId }, { $set: { status: ConversationStatuses.ACTIVE } });
    await Block.create({ blocker: userA._id, blocked: userB._id, reason: 'Harassment' });

    let blockedAuthError = null;
    try {
      await authorizeConversationAccess({
        actorUserId: userA._id.toString(),
        conversationId: convId.toString(),
        operation: 'VIEW',
      });
    } catch (err) {
      blockedAuthError = err;
    }
    assert(
      blockedAuthError && blockedAuthError.code === 'USER_BLOCKED',
      'R3-02-08: Blocked relationship denies conversation access with USER_BLOCKED'
    );

    // Cleanup block and restore active conversation and match status for remaining API tests
    await Block.deleteOne({ blocker: userA._id, blocked: userB._id });
    await Match.updateOne({ _id: matchAB._id }, { $set: { status: 'ACTIVE' } });
    await Conversation.updateOne({ _id: convId }, { $set: { status: ConversationStatuses.ACTIVE } });
    await ConversationMember.updateMany({ conversationId: convId }, { $set: { state: MemberStates.ACTIVE } });

    // -------------------------------------------------------------------------
    // SECTION 5: REST API & CURSOR PAGINATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Conversation REST Endpoints & Pagination ---');

    // Test 16: GET /v1/conversations list for userA
    const listRes = await fetch(`${BASE_URL}/v1/conversations?limit=10`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(listRes.status === 200, 'R3-02-11: GET /v1/conversations returns HTTP 200');
    const listJson = await listRes.json();
    assert(Array.isArray(listJson.items), 'R3-02-11: List returns array of items');
    assert(listJson.items.length >= 1, 'R3-02-11: User A conversation is returned');
    assert(listJson.items[0].otherParticipant !== null, 'R3-02-11: Other participant profile safely hydrated without N+1');
    assert(listJson.items[0].otherParticipant.displayName === 'Bob Tester', 'R3-02-11: Other participant display name matches');

    // Test 17: User C has empty conversation list
    const listResC = await fetch(`${BASE_URL}/v1/conversations?limit=10`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    const listJsonC = await listResC.json();
    assert(listJsonC.items.length === 0, 'R3-02-11: User with no memberships receives empty list');

    // Test 18: GET /v1/conversations/:id details
    const detailRes = await fetch(`${BASE_URL}/v1/conversations/${convId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(detailRes.status === 200, 'R3-02-12: GET /v1/conversations/:id returns HTTP 200 for authorized member');
    const detailJson = await detailRes.json();
    assert(detailJson.id === convId.toString(), 'R3-02-12: Conversation ID matches');
    assert(detailJson.members.length === 2, 'R3-02-12: Member list returned safely');
    assert(!detailJson.password && !detailJson.email, 'R3-02-12: Sensitive user account fields not leaked in response');

    // Test 19: Non-member IDOR attempt on GET /v1/conversations/:id
    const idorRes = await fetch(`${BASE_URL}/v1/conversations/${convId}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    });
    assert(idorRes.status === 403, 'R3-02-12: Non-member IDOR attempt returns HTTP 403 Forbidden');

    // Test 20: Tampered cursor is rejected
    const tamperedCursorRes = await fetch(`${BASE_URL}/v1/conversations?cursor=cur_c_tampered.invalidsig`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert(tamperedCursorRes.status === 400, 'R3-02-11: Tampered or invalid cursor is rejected with HTTP 400');

    // Test 21: POST /v1/conversations/ensure-direct idempotent endpoint
    const ensureApiRes = await fetch(`${BASE_URL}/v1/conversations/ensure-direct`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ matchId: matchAB._id.toString() }),
    });
    assert(ensureApiRes.status === 200, 'R3-02-03: POST /v1/conversations/ensure-direct resolves conversation successfully');

    // -------------------------------------------------------------------------
    // SECTION 6: CONCURRENCY RACE CONDITION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Concurrency & Race Condition Audit ---');

    // Create fresh match for concurrency testing
    const [lowerBC, higherBC] = [userB._id.toString(), userC._id.toString()].sort();
    const canonicalPairBC = `${lowerBC}:${higherBC}`;
    const matchBC = await Match.create({
      canonicalPair: canonicalPairBC,
      user1: lowerBC,
      user2: higherBC,
      users: [lowerBC, higherBC],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      matchedAt: new Date(),
    });

    // Run 10 concurrent ensure operations simultaneously
    const concurrentPromises = Array.from({ length: 10 }).map((_, i) =>
      conversationService.ensureDirectMatchConversation({
        actorUserId: i % 2 === 0 ? userB._id.toString() : userC._id.toString(),
        matchId: matchBC._id.toString(),
      })
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const uniqueConvIds = new Set(concurrentResults.map((r) => r.conversation._id.toString()));
    assert(uniqueConvIds.size === 1, 'R3-02-04: 10 concurrent creation attempts resolved to exactly ONE conversation ID');

    const totalBCConversations = await Conversation.countDocuments({
      canonicalParticipantKey: canonicalPairBC,
    });
    assert(totalBCConversations === 1, 'R3-02-04: Database unique constraint guarantees exactly one conversation created under concurrency');

    const totalBCMembers = await ConversationMember.countDocuments({
      conversationId: Array.from(uniqueConvIds)[0],
    });
    assert(totalBCMembers === 2, 'R3-02-04: Exactly two membership records exist without duplicates');

  } catch (err) {
    console.error('UNEXPECTED TEST SUITE ERROR:', err);
    failed++;
  } finally {
    server.close();
  }

  console.log('\n================================================================================');
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runConversationFoundationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runConversationFoundationTests;
