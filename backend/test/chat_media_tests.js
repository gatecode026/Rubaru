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
const UploadSession = require('../models/UploadSession');
const MediaAsset = require('../models/MediaAsset');
const OutboxEvent = require('../models/OutboxEvent');

// Services
const conversationService = require('../services/conversationService');
const mediaService = require('../services/mediaService');
const mediaProcessor = require('../services/mediaProcessor');
const messageService = require('../services/messageService');
const storageProvider = require('../services/storage/storageProvider');
const socketHandler = require('../socket/socketHandler');
const SocketEvents = require('../socket/socketEvents');
const { dispatchOutboxMessageCreated } = require('../services/socketDispatchService');
const { mediaStateService, MediaProcessingStates } = require('../services/mediaStateService');

async function runChatMediaTests() {
  console.log('================================================================================');
  console.log('   RUBARU RESEARCH 3: CHAT MEDIA & VOICE ATTACHMENTS (R3-05 GAP CLOSURE)       ');
  console.log('================================================================================\n');

  await connectDB();
  await Conversation.init();
  await ConversationMember.init();
  await Message.init();
  await UploadSession.init();
  await MediaAsset.init();

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

  const TEST_PORT = 5098;
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
      phone: `+9199300${timestamp.toString().slice(-5)}1`,
      email: `gap_a_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenA = jwt.sign({ id: userA._id }, secret, { expiresIn: '1h' });

    const userB = await User.create({
      phone: `+9199300${timestamp.toString().slice(-5)}2`,
      email: `gap_b_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenB = jwt.sign({ id: userB._id }, secret, { expiresIn: '1h' });

    const userC = await User.create({
      phone: `+9199300${timestamp.toString().slice(-5)}3`,
      email: `gap_c_${timestamp}@test.com`,
      password: 'TestPassword123!',
      isPhoneVerified: true,
      isProfileComplete: true,
      accountStatus: 'ACTIVE',
    });
    const tokenC = jwt.sign({ id: userC._id }, secret, { expiresIn: '1h' });

    await DatingProfile.create({ user: userA._id, displayName: 'Alice Gap', dateOfBirth: dob, age: 24, gender: 'Female' });
    await DatingProfile.create({ user: userB._id, displayName: 'Bob Gap', dateOfBirth: dob, age: 26, gender: 'Male' });
    await DatingProfile.create({ user: userC._id, displayName: 'Charlie Gap', dateOfBirth: dob, age: 28, gender: 'Male' });

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

    // -------------------------------------------------------------------------
    // GAP 1: PROCESSING-STATE LIFECYCLE & TRANSITIONS (R3-05-GAP-001)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 1: Processing-State Lifecycle & Transitions ---');

    assert(mediaStateService.canTransition('AUTHORIZED', 'PENDING_UPLOAD'), 'R3-05-GAP-001: Authorized -> Pending Upload is valid');
    assert(mediaStateService.canTransition('VERIFYING', 'PROCESSING'), 'R3-05-GAP-001: Verifying -> Processing is valid');
    assert(mediaStateService.canTransition('PROCESSING', 'READY'), 'R3-05-GAP-001: Processing -> Ready is valid');
    assert(!mediaStateService.canTransition('READY', 'PENDING_UPLOAD'), 'R3-05-GAP-001: Ready -> Pending Upload backward transition is rejected');
    assert(!mediaStateService.canTransition('QUARANTINED', 'READY'), 'R3-05-GAP-001: Quarantined -> Ready transition is strictly rejected');
    assert(!mediaStateService.canTransition('REJECTED', 'READY'), 'R3-05-GAP-001: Rejected -> Ready transition is strictly rejected');

    // -------------------------------------------------------------------------
    // GAP 2: UPLOAD STATUS, RETRY & CANCELLATION CONTRACTS (R3-05-GAP-002)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 2: Upload Status, Retry & Cancellation Contracts ---');

    // Create session
    const statusTestSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'IMAGE',
      attachmentCategory: 'IMAGE',
      conversationId: convId,
      mimeType: 'image/jpeg',
      fileSize: 1024 * 1024,
      idempotencyKey: `idemp_status_${timestamp}`,
    });

    // 1. Get safe upload session status
    const sessionStatusResult = await mediaService.getUploadSessionStatus(userA._id, statusTestSession.sessionId);
    assert(sessionStatusResult && sessionStatusResult.sessionId === statusTestSession.sessionId, 'R3-05-GAP-002: Status contract returns session status');
    assert(!sessionStatusResult.objectKey && !sessionStatusResult.bucket, 'R3-05-GAP-002: Status contract sanitizes private object keys and bucket internals');

    // 2. Unauthorized user cannot get status
    let statusDeniedErr = null;
    try {
      await mediaService.getUploadSessionStatus(userC._id, statusTestSession.sessionId);
    } catch (err) {
      statusDeniedErr = err;
    }
    assert(statusDeniedErr && (statusDeniedErr.code === 'MEDIA_ACCESS_DENIED' || statusDeniedErr.statusCode === 403), 'R3-05-GAP-002: Non-owner cannot query session status');

    // 3. Retry upload session
    const retryResult = await mediaService.retryUploadSession(userA._id, statusTestSession.sessionId);
    assert(retryResult && retryResult.uploadTarget && retryResult.uploadTarget.uploadUrl, 'R3-05-GAP-002: Retry contract returns fresh upload instructions');

    // 4. Cancel upload session
    const cancelResult = await mediaService.cancelUploadSession(userA._id, statusTestSession.sessionId);
    assert(cancelResult && cancelResult.cancelled === true, 'R3-05-GAP-002: Cancel contract marks upload session cancelled');
    const cancelledAsset = await MediaAsset.findById(statusTestSession.mediaAssetId);
    assert(cancelledAsset.processingStatus === 'CANCELLED', 'R3-05-GAP-002: Cancelled session transitions MediaAsset to CANCELLED');

    // -------------------------------------------------------------------------
    // GAP 4, 5 & 6: PROBING, CODEC HANDLING & REAL WAVEFORMS (R3-05-GAP-004/005/006)
    // -------------------------------------------------------------------------
    console.log('\n--- GAPs 4, 5 & 6: Media Probing, Codecs & Decoded Waveforms ---');

    // Test real audio waveform extraction from actual decoded audio amplitudes
    const voiceSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'AUDIO',
      attachmentCategory: 'VOICE_NOTE',
      conversationId: convId,
      mimeType: 'audio/wav',
      fileSize: 44 + 8000,
      idempotencyKey: `idemp_voice_wave_${timestamp}`,
    });

    // Create valid RIFF WAVE buffer with modulated PCM wave data
    const waveHeader = Buffer.alloc(44);
    waveHeader.write('RIFF', 0);
    waveHeader.writeUInt32LE(44 + 8000 - 8, 4);
    waveHeader.write('WAVE', 8);
    waveHeader.write('fmt ', 12);
    waveHeader.writeUInt32LE(16, 16); // SubChunk1Size
    waveHeader.writeUInt16LE(1, 20);  // PCM format
    waveHeader.writeUInt16LE(1, 22);  // Mono
    waveHeader.writeUInt32LE(8000, 24); // SampleRate = 8000Hz
    waveHeader.writeUInt32LE(8000, 28); // ByteRate = 8000
    waveHeader.writeUInt16LE(1, 32);  // BlockAlign
    waveHeader.writeUInt16LE(8, 34);  // BitsPerSample = 8
    waveHeader.write('data', 36);
    waveHeader.writeUInt32LE(8000, 40); // 8000 bytes PCM data = 1 second

    const pcmData = Buffer.alloc(8000);
    for (let i = 0; i < 8000; i++) {
      pcmData[i] = Math.round(128 + 100 * Math.sin((i / 8000) * Math.PI * 8)); // 4Hz sine wave
    }
    const fullWaveBuffer = Buffer.concat([waveHeader, pcmData]);

    const voiceAsset = await MediaAsset.findById(voiceSession.mediaAssetId);
    await storageProvider.writeObject(voiceAsset.originalObjectKey, fullWaveBuffer, 'audio/wav');
    await mediaService.finalizeUploadSession(userA._id, voiceSession.sessionId);
    const procVoiceRes = await mediaProcessor.processAsset(voiceAsset._id);

    assert(procVoiceRes.success === true, 'R3-05-GAP-004: Audio processor probes duration and container');
    const readyVoiceAsset = await MediaAsset.findById(voiceAsset._id);
    assert(readyVoiceAsset.durationMs === 1000, 'R3-05-GAP-004: Exact duration parsed from WAV data chunk (1000ms)');
    assert(
      readyVoiceAsset.waveform &&
        readyVoiceAsset.waveform.peaks &&
        readyVoiceAsset.waveform.peaks.length === 50 &&
        readyVoiceAsset.waveform.peaks[0] >= 0.05 &&
        readyVoiceAsset.waveform.peaks[0] <= 0.98,
      'R3-05-GAP-006: Waveform envelope extracted from real PCM audio amplitude data (50 bounded peaks)'
    );

    // -------------------------------------------------------------------------
    // GAP 7: FAIL-CLOSED MALWARE & CONTENT MODERATION (R3-05-GAP-007)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 7: Fail-Closed Malware & Content Moderation ---');

    // 1. EICAR Malware Signature Detection
    const malwareSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'IMAGE',
      conversationId: convId,
      mimeType: 'image/jpeg',
      fileSize: 1024,
      idempotencyKey: `idemp_malware_${timestamp}`,
    });
    const malwareAsset = await MediaAsset.findById(malwareSession.mediaAssetId);
    const validJpegPrefix = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const eicarBuffer = Buffer.concat([validJpegPrefix, Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')]);
    await storageProvider.writeObject(malwareAsset.originalObjectKey, eicarBuffer, 'image/jpeg');
    await mediaService.finalizeUploadSession(userA._id, malwareSession.sessionId);
    const malwareProcRes = await mediaProcessor.processAsset(malwareAsset._id);

    assert(malwareProcRes.quarantined === true, 'R3-05-GAP-007: Malware signature quarantined by security screening');
    const quarantinedAssetDoc = await MediaAsset.findById(malwareAsset._id);
    assert(quarantinedAssetDoc.processingStatus === 'QUARANTINED', 'R3-05-GAP-007: MediaAsset transitioned to QUARANTINED');
    assert(quarantinedAssetDoc.safetyHold === true, 'R3-05-GAP-007: Quarantined asset marked safetyHold: true');

    // 2. Policy Moderation Rejection
    const modRejectSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'IMAGE',
      conversationId: convId,
      mimeType: 'image/jpeg',
      fileSize: 1024,
      idempotencyKey: `idemp_mod_rej_${timestamp}`,
    });
    const modAsset = await MediaAsset.findById(modRejectSession.mediaAssetId);
    const modRejBuffer = Buffer.concat([validJpegPrefix, Buffer.from('FORCE_MODERATION_REJECT_VIOLATION_PAYLOAD')]);
    await storageProvider.writeObject(modAsset.originalObjectKey, modRejBuffer, 'image/jpeg');
    await mediaService.finalizeUploadSession(userA._id, modRejectSession.sessionId);
    const modProcRes = await mediaProcessor.processAsset(modAsset._id);

    assert(modProcRes.rejected === true, 'R3-05-GAP-007: Content moderation screening flags and rejects violation');
    const rejectedAssetDoc = await MediaAsset.findById(modAsset._id);
    assert(rejectedAssetDoc.processingStatus === 'REJECTED', 'R3-05-GAP-007: MediaAsset transitioned to REJECTED');

    // 3. Scanner Timeout -> FAILED_RETRYABLE
    const timeoutSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'IMAGE',
      conversationId: convId,
      mimeType: 'image/jpeg',
      fileSize: 1024,
      idempotencyKey: `idemp_timeout_${timestamp}`,
    });
    const timeoutAsset = await MediaAsset.findById(timeoutSession.mediaAssetId);
    const timeoutBuffer = Buffer.concat([validJpegPrefix, Buffer.from('FORCE_SCANNER_TIMEOUT_SIMULATION')]);
    await storageProvider.writeObject(timeoutAsset.originalObjectKey, timeoutBuffer, 'image/jpeg');
    await mediaService.finalizeUploadSession(userA._id, timeoutSession.sessionId);
    const timeoutProcRes = await mediaProcessor.processAsset(timeoutAsset._id);

    assert(timeoutProcRes.isRetryable === true, 'R3-05-GAP-007: Scanner timeout marks asset as FAILED_RETRYABLE');
    const timeoutAssetDoc = await MediaAsset.findById(timeoutAsset._id);
    assert(timeoutAssetDoc.processingStatus === 'FAILED_RETRYABLE', 'R3-05-GAP-007: Transient timeout transitions to FAILED_RETRYABLE');

    // -------------------------------------------------------------------------
    // GAP 3: MESSAGE PERSISTENCE & ATOMIC RESERVATION (R3-05-GAP-003)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 3: Message Persistence & Atomic Reservation ---');

    // Create valid image asset
    const validImgSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'IMAGE',
      attachmentCategory: 'IMAGE',
      conversationId: convId,
      mimeType: 'image/jpeg',
      fileSize: 2048,
      idempotencyKey: `idemp_valid_img_${timestamp}`,
    });
    const validImgAsset = await MediaAsset.findById(validImgSession.mediaAssetId);
    const sampleJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    await storageProvider.writeObject(validImgAsset.originalObjectKey, sampleJpeg, 'image/jpeg');
    await mediaService.finalizeUploadSession(userA._id, validImgSession.sessionId);
    await mediaProcessor.processAsset(validImgAsset._id);

    const msgResult = await messageService.sendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      clientMessageId: `cmsg_gap3_${timestamp}`,
      text: 'Photo message',
      type: 'IMAGE',
      mediaAssetId: validImgAsset._id.toString(),
    });

    assert(msgResult && msgResult.message.type === 'IMAGE', 'R3-05-GAP-003: Message created with bound attachment');
    const consumedAsset = await MediaAsset.findById(validImgAsset._id);
    assert(consumedAsset.isConsumed === true && consumedAsset.consumedByMessageId.toString() === msgResult.message.id, 'R3-05-GAP-003: Asset bound to message atomically');

    // -------------------------------------------------------------------------
    // GAP 8: DELETION, UNSEND & ORPHAN CLEANUP (R3-05-GAP-008)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 8: Deletion, Unsend & Orphan Cleanup ---');

    // 1. Unsend Message Tombstone
    const unsendRes = await messageService.unsendMessage({
      actorUserId: userA._id.toString(),
      conversationId: convId,
      messageId: msgResult.message.id,
    });
    assert(unsendRes && unsendRes.success === true, 'R3-05-GAP-008: Sender unsends message successfully');
    const unsentMsgDoc = await Message.findById(msgResult.message.id);
    assert(unsentMsgDoc.status === 'DELETED', 'R3-05-GAP-008: Message status set to DELETED tombstone');

    // 2. Revocation of Delivery URL for unsent message attachment
    let unsentDeliveryErr = null;
    try {
      await mediaService.getMediaDeliveryAccess(userB._id, validImgAsset._id);
    } catch (err) {
      unsentDeliveryErr = err;
    }
    assert(unsentDeliveryErr && (unsentDeliveryErr.code === 'MESSAGE_UNSENT' || unsentDeliveryErr.statusCode === 404), 'R3-05-GAP-008: Delivery URL revoked for unsent message attachment');

    // -------------------------------------------------------------------------
    // GAP 9: STRENGTHENED AUTHORIZED DELIVERY (R3-05-GAP-009)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 9: Strengthened Authorized Delivery ---');

    // 1. Quarantined asset delivery denied
    let quarantinedDeliveryErr = null;
    try {
      await mediaService.getMediaDeliveryAccess(userA._id, malwareAsset._id);
    } catch (err) {
      quarantinedDeliveryErr = err;
    }
    assert(quarantinedDeliveryErr && quarantinedDeliveryErr.statusCode === 403, 'R3-05-GAP-009: Delivery access denied for quarantined media');

    // 2. Active member gets authorized delivery URL for valid voice note
    const voiceDeliveryRes = await mediaService.getMediaDeliveryAccess(userB._id, readyVoiceAsset._id);
    assert(voiceDeliveryRes && voiceDeliveryRes.url.includes('/uploads/media/'), 'R3-05-GAP-009: Active peer obtains authorized delivery URL for voice note');

    // 3. Orphan Cleanup Worker (Cleans unattached abandoned media)
    const orphanCleanResult = await mediaService.cleanupOrphanedMediaAssets({ retentionHours: 0 });
    assert(typeof orphanCleanResult.cleanedCount === 'number', 'R3-05-GAP-008: Orphan cleanup worker executes safely');

    // -------------------------------------------------------------------------
    // GAP 10: EXPANDED CONCURRENCY & RACE TESTS (R3-05-GAP-010)
    // -------------------------------------------------------------------------
    console.log('\n--- GAP 10: Expanded Concurrency & Race Tests ---');

    // 1. Simultaneous send race on single-use asset
    const raceSession = await mediaService.createUploadSession(userA._id, {
      purpose: 'CHAT_ATTACHMENT',
      mediaType: 'AUDIO',
      attachmentCategory: 'VOICE_NOTE',
      conversationId: convId,
      mimeType: 'audio/wav',
      fileSize: fullWaveBuffer.length,
      idempotencyKey: `idemp_race_c_${timestamp}`,
    });
    const raceAsset = await MediaAsset.findById(raceSession.mediaAssetId);
    await storageProvider.writeObject(raceAsset.originalObjectKey, fullWaveBuffer, 'audio/wav');
    await mediaService.finalizeUploadSession(userA._id, raceSession.sessionId);
    await mediaProcessor.processAsset(raceAsset._id);

    const [sendR1, sendR2] = await Promise.allSettled([
      messageService.sendMessage({
        actorUserId: userA._id.toString(),
        conversationId: convId,
        clientMessageId: `cmsg_conc_1_${timestamp}`,
        type: 'VOICE_NOTE',
        mediaAssetId: raceAsset._id.toString(),
      }),
      messageService.sendMessage({
        actorUserId: userA._id.toString(),
        conversationId: convId,
        clientMessageId: `cmsg_conc_2_${timestamp}`,
        type: 'VOICE_NOTE',
        mediaAssetId: raceAsset._id.toString(),
      }),
    ]);

    const concSuccess = [sendR1, sendR2].filter((r) => r.status === 'fulfilled').length;
    const concFailed = [sendR1, sendR2].filter((r) => r.status === 'rejected').length;
    assert(concSuccess === 1 && concFailed === 1, 'R3-05-GAP-010: Exactly 1 concurrent send binds asset, the other is rejected');

    // 2. Simultaneous createUploadSession with same idempotencyKey
    const parSessions = await Promise.all(
      Array.from({ length: 5 }, () =>
        mediaService.createUploadSession(userA._id, {
          purpose: 'CHAT_ATTACHMENT',
          mediaType: 'IMAGE',
          conversationId: convId,
          mimeType: 'image/jpeg',
          fileSize: 1024,
          idempotencyKey: `idemp_par_5_${timestamp}`,
        })
      )
    );
    const uniqueIds = new Set(parSessions.map((s) => s.sessionId));
    assert(uniqueIds.size === 1, 'R3-05-GAP-010: 5 concurrent upload sessions with same idempotencyKey resolve to single session');

    // 3. Outbox dispatch delivers versioned message.created with clean attachment metadata
    const clientB = await connectSocketClient(TEST_PORT, tokenB);
    if (clientB.socket) clientSocketsToClose.push(clientB.socket);

    const outboxPromise = new Promise((resolve) => {
      clientB.socket.once(SocketEvents.MESSAGE_CREATED, (event) => resolve(event));
    });

    await dispatchOutboxMessageCreated({
      conversationId: convId,
      messageId: msgResult.message.id,
      senderId: userA._id.toString(),
      clientMessageId: `cmsg_gap3_${timestamp}`,
      sequence: msgResult.message.sequence,
      type: 'IMAGE',
      text: 'Photo message',
      attachments: msgResult.message.attachments,
      createdAt: msgResult.message.createdAt,
    });

    const outboxReceived = await outboxPromise;
    assert(outboxReceived && outboxReceived.data.message.attachments.length === 1, 'R3-05-GAP-010: Outbox real-time dispatch transports attachment metadata safely');

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
  runChatMediaTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runChatMediaTests;
