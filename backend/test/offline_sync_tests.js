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

// Services
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const receiptService = require('../services/receiptService');
const syncService = require('../services/syncService');
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');

async function runOfflineSyncTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: OFFLINE SYNCHRONIZATION & CATCH-UP (R3-07 TEST SUITE)     ');
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

      socket.on('connect', () => resolve({ socket, error: null }));
      socket.on('connect_error', (err) => resolve({ socket: null, error: err }));
    });
  }

  // Setup Server & Socket.io
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/v1/conversations', require('../routes/conversationRoutes'));
  app.use('/v1/messaging', require('../routes/syncRoutes'));

  const TEST_PORT = 5100;
  const server = http.createServer(app);
  const io = socketio(server, { cors: { origin: '*' } });
  socketHandler(io);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const clientSocketsToClose = [];

  try {
    const timestamp = Date.now();
    const secret = process.env.JWT_SECRET || 'secret';
    const dob = new Date('1998-01-01');

    // 1. Create Test Users
    const userA = await User.create({
      phone: `+9199500${timestamp.toString().slice(-5)}1`,
      email: `sync_a_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id }, secret, { expiresIn: '1h' });

    const userB = await User.create({
      phone: `+9199500${timestamp.toString().slice(-5)}2`,
      email: `sync_b_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id }, secret, { expiresIn: '1h' });

    const userC = await User.create({
      phone: `+9199500${timestamp.toString().slice(-5)}3`,
      email: `sync_c_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id }, secret, { expiresIn: '1h' });

    await DatingProfile.create({ user: userA._id, displayName: 'Alice Sync', dateOfBirth: dob, age: 24, gender: 'Female' });
    await DatingProfile.create({ user: userB._id, displayName: 'Bob Sync', dateOfBirth: dob, age: 26, gender: 'Male' });
    await DatingProfile.create({ user: userC._id, displayName: 'Charlie Sync', dateOfBirth: dob, age: 28, gender: 'Male' });

    // 2. Create Match and Conversation between User A and User B
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
    const convId = convAB._id.toString();

    // 3. User A sends 6 messages: sequences 1 to 6
    for (let i = 1; i <= 6; i++) {
      await messageService.sendMessage({
        actorUserId: userA._id.toString(),
        conversationId: convId,
        clientMessageId: `cmsg_sync_${i}_${timestamp}`,
        text: `Sync Message ${i}`,
      });
    }

    // -------------------------------------------------------------------------
    // R3-07-REQ-002: CONVERSATION SYNCHRONIZATION MANIFEST
    // -------------------------------------------------------------------------
    console.log('\n--- Section 1: Conversation Synchronization Manifest ---');

    const manifestRes = await syncService.getConversationSyncManifest({
      actorUserId: userB._id.toString(),
      limit: 10,
    });

    assert(manifestRes && manifestRes.items.length >= 1, 'R3-07-REQ-002: Sync manifest returns user conversations');
    const convEntry = manifestRes.items.find((i) => i.conversationId === convId);
    assert(
      convEntry && convEntry.latestSequence === 6 && convEntry.catchUpRequired === true && convEntry.accessState === 'ACTIVE',
      'R3-07-REQ-002: Manifest correctly indicates catchUpRequired: true (latestSequence: 6 > readThroughSequence: 0)'
    );

    // REST Manifest Test
    const restManifestRes = await fetch(`http://127.0.0.1:${TEST_PORT}/v1/messaging/sync`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const restManifestData = await restManifestRes.json();
    assert(restManifestRes.status === 200 && restManifestData.success === true, 'R3-07-REQ-012: REST GET /v1/messaging/sync returns 200');

    // -------------------------------------------------------------------------
    // R3-07-REQ-003, REQ-004 & REQ-005: FORWARD CATCH-UP & STABLE HIGH-WATER
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Forward Catch-Up & Stable High-Water Boundary ---');

    // Page 1: Request limit = 3 afterSequence = 0
    const page1 = await syncService.syncConversationMessages({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      afterSequence: 0,
      limit: 3,
    });

    assert(page1.messages.length === 3, 'R3-07-REQ-003: Page 1 returns 3 messages');
    assert(page1.firstReturnedSequence === 1 && page1.lastReturnedSequence === 3, 'R3-07-REQ-003: Page 1 covers sequence 1 through 3');
    assert(page1.throughSequence === 6, 'R3-07-REQ-004: Stable throughSequence captured as 6');
    assert(page1.hasMore === true && page1.nextCursor !== null, 'R3-07-REQ-005: Page 1 hasMore is true with nextCursor');

    // Simulate new message arriving while client is paginating (sequence 7)
    await messageService.sendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      clientMessageId: `cmsg_sync_7_${timestamp}`,
      text: 'Sync Message 7 (Arrived mid-pagination)',
    });

    // Page 2: Fetch using page1.nextCursor
    const page2 = await syncService.syncConversationMessages({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      cursor: page1.nextCursor,
      limit: 3,
    });

    assert(page2.messages.length === 3, 'R3-07-REQ-003: Page 2 returns remaining 3 messages');
    assert(page2.firstReturnedSequence === 4 && page2.lastReturnedSequence === 6, 'R3-07-REQ-003: Page 2 covers sequence 4 through 6');
    assert(page2.throughSequence === 6, 'R3-07-REQ-004: Page 2 preserves stable throughSequence (6), excluding mid-flight sequence 7');
    assert(page2.hasMore === false && page2.nextCursor === null, 'R3-07-REQ-005: Catch-up session completes with hasMore: false');

    // -------------------------------------------------------------------------
    // R3-07-REQ-006 & REQ-021: CURSOR SECURITY & TAMPERING PROTECTION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3: Cursor Security & Scope Validation ---');

    // 1. Tampered Signature
    let tamperedErr = null;
    try {
      syncService.verifySyncCursor(`${page1.nextCursor}corrupted`, userB._id, convId);
    } catch (err) {
      tamperedErr = err;
    }
    assert(tamperedErr && tamperedErr.code === 'SYNC_CURSOR_TAMPERED', 'R3-07-REQ-021: Tampered cursor signature rejected with SYNC_CURSOR_TAMPERED');

    // 2. Cross-User Cursor Replay
    let crossUserErr = null;
    try {
      syncService.verifySyncCursor(page1.nextCursor, userC._id, convId);
    } catch (err) {
      crossUserErr = err;
    }
    assert(crossUserErr && crossUserErr.code === 'SYNC_CURSOR_SCOPE_MISMATCH', 'R3-07-REQ-021: Cross-user cursor rejected with SYNC_CURSOR_SCOPE_MISMATCH');

    // 3. Expired Cursor
    const expiredCursor = syncService.createSyncCursor({
      version: 1,
      userId: userB._id.toString(),
      conversationId: convId,
      afterSequence: 0,
      throughSequence: 6,
      lastReturnedSequence: 3,
      limit: 3,
      exp: Date.now() - 1000, // Expired 1 second ago
    });
    let expiredErr = null;
    try {
      syncService.verifySyncCursor(expiredCursor, userB._id, convId);
    } catch (err) {
      expiredErr = err;
    }
    assert(expiredErr && expiredErr.code === 'SYNC_CURSOR_EXPIRED', 'R3-07-REQ-021: Expired cursor rejected with SYNC_CURSOR_EXPIRED');

    // -------------------------------------------------------------------------
    // R3-07-REQ-007: SEQUENCE GAP DETECTION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 4: Sequence Gap Detection ---');

    // When client requests afterSequence 0, but lowest available sequence is 1, gapDetected is false
    assert(page1.gapDetected === false, 'R3-07-REQ-007: Normal sequential catch-up reports gapDetected: false');

    // -------------------------------------------------------------------------
    // R3-07-REQ-017 & REQ-018: TOMBSTONES & ATTACHMENTS SYNCHRONIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 5: Tombstones & Attachments Synchronization ---');

    // User A unsends message 2
    const msg2Doc = await Message.findOne({ conversationId: convId, sequence: 2 });
    await messageService.unsendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      messageId: msg2Doc._id.toString(),
    });

    const syncWithTombstone = await syncService.syncConversationMessages({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      afterSequence: 0,
      limit: 5,
    });

    const tombstoneMsg = syncWithTombstone.messages.find((m) => m.sequence === 2);
    assert(
      tombstoneMsg && tombstoneMsg.status === 'DELETED' && tombstoneMsg.text === 'This message was unsent.',
      'R3-07-REQ-017: Unsent message synchronizes as DELETED tombstone without sequence gap'
    );

    // -------------------------------------------------------------------------
    // R3-07-REQ-008, REQ-013 & REQ-014: SOCKET.IO RECONNECT HANDSHAKE & LIVE HANDOFF
    // -------------------------------------------------------------------------
    console.log('\n--- Section 6: Socket.io Reconnect Handshake & Live Handoff ---');

    const clientSocketB = await connectSocketClient(TEST_PORT, tokenB);
    if (clientSocketB.socket) clientSocketsToClose.push(clientSocketB.socket);

    const clientSocketA = await connectSocketClient(TEST_PORT, tokenA);
    if (clientSocketA.socket) clientSocketsToClose.push(clientSocketA.socket);

    // User B sends socket conversation.sync for afterSequence = 4
    const socketSyncPromise = new Promise((resolve) => {
      clientSocketB.socket.emit(
        SocketEvents.CONVERSATION_SYNC,
        { conversationId: convId, afterSequence: 4, limit: 10 },
        (ack) => resolve(ack)
      );
    });

    const socketSyncAck = await socketSyncPromise;
    assert(
      socketSyncAck &&
        socketSyncAck.ok === true &&
        socketSyncAck.status === 'SYNC_REQUIRED' &&
        socketSyncAck.data.messages.length === 3, // messages 5, 6, 7
      'R3-07-REQ-008/013: Socket.io conversation.sync executes handshake and returns missing delta'
    );

    // -------------------------------------------------------------------------
    // R3-07-REQ-015: MULTI-DEVICE INDEPENDENT CATCH-UP
    // -------------------------------------------------------------------------
    console.log('\n--- Section 7: Multi-Device Independent Catch-Up ---');

    // Device 1 (afterSequence = 6) vs Device 2 (afterSequence = 2)
    const [dev1Sync, dev2Sync] = await Promise.all([
      syncService.syncConversationMessages({ actorUserId: userB._id.toString(), conversationId: convId, afterSequence: 6, limit: 10 }),
      syncService.syncConversationMessages({ actorUserId: userB._id.toString(), conversationId: convId, afterSequence: 2, limit: 10 }),
    ]);

    assert(dev1Sync.messages.length === 1 && dev1Sync.messages[0].sequence === 7, 'R3-07-REQ-015: Device 1 catches up from sequence 6 (gets message 7)');
    assert(dev2Sync.messages.length === 5 && dev2Sync.messages[0].sequence === 3, 'R3-07-REQ-015: Device 2 independently catches up from sequence 2 (gets messages 3-7)');

    // -------------------------------------------------------------------------
    // R3-07-REQ-019 & REQ-020: ACCESS REVOCATION SYNCHRONIZATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 8: Access Revocation Synchronization ---');

    // User A blocks User B
    await Block.create({ blocker: userA._id, blocked: userB._id, reason: 'Revocation test' });

    let revokedSyncErr = null;
    try {
      await syncService.syncConversationMessages({
        actorUserId: userB._id.toString(),
        conversationId: convId,
        afterSequence: 0,
        limit: 10,
      });
    } catch (err) {
      revokedSyncErr = err;
    }
    assert(
      revokedSyncErr && (revokedSyncErr.code === 'USER_BLOCKED' || revokedSyncErr.statusCode === 403),
      'R3-07-REQ-020: Blocked user catch-up request is rejected with 403 authorization error'
    );

    await Block.deleteMany({ $or: [{ blocker: userA._id }, { blocked: userA._id }] });

    // -------------------------------------------------------------------------
    // R3-07-REQ-025: READ-ONLY IDEMPOTENCY
    // -------------------------------------------------------------------------
    console.log('\n--- Section 9: Read-Only Idempotency ---');

    const memberBBefore = await ConversationMember.findOne({ conversationId: convId, userId: userB._id });
    await syncService.syncConversationMessages({ actorUserId: userB._id.toString(), conversationId: convId, afterSequence: 0, limit: 10 });
    const memberBAfter = await ConversationMember.findOne({ conversationId: convId, userId: userB._id });

    assert(
      memberBBefore.deliveredThroughSequence === memberBAfter.deliveredThroughSequence &&
        memberBBefore.readThroughSequence === memberBAfter.readThroughSequence,
      'R3-07-REQ-025: Sync and catch-up operations produce zero side-effect mutations on receipt watermarks'
    );

  } catch (err) {
    console.error('UNEXPECTED TEST ERROR:', err);
    failed++;
  } finally {
    for (const s of clientSocketsToClose) {
      if (s.connected) s.disconnect();
    }
    io.close();
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
  runOfflineSyncTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runOfflineSyncTests;
