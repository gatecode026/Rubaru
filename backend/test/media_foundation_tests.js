require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const UploadSession = require('../models/UploadSession');
const MediaAsset = require('../models/MediaAsset');
const OutboxEvent = require('../models/OutboxEvent');

// Services & Routes
const mediaService = require('../services/mediaService');
const storageProvider = require('../services/storage/storageProvider');
const mediaProcessor = require('../services/mediaProcessor');
const mediaRoutes = require('../routes/mediaRoutes');

async function runMediaFoundationTests() {
  console.log('===========================================================');
  console.log('       RUBARU MEDIA FOUNDATION INTEGRATION TEST SUITE      ');
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

  // Setup Test Server
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/v1/media', mediaRoutes);

  const TEST_PORT = 5096;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userOwner = await User.create({
      email: `media_owner_${timestamp}@rubaru.app`,
      password: 'pw',
      isActive: true,
      accountStatus: 'ACTIVE',
    });
    const tokenOwner = jwt.sign({ id: userOwner._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersOwner = {
      Authorization: `Bearer ${tokenOwner}`,
      'Content-Type': 'application/json',
    };

    const userAttacker = await User.create({
      email: `media_att_${timestamp}@rubaru.app`,
      password: 'pw',
      isActive: true,
      accountStatus: 'ACTIVE',
    });
    const tokenAttacker = jwt.sign({ id: userAttacker._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAttacker = {
      Authorization: `Bearer ${tokenAttacker}`,
      'Content-Type': 'application/json',
    };

    // -------------------------------------------------------------
    // 1. Model & Schema Validation Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Model & Schema Validation Tests ---');

    const validSession = new UploadSession({
      ownerId: userOwner._id,
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      declaredMimeType: 'image/jpeg',
      declaredFileSize: 102400,
      objectKey: `media/test/${userOwner._id}/asset1/original/test1.jpg`,
      status: 'AUTHORIZED',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      idempotencyKey: `idemp_${timestamp}_1`,
    });
    await validSession.validate();
    assert(true, 'Valid UploadSession passes Mongoose schema validation');

    const validAsset = new MediaAsset({
      ownerId: userOwner._id,
      uploadSessionId: validSession._id,
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: validSession.objectKey,
      originalMimeType: 'image/jpeg',
      processingStatus: 'PENDING_UPLOAD',
      moderationStatus: 'NOT_STARTED',
    });
    await validAsset.validate();
    assert(true, 'Valid MediaAsset passes Mongoose schema validation');

    // -------------------------------------------------------------
    // 2. Upload Session Creation & Validation Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Upload Session API & Validation Tests ---');

    // 2.1 Unauthenticated request returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/media/upload-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'POST_MEDIA', mediaType: 'IMAGE' }),
    });
    assert(unauthRes.status === 401, 'Unauthenticated POST /v1/media/upload-sessions returns 401');

    // 2.2 Unsupported MIME type is rejected (400)
    const invalidMimeRes = await fetch(`${BASE_URL}/v1/media/upload-sessions`, {
      method: 'POST',
      headers: authHeadersOwner,
      body: JSON.stringify({
        purpose: 'POST_MEDIA',
        mediaType: 'IMAGE',
        mimeType: 'application/x-executable',
        fileSize: 1024,
        idempotencyKey: `idemp_bad_mime_${timestamp}`,
      }),
    });
    const invalidMimeData = await invalidMimeRes.json();
    assert(invalidMimeRes.status === 400, 'Unsupported MIME type returns 400 Bad Request');
    assert(invalidMimeData.code === 'UNSUPPORTED_MIME_TYPE', 'Returns UNSUPPORTED_MIME_TYPE code');

    // 2.3 Oversized image file is rejected (400)
    const oversizedRes = await fetch(`${BASE_URL}/v1/media/upload-sessions`, {
      method: 'POST',
      headers: authHeadersOwner,
      body: JSON.stringify({
        purpose: 'POST_MEDIA',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        fileSize: 50 * 1024 * 1024, // 50MB > 15MB limit
        idempotencyKey: `idemp_oversized_${timestamp}`,
      }),
    });
    const oversizedData = await oversizedRes.json();
    assert(oversizedRes.status === 400, 'Oversized file returns 400 Bad Request');
    assert(oversizedData.code === 'FILE_SIZE_EXCEEDS_LIMIT', 'Returns FILE_SIZE_EXCEEDS_LIMIT code');

    // 2.4 Valid session creation (201 Created)
    const validSessionRes = await fetch(`${BASE_URL}/v1/media/upload-sessions`, {
      method: 'POST',
      headers: authHeadersOwner,
      body: JSON.stringify({
        purpose: 'POST_MEDIA',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        fileSize: 250000,
        idempotencyKey: `idemp_valid_${timestamp}`,
      }),
    });
    const validSessionData = await validSessionRes.json();
    assert(validSessionRes.status === 201, 'Valid upload session returns 201 Created');
    assert(validSessionData.success === true, 'Response contains success: true');
    assert(typeof validSessionData.data.sessionId === 'string', 'Returns generated sessionId');
    assert(typeof validSessionData.data.mediaAssetId === 'string', 'Returns generated mediaAssetId');
    assert(typeof validSessionData.data.uploadTarget.uploadUrl === 'string', 'Returns safe scoped uploadUrl');

    const createdSessionId = validSessionData.data.sessionId;
    const createdMediaAssetId = validSessionData.data.mediaAssetId;
    const createdUploadUrl = validSessionData.data.uploadTarget.uploadUrl;
    const createdObjectKey = validSessionData.data.uploadTarget.objectKey;

    // 2.5 Idempotent retry returns same session
    const idempRetryRes = await fetch(`${BASE_URL}/v1/media/upload-sessions`, {
      method: 'POST',
      headers: authHeadersOwner,
      body: JSON.stringify({
        purpose: 'POST_MEDIA',
        mediaType: 'IMAGE',
        mimeType: 'image/jpeg',
        fileSize: 250000,
        idempotencyKey: `idemp_valid_${timestamp}`,
      }),
    });
    const idempRetryData = await idempRetryRes.json();
    assert(idempRetryData.data.sessionId === createdSessionId, 'Idempotent request returns identical sessionId');

    // -------------------------------------------------------------
    // 3. Direct Upload & Object Inspection Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Direct Upload & Object Storage Tests ---');

    // Create a mock valid JPEG buffer (starts with FF D8 FF)
    const mockJpegBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
      Buffer.alloc(2048, 0xaa),
    ]);

    const uploadRes = await fetch(`${BASE_URL}${createdUploadUrl}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: mockJpegBuffer,
    });
    assert(uploadRes.status === 200, 'Direct upload to scoped URL returns 200 OK');

    const inspection = await storageProvider.inspectObject(createdObjectKey);
    assert(inspection.exists === true, 'Storage provider confirms object exists');
    assert(inspection.mimeType === 'image/jpeg', 'Storage provider byte inspection accurately identifies image/jpeg');
    assert(inspection.sizeBytes === mockJpegBuffer.length, 'Stored file size exactly matches uploaded bytes');

    // -------------------------------------------------------------
    // 4. Finalization, Verification & IDOR Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Finalization & IDOR Security Tests ---');

    // 4.1 Attacker attempting to finalize Owner's session is rejected (403)
    const attackerFinalizeRes = await fetch(`${BASE_URL}/v1/media/upload-sessions/${createdSessionId}/finalize`, {
      method: 'POST',
      headers: authHeadersAttacker,
      body: JSON.stringify({}),
    });
    const attackerFinalizeData = await attackerFinalizeRes.json();
    assert(attackerFinalizeRes.status === 403, 'Attacker finalize returns 403 Forbidden');
    assert(attackerFinalizeData.code === 'MEDIA_ACCESS_DENIED', 'Returns MEDIA_ACCESS_DENIED code');

    // 4.2 Owner finalizes successfully
    const ownerFinalizeRes = await fetch(`${BASE_URL}/v1/media/upload-sessions/${createdSessionId}/finalize`, {
      method: 'POST',
      headers: authHeadersOwner,
      body: JSON.stringify({}),
    });
    const ownerFinalizeData = await ownerFinalizeRes.json();
    assert(ownerFinalizeRes.status === 200, 'Owner finalize returns 200 OK');
    assert(ownerFinalizeData.data.status === 'FINALIZED', 'Session status transitioned to FINALIZED');

    // 4.3 Repeated finalization is idempotent
    const repeatFinalizeRes = await fetch(`${BASE_URL}/v1/media/upload-sessions/${createdSessionId}/finalize`, {
      method: 'POST',
      headers: authHeadersOwner,
      body: JSON.stringify({}),
    });
    assert(repeatFinalizeRes.status === 200, 'Repeated finalize request is safely idempotent (200 OK)');

    // -------------------------------------------------------------
    // 5. Media Processor & Status Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Media Processing & Status Tests ---');

    // Wait 200ms for async processor
    await new Promise((r) => setTimeout(r, 200));

    // 5.1 Attacker accessing media status returns 403
    const attackerStatusRes = await fetch(`${BASE_URL}/v1/media/${createdMediaAssetId}/status`, {
      headers: authHeadersAttacker,
    });
    assert(attackerStatusRes.status === 403, 'Attacker accessing media status returns 403 Forbidden');

    // 5.2 Owner accessing media status returns 200 OK
    const ownerStatusRes = await fetch(`${BASE_URL}/v1/media/${createdMediaAssetId}/status`, {
      headers: authHeadersOwner,
    });
    const ownerStatusData = await ownerStatusRes.json();
    assert(ownerStatusRes.status === 200, 'Owner accessing media status returns 200 OK');
    assert(ownerStatusData.data.processingStatus === 'READY', 'Media asset processingStatus is READY');
    assert(Array.isArray(ownerStatusData.data.variants) && ownerStatusData.data.variants.length > 0, 'Media variants generated');
    assert(typeof ownerStatusData.data.thumbnail.url === 'string', 'Safe thumbnail URL generated');

    // -------------------------------------------------------------
    // 6. Media Deletion & Lifecycle Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Media Deletion & Lifecycle Tests ---');

    // 6.1 Attacker deleting media returns 403
    const attackerDeleteRes = await fetch(`${BASE_URL}/v1/media/${createdMediaAssetId}`, {
      method: 'DELETE',
      headers: authHeadersAttacker,
    });
    assert(attackerDeleteRes.status === 403, 'Attacker deleting media returns 403 Forbidden');

    // 6.2 Owner deletes media returns 200
    const ownerDeleteRes = await fetch(`${BASE_URL}/v1/media/${createdMediaAssetId}`, {
      method: 'DELETE',
      headers: authHeadersOwner,
    });
    const ownerDeleteData = await ownerDeleteRes.json();
    assert(ownerDeleteRes.status === 200, 'Owner deleting media returns 200 OK');
    assert(ownerDeleteData.data.deleted === true, 'Response confirms deleted: true');

    const deletedAsset = await MediaAsset.findById(createdMediaAssetId);
    assert(deletedAsset.processingStatus === 'DELETED', 'MediaAsset state updated to DELETED');
    assert(deletedAsset.deletedAt !== null, 'MediaAsset deletedAt timestamp recorded');

    // 6.3 Cleanup function runs safely
    const cleanupResult = await mediaService.cleanupExpiredUploadSessions();
    assert(typeof cleanupResult.cleanedCount === 'number', 'cleanupExpiredUploadSessions executes without errors');

    console.log('\n===========================================================');
    console.log(`MEDIA FOUNDATION TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runMediaFoundationTests();
}

module.exports = runMediaFoundationTests;
