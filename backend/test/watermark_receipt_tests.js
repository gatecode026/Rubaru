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

// Services & Handlers
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const receiptService = require('../services/receiptService');
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const { dispatchOutboxReceiptUpdated } = require('../services/socketDispatchService');

async function runWatermarkReceiptTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: DELIVERY & READ WATERMARKS (R3-06 TEST SUITE)             ');
  console.log('================================================================================\n');

  await connectDB();
  await Conversation.init();
  await ConversationMember.init();
  await Message.init();
  await OutboxEvent.init();

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

  const TEST_PORT = 5099;
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
      phone: `+9199400${timestamp.toString().slice(-5)}1`,
      email: `rcpt_a_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id }, secret, { expiresIn: '1h' });

    const userB = await User.create({
      phone: `+9199400${timestamp.toString().slice(-5)}2`,
      email: `rcpt_b_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id }, secret, { expiresIn: '1h' });

    const userC = await User.create({
      phone: `+9199400${timestamp.toString().slice(-5)}3`,
      email: `rcpt_c_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id }, secret, { expiresIn: '1h' });

    await DatingProfile.create({ user: userA._id, displayName: 'Alice Receipts', dateOfBirth: dob, age: 24, gender: 'Female' });
    await DatingProfile.create({ user: userB._id, displayName: 'Bob Receipts', dateOfBirth: dob, age: 26, gender: 'Male' });
    await DatingProfile.create({ user: userC._id, displayName: 'Charlie Receipts', dateOfBirth: dob, age: 28, gender: 'Male' });

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

    // 3. User A sends 3 messages: sequences 1, 2, 3
    const msg1 = await messageService.sendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      clientMessageId: `cmsg_1_${timestamp}`,
      text: 'Message 1',
    });
    const msg2 = await messageService.sendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      clientMessageId: `cmsg_2_${timestamp}`,
      text: 'Message 2',
    });
    const msg3 = await messageService.sendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      clientMessageId: `cmsg_3_${timestamp}`,
      text: 'Message 3',
    });

    assert(msg1.message.sequence === 1 && msg2.message.sequence === 2 && msg3.message.sequence === 3, 'R3-06 Setup: 3 messages sent with sequences 1, 2, 3');

    // -------------------------------------------------------------------------
    // R3-06-REQ-001 & REQ-005: DELIVERY WATERMARK ADVANCEMENT & VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 1: Delivery Watermark Advancement & Validation ---');

    // 1. Initial watermarks must be 0
    const initMemberB = await ConversationMember.findOne({ conversationId: convId, userId: userB._id });
    assert(initMemberB.deliveredThroughSequence === 0 && initMemberB.readThroughSequence === 0, 'R3-06-REQ-001/024: Initial member watermarks are 0');

    // 2. Reject sequence ahead of committed conversation sequence (e.g. sequence 10 > lastSequence 3)
    let seqAheadErr = null;
    try {
      await receiptService.advanceDeliveryWatermark({
        actorUserId: userB._id.toString(),
        conversationId: convId,
        throughSequence: 10,
      });
    } catch (err) {
      seqAheadErr = err;
    }
    assert(seqAheadErr && seqAheadErr.code === 'RECEIPT_SEQUENCE_AHEAD', 'R3-06-REQ-005: Sequence ahead of conversation lastSequence is rejected');

    // 3. Reject invalid inputs (negative, float, string)
    let invalidInputErr = null;
    try {
      await receiptService.advanceDeliveryWatermark({
        actorUserId: userB._id.toString(),
        conversationId: convId,
        throughSequence: -1,
      });
    } catch (err) {
      invalidInputErr = err;
    }
    assert(invalidInputErr && invalidInputErr.code === 'INVALID_RECEIPT_SEQUENCE', 'R3-06-REQ-005: Negative sequence is rejected with INVALID_RECEIPT_SEQUENCE');

    // 4. Valid advancement to sequence 2
    const delRes1 = await receiptService.advanceDeliveryWatermark({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      throughSequence: 2,
    });
    assert(delRes1 && delRes1.changed === true && delRes1.deliveredThroughSequence === 2, 'R3-06-REQ-001: Delivery watermark advances to sequence 2');

    // -------------------------------------------------------------------------
    // R3-06-REQ-003 & REQ-018: MONOTONICITY & IDEMPOTENT NO-OP UPDATES
    // -------------------------------------------------------------------------
    console.log('\n--- Section 2: Monotonic Updates & Idempotent No-Ops ---');

    // 1. Duplicate update to sequence 2 -> No-op
    const delRes2 = await receiptService.advanceDeliveryWatermark({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      throughSequence: 2,
    });
    assert(delRes2 && delRes2.changed === false && delRes2.deliveredThroughSequence === 2, 'R3-06-REQ-003: Duplicate delivery sequence is idempotent no-op (changed: false)');

    // 2. Lower update to sequence 1 -> No-op
    const delRes3 = await receiptService.advanceDeliveryWatermark({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      throughSequence: 1,
    });
    assert(delRes3 && delRes3.changed === false && delRes3.deliveredThroughSequence === 2, 'R3-06-REQ-003: Lower delivery sequence never regresses watermark (remains 2)');

    // -------------------------------------------------------------------------
    // R3-06-REQ-002 & REQ-004: READ WATERMARK & READ-IMPLIES-DELIVERED
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3: Read Watermarks & Read-Implies-Delivered ---');

    // Advance read watermark to sequence 3 (which exceeds current delivered sequence 2)
    const readRes1 = await receiptService.advanceReadWatermark({
      actorUserId: userB._id.toString(),
      conversationId: convId,
      throughSequence: 3,
    });
    assert(
      readRes1 &&
        readRes1.changed === true &&
        readRes1.readThroughSequence === 3 &&
        readRes1.deliveredThroughSequence === 3,
      'R3-06-REQ-004: Read watermark to 3 automatically advances delivered watermark to 3 (Read implies delivered)'
    );

    // -------------------------------------------------------------------------
    // R3-06-REQ-007, REQ-008 & REQ-016: REST WATERMARK CONTRACTS
    // -------------------------------------------------------------------------
    console.log('\n--- Section 3.1: REST Watermark Contracts ---');

    // 1. Unauthenticated REST delivered request -> 401
    const unauthDelRes = await fetch(`http://127.0.0.1:${TEST_PORT}/v1/conversations/${convId}/receipts/delivered`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ throughSequence: 2 }),
    });
    assert(unauthDelRes.status === 401, 'R3-06-REQ-007: Unauthenticated REST delivered request returns 401');

    // 2. Non-member REST delivered request -> 403
    const nonMemberRestRes = await fetch(`http://127.0.0.1:${TEST_PORT}/v1/conversations/${convId}/receipts/delivered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenC}`,
      },
      body: JSON.stringify({ throughSequence: 2 }),
    });
    assert(nonMemberRestRes.status === 403, 'R3-06-REQ-007: Non-member REST delivered request returns 403');

    // 3. Valid authenticated REST delivered request
    const authDelRes = await fetch(`http://127.0.0.1:${TEST_PORT}/v1/conversations/${convId}/receipts/delivered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ throughSequence: 3 }),
    });
    const authDelData = await authDelRes.json();
    assert(authDelRes.status === 200 && authDelData.success === true && authDelData.data.deliveredThroughSequence === 3, 'R3-06-REQ-007: Authenticated REST delivered request returns 200 with receipt state');

    // 4. Valid authenticated REST read request
    const authReadRes = await fetch(`http://127.0.0.1:${TEST_PORT}/v1/conversations/${convId}/receipts/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ throughSequence: 3 }),
    });
    const authReadData = await authReadRes.json();
    assert(authReadRes.status === 200 && authReadData.success === true && authReadData.data.readThroughSequence === 3, 'R3-06-REQ-008: Authenticated REST read request returns 200 with receipt state');

    // 5. GET conversation receipt state endpoint
    const getRcptRes = await fetch(`http://127.0.0.1:${TEST_PORT}/v1/conversations/${convId}/receipts`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
    });
    const getRcptData = await getRcptRes.json();
    assert(
      getRcptRes.status === 200 &&
        getRcptData.success === true &&
        getRcptData.data.receiptState &&
        getRcptData.data.receiptState.peer.deliveredThroughSequence === 3 &&
        getRcptData.data.receiptState.peer.readThroughSequence === 3,
      'R3-06-REQ-016: GET /v1/conversations/:conversationId/receipts returns self and peer watermarks'
    );

    // -------------------------------------------------------------------------
    // R3-06-REQ-006 & REQ-020: CONVERSATION AUTHORIZATION & PRIVACY
    // -------------------------------------------------------------------------
    console.log('\n--- Section 4: Authorization, Non-Members & Blocks ---');

    // 1. Non-member (User C) cannot update watermark
    let nonMemberErr = null;
    try {
      await receiptService.advanceDeliveryWatermark({
        actorUserId: userC._id.toString(),
        conversationId: convId,
        throughSequence: 1,
      });
    } catch (err) {
      nonMemberErr = err;
    }
    assert(nonMemberErr && (nonMemberErr.code === 'MEMBERSHIP_REQUIRED' || nonMemberErr.statusCode === 403), 'R3-06-REQ-006: Non-member cannot update conversation watermark');

    // 2. Block enforcement
    await Block.create({ blocker: userA._id, blocked: userB._id, reason: 'Test Block' });
    let blockedErr = null;
    try {
      await receiptService.advanceDeliveryWatermark({
        actorUserId: userB._id.toString(),
        conversationId: convId,
        throughSequence: 3,
      });
    } catch (err) {
      blockedErr = err;
    }
    assert(blockedErr && (blockedErr.code === 'USER_BLOCKED' || blockedErr.statusCode === 403), 'R3-06-REQ-020: Blocked user cannot update watermarks');
    await Block.deleteMany({ $or: [{ blocker: userA._id }, { blocked: userA._id }] });

    // -------------------------------------------------------------------------
    // R3-06-REQ-015 & REQ-016: DIRECT-MESSAGE STATUS DERIVATION & DTO INTEGRATION
    // -------------------------------------------------------------------------
    console.log('\n--- Section 5: Direct-Message Status Derivation & DTOs ---');

    const peerWatermarks = {
      deliveredThroughSequence: 3,
      readThroughSequence: 2,
    };

    const status1 = receiptService.deriveDirectMessageStatus({ message: { sequence: 1, status: 'ACTIVE' }, peerWatermarks });
    const status2 = receiptService.deriveDirectMessageStatus({ message: { sequence: 2, status: 'ACTIVE' }, peerWatermarks });
    const status3 = receiptService.deriveDirectMessageStatus({ message: { sequence: 3, status: 'ACTIVE' }, peerWatermarks });
    const status4 = receiptService.deriveDirectMessageStatus({ message: { sequence: 4, status: 'ACTIVE' }, peerWatermarks });
    const statusDeleted = receiptService.deriveDirectMessageStatus({ message: { sequence: 1, status: 'DELETED' }, peerWatermarks });

    assert(status1 === 'READ', 'R3-06-REQ-015: Message 1 derived status is READ (readThroughSequence >= 1)');
    assert(status2 === 'READ', 'R3-06-REQ-015: Message 2 derived status is READ (readThroughSequence >= 2)');
    assert(status3 === 'DELIVERED', 'R3-06-REQ-015: Message 3 derived status is DELIVERED (deliveredThroughSequence >= 3, read < 3)');
    assert(status4 === 'SENT', 'R3-06-REQ-015: Message 4 derived status is SENT (neither delivered nor read)');
    assert(statusDeleted === 'DELETED', 'R3-06-REQ-015: Unsent message derived status remains DELETED tombstone');

    // Conversation Details Receipt State DTO
    const convDetails = await conversationService.getConversationDetails(userA._id.toString(), convId);
    assert(
      convDetails &&
        convDetails.receiptState &&
        convDetails.receiptState.peer &&
        convDetails.receiptState.peer.readThroughSequence === 3 &&
        convDetails.receiptState.peer.deliveredThroughSequence === 3,
      'R3-06-REQ-016: getConversationDetails embeds self and peer receiptState'
    );

    // -------------------------------------------------------------------------
    // R3-06-REQ-009, REQ-010 & REQ-013: SOCKET.IO WATERMARK COMMANDS & OUTBOX DISPATCH
    // -------------------------------------------------------------------------
    console.log('\n--- Section 6: Socket.io Watermark Commands & Outbox Dispatch ---');

    // User A sends message 4
    const msg4 = await messageService.sendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      clientMessageId: `cmsg_4_${timestamp}`,
      text: 'Message 4',
    });

    const clientSocketB = await connectSocketClient(TEST_PORT, tokenB);
    if (clientSocketB.socket) clientSocketsToClose.push(clientSocketB.socket);

    const clientSocketA = await connectSocketClient(TEST_PORT, tokenA);
    if (clientSocketA.socket) clientSocketsToClose.push(clientSocketA.socket);

    // Subscribe both sockets to conversation
    await new Promise((resolve) => clientSocketB.socket.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { conversationId: convId }, resolve));
    await new Promise((resolve) => clientSocketA.socket.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { conversationId: convId }, resolve));

    // User B sends socket receipt.delivered for sequence 4
    const socketAckPromise = new Promise((resolve) => {
      clientSocketB.socket.emit(
        SocketEvents.RECEIPT_DELIVERED,
        { conversationId: convId, throughSequence: 4 },
        (ack) => resolve(ack)
      );
    });

    const socketAck = await socketAckPromise;
    assert(socketAck && socketAck.ok === true && socketAck.data.deliveredThroughSequence === 4, 'R3-06-REQ-009/012: Socket.io receipt.delivered returns durable ACK');

    // Verify Outbox Event Dispatch
    const outboxWatermarkPromise = new Promise((resolve) => {
      clientSocketA.socket.once(SocketEvents.RECEIPT_WATERMARK_UPDATED, (event) => resolve(event));
    });

    await dispatchOutboxReceiptUpdated({
      conversationId: convId,
      actorUserId: userB._id.toString(),
      deliveredThroughSequence: 4,
      readThroughSequence: 3,
      deliveredAt: new Date().toISOString(),
      readAt: null,
      receiptType: 'DELIVERED',
    });

    const watermarkEvent = await outboxWatermarkPromise;
    assert(
      watermarkEvent &&
        watermarkEvent.data.deliveredThroughSequence === 4 &&
        watermarkEvent.data.actorUserId === userB._id.toString(),
      'R3-06-REQ-013/014: Outbox dispatches versioned conversation.receipt_watermark.updated event to peer'
    );

    // -------------------------------------------------------------------------
    // R3-06-REQ-017: MULTI-DEVICE ACCOUNT-LEVEL SEMANTICS
    // -------------------------------------------------------------------------
    console.log('\n--- Section 7: Multi-Device Account-Level Semantics ---');

    // Second device for User B
    const clientSocketB2 = await connectSocketClient(TEST_PORT, tokenB);
    if (clientSocketB2.socket) clientSocketsToClose.push(clientSocketB2.socket);

    const b2WatermarkPromise = new Promise((resolve) => {
      clientSocketB2.socket.once(SocketEvents.RECEIPT_WATERMARK_UPDATED, (event) => resolve(event));
    });

    // Device 1 advances read watermark to sequence 4
    await new Promise((resolve) => {
      clientSocketB.socket.emit(
        SocketEvents.RECEIPT_READ,
        { conversationId: convId, throughSequence: 4 },
        (ack) => resolve(ack)
      );
    });

    // Device 2 should receive the updated watermark event via user room
    await dispatchOutboxReceiptUpdated({
      conversationId: convId,
      actorUserId: userB._id.toString(),
      deliveredThroughSequence: 4,
      readThroughSequence: 4,
      deliveredAt: new Date().toISOString(),
      readAt: new Date().toISOString(),
      receiptType: 'READ',
    });

    const b2Event = await b2WatermarkPromise;
    assert(b2Event && b2Event.data.readThroughSequence === 4, 'R3-06-REQ-017: Multi-device sync notifies second device in user room');

    // -------------------------------------------------------------------------
    // R3-06-REQ-026: CONCURRENCY & RACE TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- Section 8: Concurrency & Race Tests ---');

    // Send messages 5, 6, 7, 8
    for (let i = 5; i <= 8; i++) {
      await messageService.sendMessage({
        actorUserId: userA._id.toString(),
        conversationId: convId,
        clientMessageId: `cmsg_${i}_${timestamp}`,
        text: `Message ${i}`,
      });
    }

    // 1. Simultaneous racing delivered commands for sequences 6 and 8
    const [raceDel1, raceDel2] = await Promise.all([
      receiptService.advanceDeliveryWatermark({ actorUserId: userB._id.toString(), conversationId: convId, throughSequence: 6 }),
      receiptService.advanceDeliveryWatermark({ actorUserId: userB._id.toString(), conversationId: convId, throughSequence: 8 }),
    ]);

    const finalMemberDel = await ConversationMember.findOne({ conversationId: convId, userId: userB._id });
    assert(finalMemberDel.deliveredThroughSequence === 8, 'R3-06-REQ-026: Racing delivery updates (6 vs 8) converge to highest value (8)');

    // 2. Simultaneous racing read commands for sequences 7 and 8
    const [raceRead1, raceRead2] = await Promise.all([
      receiptService.advanceReadWatermark({ actorUserId: userB._id.toString(), conversationId: convId, throughSequence: 7 }),
      receiptService.advanceReadWatermark({ actorUserId: userB._id.toString(), conversationId: convId, throughSequence: 8 }),
    ]);

    const finalMemberRead = await ConversationMember.findOne({ conversationId: convId, userId: userB._id });
    assert(finalMemberRead.readThroughSequence === 8 && finalMemberRead.deliveredThroughSequence === 8, 'R3-06-REQ-026: Racing read updates converge to highest value (8)');

    // 3. Concurrently racing Read 8 and Delivery 5
    await Promise.all([
      receiptService.advanceReadWatermark({ actorUserId: userB._id.toString(), conversationId: convId, throughSequence: 8 }),
      receiptService.advanceDeliveryWatermark({ actorUserId: userB._id.toString(), conversationId: convId, throughSequence: 5 }),
    ]);
    const finalCheck = await ConversationMember.findOne({ conversationId: convId, userId: userB._id });
    assert(finalCheck.readThroughSequence === 8 && finalCheck.deliveredThroughSequence === 8, 'R3-06-REQ-026: Watermark invariant read <= delivered holds under concurrency');

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
  runWatermarkReceiptTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runWatermarkReceiptTests;
