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
const { ConversationStatuses, MemberStates } = require('../models/enums');

// Services & Sockets
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const { dispatchOutboxMessageCreated, dispatchConversationRevoked } = require('../services/socketDispatchService');
const safetyService = require('../services/safetyService');

async function runSocketMessagingTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: SOCKET.IO ARCHITECTURE & SECURITY TESTS (R3-04)           ');
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

  // Helper to connect a test client socket
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

  const TEST_PORT = 5099;
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
      phone: `+9199100${timestamp.toString().slice(-5)}1`,
      email: `sock_a_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id }, secret, { expiresIn: '1h' });

    const userB = await User.create({
      phone: `+9199100${timestamp.toString().slice(-5)}2`,
      email: `sock_b_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id }, secret, { expiresIn: '1h' });

    const userC = await User.create({
      phone: `+9199100${timestamp.toString().slice(-5)}3`,
      email: `sock_c_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id }, secret, { expiresIn: '1h' });

    const userSuspended = await User.create({
      phone: `+9199100${timestamp.toString().slice(-5)}4`,
      email: `sock_susp_${timestamp}@test.com`,
      password: 'TestPassword123!',
      accountStatus: 'SUSPENDED',
    });
    const tokenSuspended = jwt.sign({ id: userSuspended._id }, secret, { expiresIn: '1h' });

    const expiredToken = jwt.sign({ id: userA._id }, secret, { expiresIn: '-10s' });

    await DatingProfile.create({ user: userA._id, displayName: 'Alice Socket', dateOfBirth: dob, age: 24, gender: 'Female' });
    await DatingProfile.create({ user: userB._id, displayName: 'Bob Socket', dateOfBirth: dob, age: 26, gender: 'Male' });
    await DatingProfile.create({ user: userC._id, displayName: 'Charlie Out', dateOfBirth: dob, age: 28, gender: 'Male' });

    // Create Active Match between A & B and ensure Conversation exists
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
    const convIdStr = convAB._id.toString();

    // -------------------------------------------------------------------------
    // SECTION 1: SOCKET HANDSHAKE AUTHENTICATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Socket Handshake Authentication ---');

    // Test 1: Valid JWT Token connects successfully
    const clientA = await connectSocketClient(TEST_PORT, tokenA);
    assert(clientA.socket !== null && clientA.socket.connected === true, 'R3-04-02: Valid JWT token connects to Socket.io');
    if (clientA.socket) clientSocketsToClose.push(clientA.socket);

    // Test 2: Missing Token fails handshake
    const clientNoToken = await connectSocketClient(TEST_PORT, null);
    assert(clientNoToken.socket === null && clientNoToken.error !== null, 'R3-04-02: Missing token is rejected during handshake');

    // Test 3: Invalid JWT Token fails handshake
    const clientInvalidToken = await connectSocketClient(TEST_PORT, 'invalid.jwt.token');
    assert(clientInvalidToken.socket === null && clientInvalidToken.error !== null, 'R3-04-02: Invalid JWT signature is rejected');

    // Test 4: Expired Token fails handshake
    const clientExpired = await connectSocketClient(TEST_PORT, expiredToken);
    assert(clientExpired.socket === null && clientExpired.error !== null, 'R3-04-12: Expired token is rejected during handshake');

    // Test 5: Suspended User fails handshake
    const clientSuspended = await connectSocketClient(TEST_PORT, tokenSuspended);
    assert(clientSuspended.socket === null && clientSuspended.error !== null, 'R3-04-12: Suspended user account connection is rejected');

    // -------------------------------------------------------------------------
    // SECTION 2: SERVER-CONTROLLED ROOMS & SUBSCRIPTION SECURITY
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Server-Controlled Rooms & Subscription Security ---');

    const clientB = await connectSocketClient(TEST_PORT, tokenB);
    if (clientB.socket) clientSocketsToClose.push(clientB.socket);

    const clientC = await connectSocketClient(TEST_PORT, tokenC);
    if (clientC.socket) clientSocketsToClose.push(clientC.socket);

    // Test 6: Authorized member User A can subscribe to conversation room
    const subPromiseA = new Promise((resolve) => {
      clientA.socket.emit(
        SocketEvents.CONVERSATION_SUBSCRIBE,
        { version: 1, data: { conversationId: convIdStr } },
        (ack) => resolve(ack)
      );
    });
    const subAckA = await subPromiseA;
    assert(subAckA && subAckA.ok === true && subAckA.code === 'CONVERSATION_SUBSCRIBED', 'R3-04-05: Active member successfully subscribes to conversation room');

    // Test 7: Authorized member User B can subscribe via legacy event join_chat
    const subPromiseB = new Promise((resolve) => {
      clientB.socket.emit(SocketEvents.LEGACY_JOIN_CHAT, convIdStr, (ack) => resolve(ack));
    });
    const subAckB = await subPromiseB;
    assert(subAckB && subAckB.ok === true, 'R3-04-05: Legacy join_chat event successfully subscribes authorized member');

    // Test 8: Non-member User C subscription is denied
    const subPromiseC = new Promise((resolve) => {
      clientC.socket.emit(
        SocketEvents.CONVERSATION_SUBSCRIBE,
        { version: 1, data: { conversationId: convIdStr } },
        (ack) => resolve(ack)
      );
    });
    const subAckC = await subPromiseC;
    assert(
      subAckC && subAckC.ok === false && (subAckC.code === 'MEMBERSHIP_REQUIRED' || subAckC.code === 'CONVERSATION_SUBSCRIPTION_DENIED'),
      'R3-04-06: Non-member subscription attempt is denied access'
    );

    // Test 9: Conversation unsubscription succeeds without leaving user room
    const unsubPromiseA = new Promise((resolve) => {
      clientA.socket.emit(
        SocketEvents.CONVERSATION_UNSUBSCRIBE,
        { version: 1, data: { conversationId: convIdStr } },
        (ack) => resolve(ack)
      );
    });
    const unsubAckA = await unsubPromiseA;
    assert(unsubAckA && unsubAckA.ok === true, 'R3-04-06: Conversation unsubscription succeeds');

    // Re-subscribe User A for message testing
    await new Promise((resolve) => {
      clientA.socket.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { version: 1, data: { conversationId: convIdStr } }, resolve);
    });

    // -------------------------------------------------------------------------
    // SECTION 3: REAL-TIME MESSAGE SENDING & DURABLE ACKS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Real-Time Message Sending & Durable ACKs ---');

    const clientMsgId1 = `cmsg_${timestamp}_001`;

    // Test 10: Authorized message send succeeds and returns durable ACK
    const sendPromise1 = new Promise((resolve) => {
      clientA.socket.emit(
        SocketEvents.MESSAGE_SEND,
        {
          version: 1,
          data: {
            conversationId: convIdStr,
            clientMessageId: clientMsgId1,
            text: 'Hello from User A via Socket.io!',
            type: 'TEXT',
          },
        },
        (ack) => resolve(ack)
      );
    });

    const sendAck1 = await sendPromise1;
    assert(sendAck1 && sendAck1.ok === true && sendAck1.code === 'MESSAGE_ACCEPTED', 'R3-04-08: message.send returns MESSAGE_ACCEPTED ACK');
    assert(sendAck1.data && sendAck1.data.message && sendAck1.data.message.sequence === 1, 'R3-04-07: First message sequence is 1');
    assert(sendAck1.data.message.senderId === userA._id.toString(), 'R3-04-03: Sender identity is derived strictly from socket session');

    // Test 11: Message is verified to exist durably in MongoDB
    const persistedMsg = await Message.findOne({ clientMessageId: clientMsgId1 });
    assert(persistedMsg !== null, 'R3-04-07: Message is durably committed in MongoDB before ACK returned');
    assert(persistedMsg.text === 'Hello from User A via Socket.io!', 'R3-04-07: Persisted message text matches payload');

    // Test 12: Idempotent repeat send with same clientMessageId returns original message
    const sendPromiseRepeat = new Promise((resolve) => {
      clientA.socket.emit(
        SocketEvents.MESSAGE_SEND,
        {
          version: 1,
          data: {
            conversationId: convIdStr,
            clientMessageId: clientMsgId1,
            text: 'Different text with same clientMessageId',
          },
        },
        (ack) => resolve(ack)
      );
    });

    const sendAckRepeat = await sendPromiseRepeat;
    assert(sendAckRepeat && sendAckRepeat.ok === true, 'R3-04-10: Repeated send returns successful ACK');
    assert(sendAckRepeat.data.idempotentReplay === true, 'R3-04-10: Response flags idempotentReplay: true');
    assert(sendAckRepeat.data.message.id === persistedMsg._id.toString(), 'R3-04-10: Resolved message ID matches original message');

    // Test 13: Second distinct message increments monotonic sequence to 2
    const clientMsgId2 = `cmsg_${timestamp}_002`;
    const sendPromise2 = new Promise((resolve) => {
      clientB.socket.emit(
        SocketEvents.MESSAGE_SEND,
        {
          version: 1,
          data: {
            conversationId: convIdStr,
            clientMessageId: clientMsgId2,
            text: 'Reply from User B!',
          },
        },
        (ack) => resolve(ack)
      );
    });
    const sendAck2 = await sendPromise2;
    assert(sendAck2 && sendAck2.data && sendAck2.data.message.sequence === 2, 'R3-04-07: Monotonic per-conversation sequence increments to 2');

    // Test 14: Non-member User C send attempt is rejected
    const sendPromiseC = new Promise((resolve) => {
      clientC.socket.emit(
        SocketEvents.MESSAGE_SEND,
        {
          version: 1,
          data: {
            conversationId: convIdStr,
            clientMessageId: `cmsg_${timestamp}_c`,
            text: 'Intruder message',
          },
        },
        (ack) => resolve(ack)
      );
    });
    const sendAckC = await sendPromiseC;
    assert(sendAckC && sendAckC.ok === false, 'R3-04-07: Non-member message send is rejected');

    // Test 15: Empty text is rejected
    const sendPromiseEmpty = new Promise((resolve) => {
      clientA.socket.emit(
        SocketEvents.MESSAGE_SEND,
        {
          version: 1,
          data: {
            conversationId: convIdStr,
            clientMessageId: `cmsg_${timestamp}_empty`,
            text: '   ',
          },
        },
        (ack) => resolve(ack)
      );
    });
    const sendAckEmpty = await sendPromiseEmpty;
    assert(sendAckEmpty && sendAckEmpty.ok === false && sendAckEmpty.code === 'MESSAGE_TEXT_EMPTY', 'R3-04-11: Empty message text is rejected');

    // -------------------------------------------------------------------------
    // SECTION 4: OUTBOX-TO-SOCKET.IO REAL-TIME DELIVERY TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Outbox Real-Time Delivery ---');

    // Test 16: Outbox event dispatch delivers message.created to subscribed client
    const outboxMessagePromise = new Promise((resolve) => {
      clientB.socket.once(SocketEvents.MESSAGE_CREATED, (event) => {
        resolve(event);
      });
    });

    const outboxResult = await dispatchOutboxMessageCreated({
      conversationId: convIdStr,
      messageId: persistedMsg._id.toString(),
      senderId: userA._id.toString(),
      clientMessageId: clientMsgId1,
      sequence: 1,
      type: 'TEXT',
      text: persistedMsg.text,
      createdAt: persistedMsg.createdAt,
    });

    assert(outboxResult.dispatched === true, 'R3-04-09: Outbox dispatch succeeds for active conversation');

    const receivedEvent = await outboxMessagePromise;
    assert(receivedEvent && receivedEvent.eventType === SocketEvents.MESSAGE_CREATED, 'R3-04-09: message.created event received by subscribed socket');
    assert(receivedEvent.data.message.text === persistedMsg.text, 'R3-04-09: Delivered message content matches outbox payload');

    // -------------------------------------------------------------------------
    // SECTION 5: LIFECYCLE REVOCATION (UNMATCH & BLOCK) TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Dynamic Revocation on Unmatch & Block ---');

    // Test 17: Unmatch triggers conversation.revoked and evicts room
    const revokedPromise = new Promise((resolve) => {
      clientA.socket.once(SocketEvents.CONVERSATION_REVOKED, (event) => {
        resolve(event);
      });
    });

    await safetyService.unmatchUser(userA._id.toString(), matchAB._id.toString());

    const revokedEvent = await revokedPromise;
    assert(revokedEvent && revokedEvent.eventType === SocketEvents.CONVERSATION_REVOKED, 'R3-04-13: Unmatching emits conversation.revoked event');
    assert(revokedEvent.data.conversationId === convIdStr, 'R3-04-13: Revocation specifies affected conversation ID');

    // Test 18: After unmatch, sending messages is strictly denied
    const sendPromiseAfterUnmatch = new Promise((resolve) => {
      clientA.socket.emit(
        SocketEvents.MESSAGE_SEND,
        {
          version: 1,
          data: {
            conversationId: convIdStr,
            clientMessageId: `cmsg_${timestamp}_after_unmatch`,
            text: 'Should fail after unmatch',
          },
        },
        (ack) => resolve(ack)
      );
    });
    const sendAckAfterUnmatch = await sendPromiseAfterUnmatch;
    assert(
      sendAckAfterUnmatch && sendAckAfterUnmatch.ok === false && sendAckAfterUnmatch.code === 'CONVERSATION_NOT_AVAILABLE',
      'R3-04-13: Sending messages to closed/unmatched conversation is rejected'
    );

    // -------------------------------------------------------------------------
    // SECTION 6: CALL SIGNALING & WEBRTC ISOLATION TESTS
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Calling & WebRTC Signaling Isolation ---');

    // Test 19: call_user initiates incoming_call to recipient without interfering with messaging
    const callSessionId = `call_sess_${timestamp}`;
    const incomingCallPromise = new Promise((resolve) => {
      clientB.socket.once(SocketEvents.INCOMING_CALL, (callData) => {
        resolve(callData);
      });
    });

    clientA.socket.emit(SocketEvents.CALL_USER, {
      recipientId: userB._id.toString(),
      callType: 'video',
      callSessionId,
    });

    const incomingCallData = await incomingCallPromise;
    assert(incomingCallData && incomingCallData.callSessionId === callSessionId, 'R3-04-15: WebRTC call initiation signals recipient successfully');
    assert(incomingCallData.callerId === userA._id.toString(), 'R3-04-15: Incoming call caller ID matches sender');

    // Test 20: call_accepted relays call_connected to caller
    const callConnectedPromise = new Promise((resolve) => {
      clientA.socket.once(SocketEvents.CALL_CONNECTED, (data) => {
        resolve(data);
      });
    });

    clientB.socket.emit(SocketEvents.CALL_ACCEPTED, {
      callerId: userA._id.toString(),
      callSessionId,
    });

    const connectedData = await callConnectedPromise;
    assert(connectedData && connectedData.callSessionId === callSessionId, 'R3-04-15: Call accept relays call_connected signal');

    // Test 21: send_webrtc_signal relays ICE/SDP payload
    const webrtcSignalPromise = new Promise((resolve) => {
      clientB.socket.once(SocketEvents.RECEIVE_WEBRTC_SIGNAL, (signal) => {
        resolve(signal);
      });
    });

    clientA.socket.emit(SocketEvents.SEND_WEBRTC_SIGNAL, {
      recipientId: userB._id.toString(),
      signalData: { type: 'offer', sdp: 'v=0...' },
    });

    const receivedSignal = await webrtcSignalPromise;
    assert(receivedSignal && receivedSignal.signalData.type === 'offer', 'R3-04-15: WebRTC SDP signal relayed accurately');

    // Test 22: call_ended relays call_hungup
    const callHungupPromise = new Promise((resolve) => {
      clientB.socket.once(SocketEvents.CALL_HUNGUP, (data) => {
        resolve(data);
      });
    });

    clientA.socket.emit(SocketEvents.CALL_ENDED, {
      recipientId: userB._id.toString(),
      callSessionId,
    });

    const hungupData = await callHungupPromise;
    assert(hungupData && hungupData.callSessionId === callSessionId, 'R3-04-15: Call end relays call_hungup signal');

  } catch (err) {
    console.error('UNEXPECTED SOCKET TEST ERROR:', err);
    failed++;
  } finally {
    // Disconnect test client sockets
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
  runSocketMessagingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runSocketMessagingTests;
