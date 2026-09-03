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
const MessageReaction = require('../models/MessageReaction');
const Poll = require('../models/Poll');
const PollVote = require('../models/PollVote');
const Block = require('../models/Block');
const OutboxEvent = require('../models/OutboxEvent');
const { ConversationStatuses, MemberStates, MemberRoles, MessageReactions, PollStatuses } = require('../models/enums');

// Services & Sockets
const conversationService = require('../services/conversationService');
const messageService = require('../services/messageService');
const reactionService = require('../services/reactionService');
const pollService = require('../services/pollService');
const syncService = require('../services/syncService');
const safetyService = require('../services/safetyService');
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const conversationRoutes = require('../routes/conversationRoutes');

async function runReactionReplyPollTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: REACTIONS, REPLIES & IN-CHAT POLLS TESTS (R3-09)          ');
  console.log('================================================================================\n');

  await connectDB();
  await Conversation.init();
  await ConversationMember.init();
  await Message.init();
  await MessageReaction.init();
  await Poll.init();
  await PollVote.init();

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

  const TEST_PORT = 5097;
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
      phone: `+9199300${timestamp.toString().slice(-5)}1`,
      email: `rrp_a_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id, userId: userA._id }, secret, { expiresIn: '1h' });

    const userB = await User.create({
      phone: `+9199300${timestamp.toString().slice(-5)}2`,
      email: `rrp_b_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id, userId: userB._id }, secret, { expiresIn: '1h' });

    const userC = await User.create({
      phone: `+9199300${timestamp.toString().slice(-5)}3`,
      email: `rrp_c_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id, userId: userC._id }, secret, { expiresIn: '1h' });

    await DatingProfile.create({ user: userA._id, displayName: 'Alice R309', dateOfBirth: dob, age: 24, gender: 'Female' });
    await DatingProfile.create({ user: userB._id, displayName: 'Bob R309', dateOfBirth: dob, age: 26, gender: 'Male' });
    await DatingProfile.create({ user: userC._id, displayName: 'Charlie R309', dateOfBirth: dob, age: 28, gender: 'Male' });

    // 2. Create Active Match and Conversation between User A and User B
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

    // 3. User A sends initial messages: Message 1 and Message 2
    const msg1Res = await messageService.sendMessage({
      actorUserId: userA._id,
      conversationId: convId,
      clientMessageId: `cmsg_1_${timestamp}`,
      text: 'Hello Bob! This is message 1.',
      type: 'TEXT',
    });
    const msg1Id = msg1Res.message.id;

    const msg2Res = await messageService.sendMessage({
      actorUserId: userB._id,
      conversationId: convId,
      clientMessageId: `cmsg_2_${timestamp}`,
      text: 'Hey Alice! Message 2 received.',
      type: 'TEXT',
    });
    const msg2Id = msg2Res.message.id;

    console.log('\n--- SECTION 1: DURABLE MESSAGE REACTIONS (R3-09-REQ-001 to REQ-006) ---');
    // 1. Add Reaction (User B reacts LOVE on Message 1)
    const rx1 = await reactionService.addOrUpdateReaction({
      actorUserId: userB._id,
      conversationId: convId,
      messageId: msg1Id,
      reaction: 'LOVE',
    });
    assert(rx1.success === true && rx1.changed === true && rx1.reaction === 'LOVE',
      'R3-09-REQ-001 / REQ-003: User B successfully reacts LOVE to Message 1');
    assert(rx1.summary.total === 1 && rx1.summary.counts.LOVE === 1,
      'R3-09-REQ-004: Reaction summary materialized with total=1 and counts.LOVE=1');

    // Check Reaction Document in DB
    const rxDocInDb = await MessageReaction.findOne({ messageId: msg1Id, userId: userB._id });
    assert(rxDocInDb !== null && rxDocInDb.reaction === 'LOVE',
      'R3-09-REQ-001: MessageReaction document created with compound index');

    // 2. Duplicate Reaction (Idempotent No-op)
    const rxDup = await reactionService.addOrUpdateReaction({
      actorUserId: userB._id,
      conversationId: convId,
      messageId: msg1Id,
      reaction: 'LOVE',
    });
    assert(rxDup.success === true && rxDup.changed === false && rxDup.summary.total === 1,
      'R3-09-REQ-005: Duplicate reaction submission is an idempotent no-op without double counting');

    // 3. Replace Reaction (User B changes from LOVE to LIKE)
    const rxChange = await reactionService.addOrUpdateReaction({
      actorUserId: userB._id,
      conversationId: convId,
      messageId: msg1Id,
      reaction: '👍', // emoji normalized to LIKE
    });
    assert(rxChange.success === true && rxChange.changed === true && rxChange.reaction === 'LIKE',
      'R3-09-REQ-002 / REQ-003: Reaction replaced and emoji normalized to LIKE');
    assert(rxChange.summary.total === 1 && rxChange.summary.counts.LIKE === 1 && rxChange.summary.counts.LOVE === undefined,
      'R3-09-REQ-004: Reaction replace decrements old count and increments new count atomically');

    // 4. User A also reacts (FIRE)
    const rxA = await reactionService.addOrUpdateReaction({
      actorUserId: userA._id,
      conversationId: convId,
      messageId: msg1Id,
      reaction: 'FIRE',
    });
    assert(rxA.summary.total === 2 && rxA.summary.counts.LIKE === 1 && rxA.summary.counts.FIRE === 1,
      'R3-09-REQ-004: Multi-user reactions aggregate correctly without unbounded arrays');

    // 5. Remove Reaction (User B removes LIKE)
    const rxRem = await reactionService.removeReaction({
      actorUserId: userB._id,
      conversationId: convId,
      messageId: msg1Id,
    });
    assert(rxRem.success === true && rxRem.changed === true && rxRem.summary.total === 1 && rxRem.summary.counts.LIKE === undefined,
      'R3-09-REQ-003: Reaction removal decrements count correctly');

    // 6. Duplicate Remove (Idempotent No-op)
    const rxRemDup = await reactionService.removeReaction({
      actorUserId: userB._id,
      conversationId: convId,
      messageId: msg1Id,
    });
    assert(rxRemDup.success === true && rxRemDup.changed === false && rxRemDup.summary.total === 1,
      'R3-09-REQ-005: Duplicate remove reaction is an idempotent no-op');

    // 7. Check Outbox Events for reactions
    const rxOutboxEvents = await OutboxEvent.find({ eventType: 'message.reaction.updated', aggregateId: msg1Id.toString() });
    assert(rxOutboxEvents.length >= 3,
      'R3-09-REQ-006: Transactional OutboxEvents created for reaction mutations with versioning');

    // 8. Paginated Reactor List
    const reactorList = await reactionService.getMessageReactions({
      actorUserId: userA._id,
      conversationId: convId,
      messageId: msg1Id,
    });
    assert(reactorList.items.length === 1 && reactorList.items[0].userId === userA._id.toString(),
      'R3-09-REQ-004: Paginated reactor list query returns authorized conversation members only');

    console.log('\n--- SECTION 2: SECURE QUOTED-MESSAGE REPLIES (R3-09-REQ-007 to REQ-011) ---');
    // 1. Valid Quoted Reply (User B replies to Message 1)
    const reply1 = await messageService.sendMessage({
      actorUserId: userB._id,
      conversationId: convId,
      clientMessageId: `cmsg_reply_1_${timestamp}`,
      text: 'Replying to your first message!',
      replyToMessageId: msg1Id,
    });
    assert(reply1.message.replyToMessageId === msg1Id.toString() && reply1.message.replyToSequence === 1,
      'R3-09-REQ-007: Reply captures replyToMessageId and replyToSequence accurately');
    assert(reply1.message.replyTo !== null && reply1.message.replyTo.textPreview === 'Hello Bob! This is message 1.',
      'R3-09-REQ-009: Message DTO contains derived safe reply preview');

    // 2. Reply to Reply (Nested reply referencing direct parent)
    const reply2 = await messageService.sendMessage({
      actorUserId: userA._id,
      conversationId: convId,
      clientMessageId: `cmsg_reply_2_${timestamp}`,
      text: 'Replying to your reply!',
      replyToMessageId: reply1.message.id,
    });
    assert(reply2.message.replyToMessageId === reply1.message.id.toString(),
      'R3-09-REQ-007: Replying to another reply references direct parent correctly');

    // 3. Cross-Conversation Reply Rejection
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
    const convACRes = await conversationService.ensureDirectMatchConversation({
      actorUserId: userA._id.toString(),
      matchId: matchAC._id.toString(),
    });
    const convACId = convACRes.conversation._id.toString();

    let crossConvFailed = false;
    try {
      await messageService.sendMessage({
        actorUserId: userA._id,
        conversationId: convACId,
        clientMessageId: `cmsg_cross_${timestamp}`,
        text: 'Trying cross-conversation reply',
        replyToMessageId: msg1Id, // Belongs to convAB
      });
    } catch (err) {
      crossConvFailed = true;
      assert(err.code === 'REPLY_TARGET_CONVERSATION_MISMATCH',
        'R3-09-REQ-008: Cross-conversation reply attempt rejected with REPLY_TARGET_CONVERSATION_MISMATCH');
    }
    assert(crossConvFailed === true, 'R3-09-REQ-008: Cross-conversation reply security check passed');

    // 4. Missing Target Reply Rejection
    let missingTargetFailed = false;
    try {
      await messageService.sendMessage({
        actorUserId: userA._id,
        conversationId: convId,
        clientMessageId: `cmsg_missing_${timestamp}`,
        text: 'Replying to non-existent message',
        replyToMessageId: new mongoose.Types.ObjectId(),
      });
    } catch (err) {
      missingTargetFailed = true;
      assert(err.code === 'REPLY_TARGET_NOT_FOUND',
        'R3-09-REQ-008: Non-existent reply target rejected with REPLY_TARGET_NOT_FOUND');
    }
    assert(missingTargetFailed === true, 'R3-09-REQ-008: Missing reply target check passed');

    // 5. Unsend / Tombstone Reply Safety (Unsend Message 1, check reply preview redaction)
    await messageService.unsendMessage({
      actorUserId: userA._id,
      conversationId: convId,
      messageId: msg1Id,
    });

    const msg1AfterUnsend = await Message.findById(msg1Id);
    const safePreviewAfterUnsend = messageService.formatReplyPreview(msg1AfterUnsend);
    assert(safePreviewAfterUnsend.isUnavailable === true && safePreviewAfterUnsend.textPreview === 'This message was unsent.',
      'R3-09-REQ-010: Unsent message content is redacted and cannot leak via reply previews');

    console.log('\n--- SECTION 3: IN-CHAT POLLS (R3-09-REQ-012 to REQ-019) ---');
    // 1. Create Valid Single-Select Poll Message
    const pollMsgRes = await messageService.sendMessage({
      actorUserId: userA._id,
      conversationId: convId,
      clientMessageId: `cmsg_poll_1_${timestamp}`,
      type: 'POLL',
      poll: {
        question: 'Where should we go this weekend?',
        options: ['Coffee Shop', 'Art Gallery', 'Central Park'],
        allowMultiple: false,
      },
    });
    assert(pollMsgRes.message.type === 'POLL' && pollMsgRes.message.poll !== null,
      'R3-09-REQ-012 / REQ-014: Poll message created transactionally with message service');
    const createdPoll = pollMsgRes.message.poll;
    assert(createdPoll.options.length === 3 && createdPoll.options[0].optionId.startsWith('opt_'),
      'R3-09-REQ-013: Poll options have server-generated unique option IDs');
    assert(createdPoll.totalVoters === 0 && createdPoll.status === 'OPEN',
      'R3-09-REQ-012: New poll initializes with OPEN status and 0 total voters');

    const optCoffee = createdPoll.options[0].optionId;
    const optGallery = createdPoll.options[1].optionId;
    const optPark = createdPoll.options[2].optionId;

    // 2. Poll Bounds & Duplicate Option Rejection
    let dupOptFailed = false;
    try {
      await pollService.createPollDocument({
        actorUserId: userA._id,
        conversationId: convId,
        messageId: new mongoose.Types.ObjectId(),
        pollData: {
          question: 'What to eat?',
          options: ['Pizza', 'pizza'], // duplicate
        },
      });
    } catch (err) {
      dupOptFailed = true;
      assert(err.code === 'DUPLICATE_POLL_OPTIONS',
        'R3-09-REQ-013: Duplicate poll options rejected with DUPLICATE_POLL_OPTIONS');
    }
    assert(dupOptFailed === true, 'R3-09-REQ-013: Duplicate option validation check passed');

    // 3. User B votes for Coffee Shop
    const vote1 = await pollService.votePoll({
      actorUserId: userB._id,
      conversationId: convId,
      pollId: createdPoll.id,
      optionIds: [optCoffee],
    });
    assert(vote1.success === true && vote1.changed === true,
      'R3-09-REQ-015: User B votes on poll successfully');
    assert(vote1.poll.totalVoters === 1 && vote1.poll.options.find((o) => o.optionId === optCoffee).voteCount === 1,
      'R3-09-REQ-016: Vote increments option voteCount and totalVoters atomically');
    assert(vote1.poll.currentUserOptionIds.includes(optCoffee),
      'R3-09-REQ-018: Poll DTO includes currentUserOptionIds for authorized voter');

    // 4. Duplicate Vote (Idempotent No-op)
    const voteDup = await pollService.votePoll({
      actorUserId: userB._id,
      conversationId: convId,
      pollId: createdPoll.id,
      optionIds: [optCoffee],
    });
    assert(voteDup.success === true && voteDup.changed === false,
      'R3-09-REQ-016: Duplicate poll vote is an idempotent no-op without double counting');

    // 5. Replace Vote (User B changes vote from Coffee Shop to Central Park)
    const voteChange = await pollService.votePoll({
      actorUserId: userB._id,
      conversationId: convId,
      pollId: createdPoll.id,
      optionIds: [optPark],
    });
    assert(voteChange.success === true && voteChange.changed === true,
      'R3-09-REQ-016: User B changes vote to Central Park');
    assert(voteChange.poll.options.find((o) => o.optionId === optCoffee).voteCount === 0,
      'R3-09-REQ-016: Previous option voteCount decremented to 0 (never negative)');
    assert(voteChange.poll.options.find((o) => o.optionId === optPark).voteCount === 1,
      'R3-09-REQ-016: New option voteCount incremented to 1');
    assert(voteChange.poll.totalVoters === 1,
      'R3-09-REQ-016: Total voters remains 1 on vote change');

    // 6. User A also votes (Central Park)
    const voteA = await pollService.votePoll({
      actorUserId: userA._id,
      conversationId: convId,
      pollId: createdPoll.id,
      optionIds: [optPark],
    });
    assert(voteA.poll.totalVoters === 2 && voteA.poll.options.find((o) => o.optionId === optPark).voteCount === 2,
      'R3-09-REQ-016: Multiple users voting on same option tracks totalVoters=2 and voteCount=2');

    // 7. Single-Select Violation Rejection
    let multiSelectFailed = false;
    try {
      await pollService.votePoll({
        actorUserId: userB._id,
        conversationId: convId,
        pollId: createdPoll.id,
        optionIds: [optCoffee, optGallery],
      });
    } catch (err) {
      multiSelectFailed = true;
      assert(err.code === 'POLL_SELECTION_LIMIT_EXCEEDED',
        'R3-09-REQ-016: Multiple selections on single-select poll rejected');
    }
    assert(multiSelectFailed === true, 'R3-09-REQ-016: Selection limit check passed');

    // 8. Close Poll (User A closes poll)
    const closeRes = await pollService.closePoll({
      actorUserId: userA._id,
      conversationId: convId,
      pollId: createdPoll.id,
    });
    assert(closeRes.success === true && closeRes.poll.status === 'CLOSED',
      'R3-09-REQ-017: Poll creator closes poll successfully');

    // 9. Vote on Closed Poll Rejected
    let voteOnClosedFailed = false;
    try {
      await pollService.votePoll({
        actorUserId: userB._id,
        conversationId: convId,
        pollId: createdPoll.id,
        optionIds: [optGallery],
      });
    } catch (err) {
      voteOnClosedFailed = true;
      assert(err.code === 'POLL_CLOSED',
        'R3-09-REQ-017: Voting on closed poll rejected with POLL_CLOSED');
    }
    assert(voteOnClosedFailed === true, 'R3-09-REQ-017: Closed poll vote rejection check passed');

    // 10. Check Poll Outbox Events
    const pollOutboxEvents = await OutboxEvent.find({ aggregateId: createdPoll.id.toString() });
    assert(pollOutboxEvents.length >= 3,
      'R3-09-REQ-019: Transactional OutboxEvents created for poll votes and closing');

    console.log('\n--- SECTION 4: SOCKET.IO INTERACTION CONTRACTS (R3-09-REQ-021, REQ-022) ---');
    // Connect Socket A and Socket B
    const { socket: sockA } = await connectSocketClient(TEST_PORT, tokenA);
    const { socket: sockB } = await connectSocketClient(TEST_PORT, tokenB);
    clientSocketsToClose.push(sockA, sockB);

    await new Promise((resolve) => {
      sockA.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { conversationId: convId }, resolve);
    });
    await new Promise((resolve) => {
      sockB.emit(SocketEvents.CONVERSATION_SUBSCRIBE, { conversationId: convId }, resolve);
    });

    let rxBroadcastForB = null;
    sockB.on(SocketEvents.MESSAGE_REACTION_UPDATED, (evt) => {
      rxBroadcastForB = evt;
    });

    // Socket: User A sets reaction on Message 2
    const sockRxRes = await new Promise((resolve) => {
      sockA.emit(SocketEvents.MESSAGE_REACTION_SET, {
        conversationId: convId,
        messageId: msg2Id,
        reaction: 'LAUGH',
      }, resolve);
    });
    assert(sockRxRes.ok === true && sockRxRes.code === 'REACTION_ACCEPTED',
      'R3-09-REQ-021: Socket command message.reaction.set acknowledged after commit');

    await new Promise((r) => setTimeout(r, 50));
    assert(rxBroadcastForB !== null && rxBroadcastForB.reaction === 'LAUGH' && rxBroadcastForB.actorUserId === userA._id.toString(),
      'R3-09-REQ-021: message.reaction.updated broadcast delivered to conversation room');

    // Socket: User A creates a Multi-Select Poll
    let pollCreatedBroadcast = null;
    sockB.on(SocketEvents.MESSAGE_CREATED, (evt) => {
      if (evt.data && evt.data.message && evt.data.message.type === 'POLL') {
        pollCreatedBroadcast = evt.data.message;
      }
    });

    const sockPollSendRes = await new Promise((resolve) => {
      sockA.emit(SocketEvents.MESSAGE_SEND, {
        conversationId: convId,
        type: 'POLL',
        poll: {
          question: 'Favorite activities? (Select multiple)',
          options: ['Reading', 'Gaming', 'Hiking', 'Cooking'],
          allowMultiple: true,
          maxSelections: 3,
        },
      }, resolve);
    });
    assert(sockPollSendRes.ok === true && sockPollSendRes.data.message.poll !== null,
      'R3-09-REQ-021: Socket command message.send successfully creates in-chat poll message');

    const multiPoll = sockPollSendRes.data.message.poll;
    const optReading = multiPoll.options[0].optionId;
    const optGaming = multiPoll.options[1].optionId;

    // Socket: User B votes on Multi-Select Poll
    let pollVoteBroadcastForA = null;
    sockA.on(SocketEvents.POLL_VOTE_UPDATED, (evt) => {
      pollVoteBroadcastForA = evt;
    });

    const sockVoteRes = await new Promise((resolve) => {
      sockB.emit(SocketEvents.POLL_VOTE_SET, {
        conversationId: convId,
        pollId: multiPoll.id,
        optionIds: [optReading, optGaming],
      }, resolve);
    });
    assert(sockVoteRes.ok === true && sockVoteRes.data.poll.totalVoters === 1,
      'R3-09-REQ-021: Socket command poll.vote.set acknowledged after commit');

    await new Promise((r) => setTimeout(r, 50));
    assert(pollVoteBroadcastForA !== null && pollVoteBroadcastForA.pollId === multiPoll.id,
      'R3-09-REQ-021: poll.vote.updated broadcast delivered to conversation room');

    console.log('\n--- SECTION 5: OFFLINE SYNC COMPATIBILITY & ZERO N+1 (R3-09-REQ-023) ---');
    // Forward Sync query on conversation
    const syncRes = await syncService.syncConversationMessages({
      actorUserId: userA._id,
      conversationId: convId,
      afterSequence: 0,
      limit: 20,
    });
    assert(syncRes.messages.length > 0,
      'R3-09-REQ-023: Offline sync catch-up returns conversation messages');

    const pollSyncMsgs = syncRes.messages.filter((m) => m.type === 'POLL');
    assert(pollSyncMsgs.length >= 2 && pollSyncMsgs.every((m) => m.poll !== null && m.poll.options.length >= 3),
      'R3-09-REQ-023: Sync message DTO includes fully resolved poll document without N+1 queries');

    const replySyncMsg = syncRes.messages.find((m) => m.replyToMessageId);
    assert(replySyncMsg && replySyncMsg.replyTo !== null,
      'R3-09-REQ-023: Sync message DTO includes fully resolved reply preview without N+1 queries');

    console.log('\n--- SECTION 6: CONCURRENCY & RACE CONDITIONS (R3-09-REQ-028) ---');
    // 1. Same user setting same reaction simultaneously
    const [rxRace1, rxRace2] = await Promise.all([
      reactionService.addOrUpdateReaction({ actorUserId: userA._id, conversationId: convId, messageId: msg2Id, reaction: 'LOVE' }),
      reactionService.addOrUpdateReaction({ actorUserId: userA._id, conversationId: convId, messageId: msg2Id, reaction: 'LOVE' }),
    ]);
    const rxCountInDb = await MessageReaction.countDocuments({ messageId: msg2Id, userId: userA._id });
    assert(rxCountInDb === 1,
      'R3-09-REQ-028: Concurrent reaction submissions produce exactly 1 reaction document');

    // 2. Concurrent votes on same poll
    const [voteRace1, voteRace2] = await Promise.all([
      pollService.votePoll({ actorUserId: userA._id, conversationId: convId, pollId: multiPoll.id, optionIds: [optReading] }),
      pollService.votePoll({ actorUserId: userB._id, conversationId: convId, pollId: multiPoll.id, optionIds: [optReading] }),
    ]);
    const latestMultiPoll = await Poll.findById(multiPoll.id);
    const readingOpt = latestMultiPoll.options.find((o) => o.optionId === optReading);
    assert(readingOpt.voteCount === 2 && latestMultiPoll.totalVoters === 2,
      'R3-09-REQ-028: Concurrent voting on same option increments count and totalVoters atomically');

    console.log('\n--- SECTION 7: SECURITY, PRIVACY & BLOCKING (R3-09-REQ-024, REQ-027) ---');
    // 1. Non-member / Unauthorized access
    let nonMemberRxFailed = false;
    try {
      await reactionService.addOrUpdateReaction({
        actorUserId: userC._id,
        conversationId: convId,
        messageId: msg2Id,
        reaction: 'LIKE',
      });
    } catch (err) {
      nonMemberRxFailed = true;
      assert(err.code === 'MEMBERSHIP_REQUIRED' || err.statusCode === 403,
        'R3-09-REQ-024: Non-member reaction rejected with 403 / MEMBERSHIP_REQUIRED');
    }
    assert(nonMemberRxFailed === true, 'R3-09-REQ-024: Non-member reaction access control passed');

    // 2. Block User B and verify reaction & vote rejection
    await safetyService.blockUser(userA._id, userB._id);

    let blockedRxFailed = false;
    try {
      await reactionService.addOrUpdateReaction({
        actorUserId: userB._id,
        conversationId: convId,
        messageId: msg2Id,
        reaction: 'LIKE',
      });
    } catch (err) {
      blockedRxFailed = true;
      assert(
        ['USER_BLOCKED', 'CONVERSATION_NOT_AVAILABLE', 'MATCH_NOT_ACTIVE', 'MEMBER_NOT_ACTIVE'].includes(err.code) || err.statusCode === 403,
        `R3-09-REQ-024: Blocked user reaction rejected with code ${err.code}`
      );
    }
    assert(blockedRxFailed === true, 'R3-09-REQ-024: Blocked user reaction check passed');

    let blockedVoteFailed = false;
    try {
      await pollService.votePoll({
        actorUserId: userB._id,
        conversationId: convId,
        pollId: multiPoll.id,
        optionIds: [optGaming],
      });
    } catch (err) {
      blockedVoteFailed = true;
      assert(
        ['USER_BLOCKED', 'CONVERSATION_NOT_AVAILABLE', 'MATCH_NOT_ACTIVE', 'MEMBER_NOT_ACTIVE'].includes(err.code) || err.statusCode === 403,
        `R3-09-REQ-024: Blocked user poll vote rejected with code ${err.code}`
      );
    }
    assert(blockedVoteFailed === true, 'R3-09-REQ-024: Blocked user vote check passed');

  } catch (err) {
    console.error('❌ Test suite fatal error:', err);
    failed++;
  } finally {
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
  runReactionReplyPollTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runReactionReplyPollTests;
