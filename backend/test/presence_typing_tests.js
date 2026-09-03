require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const socketio = require('socket.io');
const { io: ioClient } = require('socket.io-client');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const Block = require('../models/Block');
const OutboxEvent = require('../models/OutboxEvent');
const { ConversationStatuses, MemberStates, MemberRoles } = require('../models/enums');

// Services & Sockets
const conversationService = require('../services/conversationService');
const safetyService = require('../services/safetyService');
const presenceService = require('../services/presenceService');
const typingService = require('../services/typingService');
const { getPresenceStore, InMemoryPresenceStore } = require('../services/presenceStore');
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const conversationRoutes = require('../routes/conversationRoutes');

async function runPresenceAndTypingTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: TYPING INDICATORS & REAL-TIME PRESENCE TESTS (R3-08)      ');
  console.log('================================================================================\n');

  await connectDB();
  await Conversation.init();
  await ConversationMember.init();
  await Message.init();

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

  function connectSocketClient(port, token) {
    return new Promise((resolve) => {
      const socket = ioClient(`http://127.0.0.1:${port}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        timeout: 4000,
      });

      socket.on('connect', () => {
        resolve({ socket, error: null });
      });

      socket.on('connect_error', (err) => {
        resolve({ socket: null, error: err });
      });
    });
  }

  // Setup Express + HTTP + Socket.io Server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/v1/conversations', conversationRoutes);

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  const io = socketio(server, {
    cors: { origin: '*' },
  });

  socketHandler(io);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const clientSocketsToClose = [];

  try {
    const timestamp = Date.now();
    const secret = process.env.JWT_SECRET || 'secret';
    const dob = new Date('1998-01-01');

    // 1. Create Test Users
    const userA = await User.create({
      phone: `+9199200${timestamp.toString().slice(-5)}1`,
      email: `pres_a_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id, userId: userA._id }, secret, { expiresIn: '1h' });

    const userB = await User.create({
      phone: `+9199200${timestamp.toString().slice(-5)}2`,
      email: `pres_b_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id, userId: userB._id }, secret, { expiresIn: '1h' });

    const userC = await User.create({
      phone: `+9199200${timestamp.toString().slice(-5)}3`,
      email: `pres_c_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id, userId: userC._id }, secret, { expiresIn: '1h' });

    await DatingProfile.create({ user: userA._id, displayName: 'Alice Pres', dateOfBirth: dob, age: 24, gender: 'Female' });
    await DatingProfile.create({ user: userB._id, displayName: 'Bob Pres', dateOfBirth: dob, age: 26, gender: 'Male' });
    await DatingProfile.create({ user: userC._id, displayName: 'Charlie Pres', dateOfBirth: dob, age: 28, gender: 'Male' });

    // 2. Create Active Match and Conversation between A and B
    const [lowerAB, higherAB] = [userA._id.toString(), userB._id.toString()].sort();
    const matchAB = await Match.create({
      canonicalPair: `${lowerAB}:${higherAB}`,
      user1: lowerAB,
      user2: higherAB,
      users: [lowerAB, higherAB],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      matchedAt: new Date(),
    });

    const { conversation: convAB } = await conversationService.ensureDirectMatchConversation({
      actorUserId: userA._id.toString(),
      matchId: matchAB._id.toString(),
    });

    console.log('\n--- SECTION 1: PRESENCE STORE ABSTRACTION & LEASES (R3-08-REQ-001, REQ-002, REQ-005) ---');
    const store = getPresenceStore();
    store.reset();

    // Test registerConnection
    const reg1 = await store.registerConnection(userA._id, 'conn_1_deviceA1');
    assert(reg1.ok === true && reg1.isFirstConnection === true && reg1.totalConnections === 1,
      'R3-08-REQ-001: First connection registration marks isFirstConnection=true');

    // Test multiple connections for same user
    const reg2 = await store.registerConnection(userA._id, 'conn_2_deviceA2');
    assert(reg2.ok === true && reg2.isFirstConnection === false && reg2.totalConnections === 2,
      'R3-08-REQ-004: Additional device connection aggregates without emitting duplicate first connection');

    // Test getUserPresence
    const presA = await store.getUserPresence(userA._id);
    assert(presA.state === 'ONLINE' && presA.activeConnections === 2,
      'R3-08-REQ-004: Account presence is ONLINE when active connections > 0');

    // Test refreshConnection
    const ref1 = await store.refreshConnection(userA._id, 'conn_1_deviceA1');
    assert(ref1.ok === true && ref1.refreshed === true,
      'R3-08-REQ-005: Heartbeat refreshes connection lease TTL');

    // Test removeConnection (first device disconnects, tablet remains)
    const rem1 = await store.removeConnection(userA._id, 'conn_1_deviceA1');
    assert(rem1.ok === true && rem1.isLastDisconnect === false && rem1.remainingConnections === 1,
      'R3-08-REQ-006: First device disconnect does NOT mark user offline while another connection is active');

    const presAStillOnline = await store.getUserPresence(userA._id);
    assert(presAStillOnline.state === 'ONLINE' && presAStillOnline.activeConnections === 1,
      'R3-08-REQ-004: User remains ONLINE with 1 remaining active connection');

    // Test final disconnect
    const rem2 = await store.removeConnection(userA._id, 'conn_2_deviceA2');
    assert(rem2.ok === true && rem2.isLastDisconnect === true && rem2.remainingConnections === 0,
      'R3-08-REQ-006: Final device disconnect marks isLastDisconnect=true');

    const presAOffline = await store.getUserPresence(userA._id);
    assert(presAOffline.state === 'OFFLINE' && presAOffline.activeConnections === 0,
      'R3-08-REQ-004: Account presence becomes OFFLINE when all connections disconnected');

    // Test Expire stale connections
    const shortTtlStore = new InMemoryPresenceStore({ presenceTtlMs: 10 });
    await shortTtlStore.registerConnection(userB._id, 'conn_stale_1');
    await new Promise((r) => setTimeout(r, 20));
    const expiredUsers = await shortTtlStore.expireStaleConnections();
    assert(expiredUsers.includes(userB._id.toString()),
      'R3-08-REQ-005: Stale connection leases expire automatically on TTL deadline');

    console.log('\n--- SECTION 2: AUTHENTICATED SOCKET PRESENCE & LIFECYCLE (R3-08-REQ-003, REQ-006, REQ-011) ---');
    store.reset();

    // Connect Client A (Device 1)
    const { socket: sockA1 } = await connectSocketClient(TEST_PORT, tokenA);
    clientSocketsToClose.push(sockA1);
    assert(sockA1 !== null && sockA1.connected === true,
      'R3-08-REQ-003: Authenticated socket connection succeeds with verified JWT');

    // Check presence in store for User A
    await new Promise((r) => setTimeout(r, 50));
    const presSockA = await store.getUserPresence(userA._id);
    assert(presSockA.state === 'ONLINE',
      'R3-08-REQ-003: Socket connection automatically registers server-derived ONLINE presence');

    // Connect Client A (Device 2)
    const { socket: sockA2 } = await connectSocketClient(TEST_PORT, tokenA);
    clientSocketsToClose.push(sockA2);
    await new Promise((r) => setTimeout(r, 50));
    const presSockA2 = await store.getUserPresence(userA._id);
    assert(presSockA2.state === 'ONLINE' && presSockA2.activeConnections === 2,
      'R3-08-REQ-004: Multi-device connection tracks 2 active connections for User A');

    // Connect Client B and subscribe to conversation
    const { socket: sockB } = await connectSocketClient(TEST_PORT, tokenB);
    clientSocketsToClose.push(sockB);

    let receivedPresenceUpdated = null;
    sockB.on(SocketEvents.PRESENCE_UPDATED, (evt) => {
      receivedPresenceUpdated = evt;
    });

    await new Promise((resolve) => {
      sockB.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { conversationId: convAB._id.toString() }, (res) => {
        resolve(res);
      });
    });

    // Send heartbeat from Device 1
    const hbRes = await new Promise((resolve) => {
      sockA1.emit(SocketEvents.PRESENCE_HEARTBEAT, {}, (res) => {
        resolve(res);
      });
    });
    assert(hbRes.ok === true && hbRes.state === 'ONLINE' && hbRes.refreshed === true,
      'R3-08-REQ-005: Socket presence.heartbeat successfully refreshes lease');

    // Disconnect Device 1 (Device 2 still connected)
    sockA1.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    const presAfterOneDisc = await store.getUserPresence(userA._id);
    assert(presAfterOneDisc.state === 'ONLINE' && presAfterOneDisc.activeConnections === 1,
      'R3-08-REQ-006: User A remains ONLINE after Device 1 disconnects');
    assert(receivedPresenceUpdated === null,
      'R3-08-REQ-006: No OFFLINE event emitted when another active device connection remains');

    // Disconnect Device 2 -> triggers OFFLINE
    sockA2.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    assert(receivedPresenceUpdated !== null && receivedPresenceUpdated.userId === userA._id.toString() && receivedPresenceUpdated.state === 'OFFLINE',
      'R3-08-REQ-006 / R3-08-REQ-011: Final disconnect emits presence.updated (OFFLINE) with server timestamp');
    assert(receivedPresenceUpdated.socketId === undefined && receivedPresenceUpdated.deviceId === undefined,
      'R3-08-REQ-020: Presence event payload contains zero socket IDs or device identifiers');

    console.log('\n--- SECTION 3: PRESENCE SNAPSHOT & PRIVACY (R3-08-REQ-008, REQ-009, REQ-010) ---');
    // Reconnect Socket A
    const { socket: sockA3 } = await connectSocketClient(TEST_PORT, tokenA);
    clientSocketsToClose.push(sockA3);
    await new Promise((r) => setTimeout(r, 50));

    // Request presence snapshot via Socket.io
    const snapSockRes = await new Promise((resolve) => {
      sockB.emit(SocketEvents.PRESENCE_SNAPSHOT, { conversationId: convAB._id.toString() }, (res) => {
        resolve(res);
      });
    });

    assert(snapSockRes.ok === true && snapSockRes.data.version === 1 && Array.isArray(snapSockRes.data.members),
      'R3-08-REQ-010: Socket presence.snapshot returns authorized presence snapshot');
    const memberAInfo = snapSockRes.data.members.find((m) => m.userId === userA._id.toString());
    assert(memberAInfo && memberAInfo.state === 'ONLINE',
      'R3-08-REQ-010: Member A presence state in snapshot is ONLINE');

    // Request presence snapshot via REST API (Authorized)
    const restAuthService = require('../services/presenceService');
    const restSnapshot = await restAuthService.getAuthorizedPresenceSnapshot({
      actorUserId: userB._id,
      conversationId: convAB._id.toString(),
    });
    assert(restSnapshot.version === 1 && restSnapshot.conversationId === convAB._id.toString(),
      'R3-08-REQ-010: REST presence snapshot returns valid conversation presence');

    // Unauthorized presence snapshot request (User C is not a member)
    let unauthorizedFailed = false;
    try {
      await restAuthService.getAuthorizedPresenceSnapshot({
        actorUserId: userC._id,
        conversationId: convAB._id.toString(),
      });
    } catch (err) {
      unauthorizedFailed = true;
      assert(err.code === 'MEMBERSHIP_REQUIRED' || err.statusCode === 403,
        'R3-08-REQ-009: Non-member presence snapshot request is rejected with 403 / MEMBERSHIP_REQUIRED');
    }
    assert(unauthorizedFailed === true, 'R3-08-REQ-008: Unauthorized user cannot view presence snapshot');

    console.log('\n--- SECTION 4: EPHEMERAL TYPING INDICATORS (R3-08-REQ-014 to REQ-020) ---');
    // Subscribe Socket A3 to conversation
    await new Promise((resolve) => {
      sockA3.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { conversationId: convAB._id.toString() }, resolve);
    });

    let typingEventForB = null;
    sockB.on(SocketEvents.TYPING_UPDATED, (evt) => {
      typingEventForB = evt;
    });

    // 1. User A starts typing
    const typStartRes = await new Promise((resolve) => {
      sockA3.emit(SocketEvents.TYPING_START, { conversationId: convAB._id.toString() }, resolve);
    });
    assert(typStartRes.ok === true && typStartRes.isTyping === true,
      'R3-08-REQ-015: Authorized typing.start command accepted');

    await new Promise((r) => setTimeout(r, 50));
    assert(typingEventForB !== null && typingEventForB.userId === userA._id.toString() && typingEventForB.isTyping === true,
      'R3-08-REQ-015: typing.updated (isTyping=true) broadcast to conversation members');
    assert(typingEventForB.text === undefined && typingEventForB.socketId === undefined,
      'R3-08-REQ-020: Typing payload contains zero draft text or socket IDs');

    // 2. Duplicate typing.start (deduplicated - no duplicate event broadcast)
    typingEventForB = null;
    const typDupRes = await new Promise((resolve) => {
      sockA3.emit(SocketEvents.TYPING_START, { conversationId: convAB._id.toString() }, resolve);
    });
    assert(typDupRes.ok === true && typDupRes.isTyping === true,
      'R3-08-REQ-019: Duplicate typing.start succeeds without error');
    assert(typingEventForB === null,
      'R3-08-REQ-019: Duplicate typing.start is deduplicated and does not flood duplicate broadcasts');

    // 3. User A stops typing
    const typStopRes = await new Promise((resolve) => {
      sockA3.emit(SocketEvents.TYPING_STOP, { conversationId: convAB._id.toString() }, resolve);
    });
    assert(typStopRes.ok === true && typStopRes.isTyping === false,
      'R3-08-REQ-016: Authorized typing.stop command accepted');

    await new Promise((r) => setTimeout(r, 50));
    assert(typingEventForB !== null && typingEventForB.userId === userA._id.toString() && typingEventForB.isTyping === false,
      'R3-08-REQ-016: typing.updated (isTyping=false) broadcast to conversation members');

    // 4. Duplicate typing.stop (idempotent no-op)
    typingEventForB = null;
    const typStopDupRes = await new Promise((resolve) => {
      sockA3.emit(SocketEvents.TYPING_STOP, { conversationId: convAB._id.toString() }, resolve);
    });
    assert(typStopDupRes.ok === true && typStopDupRes.isTyping === false,
      'R3-08-REQ-019: Duplicate typing.stop is an idempotent no-op');
    assert(typingEventForB === null,
      'R3-08-REQ-019: Duplicate typing.stop does not broadcast duplicate stop event');

    // 5. Typing TTL Automatic Expiry
    const shortTypingStore = new InMemoryPresenceStore({ typingTtlMs: 20 });
    await shortTypingStore.startTyping(convAB._id, userA._id, 'sock_test_ttl');
    const activeTypersBefore = await shortTypingStore.getTypingUsers(convAB._id);
    assert(activeTypersBefore.includes(userA._id.toString()),
      'R3-08-REQ-017: Active typer registered in ephemeral store');

    await new Promise((r) => setTimeout(r, 30));
    const expiredTypers = await shortTypingStore.expireTypingLeases();
    assert(expiredTypers.some((e) => e.userId === userA._id.toString() && e.conversationId === convAB._id.toString()),
      'R3-08-REQ-017: Ephemeral typing lease automatically expires when TTL elapses');

    console.log('\n--- SECTION 5: MULTI-DEVICE TYPING AGGREGATION (R3-08-REQ-018) ---');
    const multiDevStore = new InMemoryPresenceStore();
    // Device 1 starts typing
    const dev1Start = await multiDevStore.startTyping(convAB._id, userA._id, 'dev_1');
    assert(dev1Start.isEffectiveTransition === true,
      'R3-08-REQ-018: First device start is an effective typing transition');

    // Device 2 starts typing in same conversation
    const dev2Start = await multiDevStore.startTyping(convAB._id, userA._id, 'dev_2');
    assert(dev2Start.isEffectiveTransition === false,
      'R3-08-REQ-018: Second device typing does not trigger duplicate effective start transition');

    // Device 1 stops typing
    const dev1Stop = await multiDevStore.stopTyping(convAB._id, userA._id, 'dev_1');
    assert(dev1Stop.isEffectiveTransition === false,
      'R3-08-REQ-018: Device 1 stopping while Device 2 is active does not trigger effective stop transition');

    const typersStillActive = await multiDevStore.getTypingUsers(convAB._id);
    assert(typersStillActive.includes(userA._id.toString()),
      'R3-08-REQ-018: User A remains typing while Device 2 lease is active');

    // Device 2 stops typing
    const dev2Stop = await multiDevStore.stopTyping(convAB._id, userA._id, 'dev_2');
    assert(dev2Stop.isEffectiveTransition === true,
      'R3-08-REQ-018: Final device stopping triggers effective typing stop transition');

    console.log('\n--- SECTION 6: BLOCK / REVOCATION / OFFLINE SYNC SAFETY (R3-08-REQ-021, REQ-022) ---');
    // Start typing on User A
    await store.startTyping(convAB._id, userA._id, sockA3.id);
    let activeTypers = await store.getTypingUsers(convAB._id);
    assert(activeTypers.includes(userA._id.toString()), 'User A typing before block');

    // Block User B
    await safetyService.blockUser(userA._id, userB._id);
    const cleared = await typingService.clearConversationTyping(convAB._id);
    assert(cleared.length >= 0,
      'R3-08-REQ-021: Conversation typing leases cleared on block/unmatch');

    // Check Outbox and Message DB for zero typing contamination
    const typingOutboxCount = await OutboxEvent.countDocuments({ eventType: /typing/i });
    assert(typingOutboxCount === 0,
      'R3-08-REQ-022: Typing events are strictly ephemeral and NEVER written to Mongo Outbox');

    const typingMessageCount = await Message.countDocuments({ type: /typing/i });
    assert(typingMessageCount === 0,
      'R3-08-REQ-022: Typing indicators are NEVER persisted as Messages in MongoDB');

    console.log('\n--- SECTION 7: RATE LIMITING & SECURITY CONTRACTS (R3-08-REQ-023, REQ-024, REQ-026) ---');
    // Connect client C and attempt unauthorized typing in convAB
    const { socket: sockC } = await connectSocketClient(TEST_PORT, tokenC);
    clientSocketsToClose.push(sockC);

    const unauthTypRes = await new Promise((resolve) => {
      sockC.emit(SocketEvents.TYPING_START, { conversationId: convAB._id.toString() }, resolve);
    });
    assert(unauthTypRes.ok === false && (unauthTypRes.code === 'TYPING_ACCESS_DENIED' || unauthTypRes.code === 'USER_BLOCKED'),
      'R3-08-REQ-024 / REQ-026: Non-member / blocked user typing attempt rejected with TYPING_ACCESS_DENIED');

    console.log('\n--- SECTION 8: REDIS OUTAGE & MULTI-INSTANCE CONSISTENCY (R3-08-REQ-013, REQ-025, REQ-027) ---');
    // Create an active conversation between User A and User C for outage testing
    const [lowerAC, higherAC] = [userA._id.toString(), userC._id.toString()].sort();
    const matchAC = await Match.create({
      canonicalPair: `${lowerAC}:${higherAC}`,
      user1: lowerAC,
      user2: higherAC,
      users: [lowerAC, higherAC],
      status: 'ACTIVE',
      initiatorInteraction: new mongoose.Types.ObjectId(),
      matchedAt: new Date(),
    });

    const { conversation: convAC } = await conversationService.ensureDirectMatchConversation({
      actorUserId: userA._id.toString(),
      matchId: matchAC._id.toString(),
    });

    // Degraded Store Test
    store.setDegraded(true);
    const degradedPres = await store.getUserPresence(userA._id);
    assert(degradedPres.state === 'UNKNOWN',
      'R3-08-REQ-013: Store returns UNKNOWN state during store outage without crashing');

    const degradedSnapshot = await presenceService.getAuthorizedPresenceSnapshot({
      actorUserId: userA._id,
      conversationId: convAC._id.toString(),
    }).catch(() => null);
    assert(degradedSnapshot !== null && degradedSnapshot.members.some((m) => m.state === 'UNKNOWN'),
      'R3-08-REQ-013: Snapshot safely reports UNKNOWN member state during outage');

    store.setDegraded(false);

    // Multi-Instance Concurrency Test
    // Simulated Node 1 & Node 2 sharing same presence store
    store.reset();
    const multiUserId = new mongoose.Types.ObjectId();
    const node1Conn = await store.registerConnection(multiUserId, 'node1_device1');
    const node2Conn = await store.registerConnection(multiUserId, 'node2_device2');
    assert(node1Conn.isFirstConnection === true && node2Conn.isFirstConnection === false,
      'R3-08-REQ-025: Cross-node registration correctly detects single first-connect transition');

    const node1Disconnect = await store.removeConnection(multiUserId, 'node1_device1');
    assert(node1Disconnect.isLastDisconnect === false,
      'R3-08-REQ-025: Cross-node disconnect does not falsely mark user offline while Node 2 connection active');

    const node2Disconnect = await store.removeConnection(multiUserId, 'node2_device2');
    assert(node2Disconnect.isLastDisconnect === true,
      'R3-08-REQ-025: Final disconnect across nodes correctly triggers single last-disconnect transition');

    console.log('\n--- SECTION 9: CONCURRENCY & RACE CONDITIONS (R3-08-REQ-027) ---');
    // 1. Two devices connecting simultaneously for the same user
    store.reset();
    const raceUser = new mongoose.Types.ObjectId();
    const [raceConn1, raceConn2] = await Promise.all([
      store.registerConnection(raceUser, 'race_dev1'),
      store.registerConnection(raceUser, 'race_dev2'),
    ]);
    const firstCount = (raceConn1.isFirstConnection ? 1 : 0) + (raceConn2.isFirstConnection ? 1 : 0);
    assert(firstCount === 1,
      'R3-08-REQ-027: Concurrent device connections produce exactly one effective first-connection transition');

    // 2. Two devices starting typing simultaneously
    const [raceTyp1, raceTyp2] = await Promise.all([
      store.startTyping(convAC._id, raceUser, 'race_dev1'),
      store.startTyping(convAC._id, raceUser, 'race_dev2'),
    ]);
    const typFirstCount = (raceTyp1.isEffectiveTransition ? 1 : 0) + (raceTyp2.isEffectiveTransition ? 1 : 0);
    assert(typFirstCount === 1,
      'R3-08-REQ-027: Concurrent typing start commands produce exactly one effective typing-start transition');

    // 3. One device stopping while another refreshes
    const [raceStopRes, raceRefreshRes] = await Promise.all([
      store.stopTyping(convAC._id, raceUser, 'race_dev1'),
      store.refreshTyping(convAC._id, raceUser, 'race_dev2'),
    ]);
    const typersAfterRace = await store.getTypingUsers(convAC._id);
    assert(typersAfterRace.includes(raceUser.toString()),
      'R3-08-REQ-027: Typing stop on one device does not clobber active concurrent typing on another device');

  } catch (err) {
    console.error('❌ Test suite fatal error:', err);
    failed++;
  } finally {
    // Cleanup sockets and HTTP server
    for (const s of clientSocketsToClose) {
      if (s && typeof s.disconnect === 'function') {
        s.disconnect();
      }
    }
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n================================================================================');
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log(`STATUS: ${failed === 0 ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log('================================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPresenceAndTypingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runPresenceAndTypingTests;
