require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Content = require('../models/Content');
const MediaAsset = require('../models/MediaAsset');
const FollowRelationship = require('../models/FollowRelationship');
const FeedBatch = require('../models/FeedBatch');
const ContentImpression = require('../models/ContentImpression');
const OutboxEvent = require('../models/OutboxEvent');

// Services & Routes
const feedRoutes = require('../routes/feedRoutes');

async function runFeedImpressionTests() {
  console.log('===========================================================');
  console.log('      RUBARU FEED BATCHES & EXPOSURE ANALYTICS TESTS       ');
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
  app.use('/v1', feedRoutes);

  const TEST_PORT = 5099;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userViewer = await User.create({ email: `imp_viewer_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userViewer._id, displayName: 'Imp Viewer', dateOfBirth: new Date('1997-01-01'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenViewer = jwt.sign({ id: userViewer._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersViewer = { Authorization: `Bearer ${tokenViewer}`, 'Content-Type': 'application/json' };

    const userAuthor = await User.create({ email: `imp_author_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAuthor._id, displayName: 'Imp Author', dateOfBirth: new Date('1998-02-02'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });

    const userAttacker = await User.create({ email: `imp_attacker_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAttacker._id, displayName: 'Imp Attacker', dateOfBirth: new Date('1999-03-03'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenAttacker = jwt.sign({ id: userAttacker._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAttacker = { Authorization: `Bearer ${tokenAttacker}`, 'Content-Type': 'application/json' };

    // Viewer follows Author
    await FollowRelationship.create({ followerId: userViewer._id, followingId: userAuthor._id, status: 'ACCEPTED', acceptedAt: new Date() });

    // 2. Create Published Posts
    const media1 = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/imp1/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthor._id}/imp1/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/imp1.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/imp1/thumb.webp`, url: 'https://cdn.rubaru.app/imp1_thumb.webp', width: 300, height: 300 },
    });

    const post1 = await Content.create({
      authorId: userAuthor._id,
      contentType: 'POST',
      caption: 'Impression Post 1',
      mediaItems: [{ mediaAssetId: media1._id, position: 0, mediaType: 'IMAGE', variants: media1.variants, thumbnail: media1.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      publishedAt: new Date(Date.now() - 20000),
    });

    const post2 = await Content.create({
      authorId: userAuthor._id,
      contentType: 'POST',
      caption: 'Impression Post 2',
      mediaItems: [{ mediaAssetId: media1._id, position: 0, mediaType: 'IMAGE', variants: media1.variants, thumbnail: media1.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      publishedAt: new Date(Date.now() - 10000),
    });

    // -------------------------------------------------------------
    // 1. FeedBatch Creation & Response Verification
    // -------------------------------------------------------------
    console.log('\n--- 1. FeedBatch Creation & Response Tests ---');

    const feedRes = await fetch(`${BASE_URL}/v1/feed?limit=10`, { headers: authHeadersViewer });
    const feedData = await feedRes.json();
    assert(feedRes.status === 200, 'GET /v1/feed returns 200 OK');
    assert(typeof feedData.data.feed.batchId === 'string' && feedData.data.feed.batchId.startsWith('fbatch_'), 'Feed response includes valid batchId');
    assert(feedData.data.feed.surface === 'HOME_CONNECTED', 'Feed response includes surface: HOME_CONNECTED');

    const batchId = feedData.data.feed.batchId;

    // Verify batch persisted in database
    const batchDoc = await FeedBatch.findOne({ batchId });
    assert(batchDoc !== null, 'FeedBatch document is persisted in database');
    assert(batchDoc.viewerId.toString() === userViewer._id.toString(), 'FeedBatch belongs to authenticated viewer');
    assert(batchDoc.issuedItems.length === 2, 'FeedBatch contains 2 issued items');
    assert(batchDoc.issuedItems[0].position === 0, 'Issued item 0 has position 0');
    assert(batchDoc.issuedItems[1].position === 1, 'Issued item 1 has position 1');

    // Verify feed item position metadata
    assert(feedData.data.items[0].feedPosition === 0, 'Item 0 has feedPosition: 0');
    assert(feedData.data.items[1].feedPosition === 1, 'Item 1 has feedPosition: 1');

    const item0ContentId = feedData.data.items[0].postId;
    const item1ContentId = feedData.data.items[1].postId;

    // -------------------------------------------------------------
    // 2. Valid Batched Impression Ingestion Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Batched Impression Ingestion Tests ---');

    const ev1Id = `ev_test_${timestamp}_1`;
    const ev2Id = `ev_test_${timestamp}_2`;

    const impRes = await fetch(`${BASE_URL}/v1/feed/impressions`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: ev1Id,
            contentId: item0ContentId,
            position: 0,
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 2500,
          },
          {
            eventId: ev2Id,
            contentId: item1ContentId,
            position: 1,
            visiblePercentage: 80,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 4100,
          },
        ],
      }),
    });

    const impData = await impRes.json();
    assert(impRes.status === 200, 'POST /v1/feed/impressions returns 200 OK');
    assert(impData.data.accepted === 2, 'Accepted count is 2');
    assert(impData.data.duplicates === 0, 'Duplicates count is 0');
    assert(impData.data.rejected === 0, 'Rejected count is 0');

    // Verify impressions in DB
    const savedImp1 = await ContentImpression.findOne({ eventId: ev1Id });
    assert(savedImp1 !== null, 'Impression 1 persisted in database');
    assert(savedImp1.dwellTimeMs === 2500, 'Dwell time persisted accurately (2500ms)');
    assert(savedImp1.authorId.toString() === userAuthor._id.toString(), 'Author ID resolved accurately');
    assert(savedImp1.position === 0, 'Position recorded accurately (0)');

    // Verify outbox event emitted
    const outboxImp = await OutboxEvent.findOne({ eventType: 'content.impression_recorded', 'payload.eventId': ev1Id });
    assert(outboxImp !== null, 'content.impression_recorded outbox event is emitted');

    // -------------------------------------------------------------
    // 3. Idempotency & Duplicate Replay Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Idempotency & Duplicate Replay Tests ---');

    const dupRes = await fetch(`${BASE_URL}/v1/feed/impressions`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: ev1Id, // Duplicate
            contentId: item0ContentId,
            position: 0,
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 2500,
          },
        ],
      }),
    });

    const dupData = await dupRes.json();
    assert(dupRes.status === 200, 'Duplicate submission returns 200 OK');
    assert(dupData.data.accepted === 0, 'Accepted count is 0 for duplicate');
    assert(dupData.data.duplicates === 1, 'Duplicates count is 1');
    assert(dupData.data.rejected === 0, 'Rejected count is 0');

    // -------------------------------------------------------------
    // 4. Security & Anti-Abuse Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Security & Anti-Abuse Tests ---');

    // 4.1 Cross-User Batch Hijack Attempt (Attacker submits for Viewer's batchId)
    const hijackRes = await fetch(`${BASE_URL}/v1/feed/impressions`, {
      method: 'POST',
      headers: authHeadersAttacker,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: `ev_hijack_${timestamp}`,
            contentId: item0ContentId,
            position: 0,
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 1500,
          },
        ],
      }),
    });
    const hijackData = await hijackRes.json();
    assert(hijackRes.status === 403, 'Cross-user batch submission returns 403 Forbidden');
    assert(hijackData.code === 'BATCH_OWNERSHIP_INVALID', 'Returns BATCH_OWNERSHIP_INVALID code');

    // 4.2 Position Mismatch (Item 0 submitted with Position 1)
    const mismatchRes = await fetch(`${BASE_URL}/v1/feed/impressions`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: `ev_mismatch_${timestamp}`,
            contentId: item0ContentId,
            position: 99, // Wrong position
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 1500,
          },
        ],
      }),
    });
    const mismatchData = await mismatchRes.json();
    assert(mismatchRes.status === 200, 'Position mismatch request returns 200 OK');
    assert(mismatchData.data.rejected === 1, 'Event with wrong position is rejected');

    // 4.3 Low Visibility Percentage (< 50%)
    const lowVisRes = await fetch(`${BASE_URL}/v1/feed/impressions`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: `ev_low_vis_${timestamp}`,
            contentId: item0ContentId,
            position: 0,
            visiblePercentage: 30, // < 50%
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 1500,
          },
        ],
      }),
    });
    const lowVisData = await lowVisRes.json();
    assert(lowVisData.data.rejected === 1, 'Event with < 50% visibility is rejected');

    // 4.4 Partial Batch Resilience (1 Valid + 1 Duplicate + 1 Invalid Position)
    const evValid3 = `ev_valid_${timestamp}_3`;
    const mixedRes = await fetch(`${BASE_URL}/v1/feed/impressions`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: evValid3, // Valid
            contentId: item1ContentId,
            position: 1,
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 1200,
          },
          {
            eventId: ev1Id, // Duplicate
            contentId: item0ContentId,
            position: 0,
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 2500,
          },
          {
            eventId: `ev_bad_pos_${timestamp}`, // Invalid position
            contentId: item0ContentId,
            position: 88,
            visiblePercentage: 100,
            qualifiedAt: new Date().toISOString(),
            dwellTimeMs: 1200,
          },
        ],
      }),
    });
    const mixedData = await mixedRes.json();
    assert(mixedData.data.accepted === 1, 'Mixed batch accepts 1 valid event');
    assert(mixedData.data.duplicates === 1, 'Mixed batch flags 1 duplicate event');
    assert(mixedData.data.rejected === 1, 'Mixed batch flags 1 rejected event');

    console.log('\n===========================================================');
    console.log(`FEED IMPRESSION TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runFeedImpressionTests();
}

module.exports = runFeedImpressionTests;
