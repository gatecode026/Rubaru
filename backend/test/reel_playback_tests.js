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
const Block = require('../models/Block');
const FeedBatch = require('../models/FeedBatch');
const ReelPlaybackEvent = require('../models/ReelPlaybackEvent');
const OutboxEvent = require('../models/OutboxEvent');

// Services & Routes
const reelRoutes = require('../routes/reelRoutes');
const interactionRoutes = require('../routes/interactionRoutes');

async function runReelPlaybackTests() {
  console.log('===========================================================');
  console.log('      RUBARU REELS PUBLICATION & PLAYBACK TESTS            ');
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
  app.use('/v1', reelRoutes);
  app.use('/v1', interactionRoutes);

  const TEST_PORT = 5097;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userAuthor = await User.create({ email: `reel_author_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAuthor._id, displayName: 'Reel Creator', dateOfBirth: new Date('1997-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenAuthor = jwt.sign({ id: userAuthor._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthor = { Authorization: `Bearer ${tokenAuthor}`, 'Content-Type': 'application/json' };

    const userFollower = await User.create({ email: `reel_follower_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userFollower._id, displayName: 'Reel Follower', dateOfBirth: new Date('1998-02-02'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenFollower = jwt.sign({ id: userFollower._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersFollower = { Authorization: `Bearer ${tokenFollower}`, 'Content-Type': 'application/json' };

    const userAttacker = await User.create({ email: `reel_attacker_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAttacker._id, displayName: 'Reel Attacker', dateOfBirth: new Date('1999-03-03'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenAttacker = jwt.sign({ id: userAttacker._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAttacker = { Authorization: `Bearer ${tokenAttacker}`, 'Content-Type': 'application/json' };

    // Follower follows Author
    await FollowRelationship.create({ followerId: userFollower._id, followingId: userAuthor._id, status: 'ACCEPTED', acceptedAt: new Date() });

    // 2. Create Media Assets
    const mediaVideo1 = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'VIDEO',
      originalObjectKey: `media/test/${userAuthor._id}/reel1/orig.mp4`,
      originalMimeType: 'video/mp4',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      durationMs: 30000, // 30 seconds
      width: 1080,
      height: 1920,
      variants: [{ name: '720p', objectKey: `media/test/${userAuthor._id}/reel1/720p.mp4`, mimeType: 'video/mp4', width: 720, height: 1280, url: 'https://cdn.rubaru.app/reel1_720.mp4' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/reel1/thumb.webp`, url: 'https://cdn.rubaru.app/reel1_thumb.webp', width: 300, height: 533 },
    });

    const mediaVideo2 = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'VIDEO',
      originalObjectKey: `media/test/${userAuthor._id}/reel2/orig.mp4`,
      originalMimeType: 'video/mp4',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      durationMs: 45000, // 45 seconds
      width: 1080,
      height: 1920,
      variants: [{ name: '720p', objectKey: `media/test/${userAuthor._id}/reel2/720p.mp4`, mimeType: 'video/mp4', width: 720, height: 1280, url: 'https://cdn.rubaru.app/reel2_720.mp4' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/reel2/thumb.webp`, url: 'https://cdn.rubaru.app/reel2_thumb.webp', width: 300, height: 533 },
    });

    const mediaImage = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/img/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthor._id}/img/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/img.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/img/thumb.webp`, url: 'https://cdn.rubaru.app/img_thumb.webp', width: 300, height: 300 },
    });

    // -------------------------------------------------------------
    // 1. Reel Creation & Validation Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Reel Creation & Validation Tests ---');

    // 1.1 Valid Reel Creation
    const createRes1 = await fetch(`${BASE_URL}/v1/reels`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        videoMediaAssetId: mediaVideo1._id.toString(),
        caption: 'My first short reel video! #vibes',
        audience: 'PUBLIC',
      }),
    });
    const createData1 = await createRes1.json();
    assert(createRes1.status === 201, 'POST /v1/reels returns 201 Created');
    assert(createData1.data.contentType === 'REEL', 'Content type is REEL');
    assert(createData1.data.durationMs === 30000, 'Reel duration is 30000ms');

    const reel1Id = createData1.data.postId;

    // 1.2 Invalid Media Type (Attempt to create Reel with Image)
    const badMediaRes = await fetch(`${BASE_URL}/v1/reels`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        videoMediaAssetId: mediaImage._id.toString(),
        caption: 'Image reel fail',
      }),
    });
    assert(badMediaRes.status === 400, 'Reject Reel created with IMAGE media asset (400)');

    // 1.3 Create 2nd Reel
    const createRes2 = await fetch(`${BASE_URL}/v1/reels`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        videoMediaAssetId: mediaVideo2._id.toString(),
        caption: 'Second dance reel #dance',
        audience: 'PUBLIC',
      }),
    });
    const createData2 = await createRes2.json();
    assert(createRes2.status === 201, 'POST /v1/reels returns 201 for second reel');
    const reel2Id = createData2.data.postId;

    // -------------------------------------------------------------
    // 2. Connected Chronological Reels Feed Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Connected Reels Feed Tests ---');

    const feedRes = await fetch(`${BASE_URL}/v1/reels/feed?limit=10`, { headers: authHeadersFollower });
    const feedData = await feedRes.json();
    assert(feedRes.status === 200, 'GET /v1/reels/feed returns 200 OK');
    assert(feedData.data.feed.surface === 'REELS_CONNECTED', 'Feed surface is REELS_CONNECTED');
    assert(feedData.data.feed.orderingVersion === 'connected_reels_chronological_v1', 'Ordering version is chronological v1');
    assert(feedData.data.items.length === 2, 'Feed returns 2 reels');
    assert(feedData.data.items[0].reelPosition === 0, 'First reel has position 0');
    assert(feedData.data.items[1].reelPosition === 1, 'Second reel has position 1');

    const batchId = feedData.data.feed.batchId;
    assert(typeof batchId === 'string' && batchId.startsWith('rbatch_'), 'Feed returns valid batchId');

    // Verify batch record in DB
    const batchDoc = await FeedBatch.findOne({ batchId });
    assert(batchDoc !== null, 'FeedBatch persisted in database');
    assert(batchDoc.issuedItems.length === 2, 'Batch contains 2 issued items');

    // -------------------------------------------------------------
    // 3. Batched Playback Event Ingestion Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Playback Ingestion Tests ---');

    const evStartId = `ev_play_start_${timestamp}`;
    const evSummaryId = `ev_play_sum_${timestamp}`;

    const playRes = await fetch(`${BASE_URL}/v1/reels/playback-events`, {
      method: 'POST',
      headers: authHeadersFollower,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: evStartId,
            reelId: reel2Id,
            position: 0,
            playbackSessionId: `session_${timestamp}`,
            eventType: 'PLAY_STARTED',
            watchedMs: 1000,
            maxPositionMs: 1000,
          },
          {
            eventId: evSummaryId,
            reelId: reel2Id,
            position: 0,
            playbackSessionId: `session_${timestamp}`,
            eventType: 'PLAY_SUMMARY',
            watchedMs: 44000,
            maxPositionMs: 44000, // 44s / 45s = 97% -> Completed!
          },
        ],
      }),
    });

    const playData = await playRes.json();
    assert(playRes.status === 200, 'POST /v1/reels/playback-events returns 200 OK');
    assert(playData.data.accepted === 2, 'Accepted 2 playback events');
    assert(playData.data.duplicates === 0, 'Duplicates count is 0');
    assert(playData.data.rejected === 0, 'Rejected count is 0');

    // Verify completed status persisted
    const savedEvent = await ReelPlaybackEvent.findOne({ eventId: evSummaryId });
    assert(savedEvent !== null, 'Playback summary event persisted');
    assert(savedEvent.completed === true, 'Event marked completed (completionPercentage >= 95%)');
    assert(savedEvent.completionPercentage >= 95, 'Completion percentage >= 95%');

    // Verify Reel playCount incremented
    const updatedReel2 = await Content.findById(reel2Id);
    assert(updatedReel2.playCount >= 1, 'Reel playCount incremented');

    // 3.2 Idempotent Duplicate Event Ingestion
    const dupPlayRes = await fetch(`${BASE_URL}/v1/reels/playback-events`, {
      method: 'POST',
      headers: authHeadersFollower,
      body: JSON.stringify({
        batchId,
        events: [
          {
            eventId: evSummaryId, // Duplicate
            reelId: reel2Id,
            position: 0,
            watchedMs: 44000,
          },
        ],
      }),
    });
    const dupPlayData = await dupPlayRes.json();
    assert(dupPlayRes.status === 200, 'Duplicate playback event returns 200 OK');
    assert(dupPlayData.data.accepted === 0, 'Accepted count is 0 for duplicate');
    assert(dupPlayData.data.duplicates === 1, 'Duplicates count is 1');

    // 3.3 Security Check: Cross-User Batch Hijack Attempt
    const hijackRes = await fetch(`${BASE_URL}/v1/reels/playback-events`, {
      method: 'POST',
      headers: authHeadersAttacker,
      body: JSON.stringify({
        batchId,
        events: [{ eventId: `ev_hijack_${timestamp}`, reelId: reel2Id, position: 0, watchedMs: 1000 }],
      }),
    });
    assert(hijackRes.status === 403, 'Cross-user batch submission rejected with 403 Forbidden');

    // -------------------------------------------------------------
    // 4. Prompt 6 Interaction Reuse on Reels
    // -------------------------------------------------------------
    console.log('\n--- 4. Interaction Reuse Tests ---');

    const likeRes = await fetch(`${BASE_URL}/v1/content/${reel1Id}/like`, {
      method: 'POST',
      headers: authHeadersFollower,
    });
    const likeData = await likeRes.json();
    assert(likeRes.status === 200, 'Like interaction on Reel returns 200 OK');
    assert(likeData.data.liked === true, 'Reel liked set to true');

    const saveRes = await fetch(`${BASE_URL}/v1/content/${reel1Id}/save`, {
      method: 'POST',
      headers: authHeadersFollower,
    });
    const saveData = await saveRes.json();
    assert(saveRes.status === 200, 'Save interaction on Reel returns 200 OK');
    assert(saveData.data.saved === true, 'Reel saved set to true');

    // -------------------------------------------------------------
    // 5. Archive & Deletion Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Archive & Deletion Tests ---');

    // Archive Reel 1
    const archiveRes = await fetch(`${BASE_URL}/v1/reels/${reel1Id}/archive`, {
      method: 'POST',
      headers: authHeadersAuthor,
    });
    assert(archiveRes.status === 200, 'Owner can archive Reel (200 OK)');
    const archivedDoc = await Content.findById(reel1Id);
    assert(archivedDoc.status === 'ARCHIVED', 'Reel status is ARCHIVED');

    // Unarchive Reel 1
    const unarchiveRes = await fetch(`${BASE_URL}/v1/reels/${reel1Id}/unarchive`, {
      method: 'POST',
      headers: authHeadersAuthor,
    });
    assert(unarchiveRes.status === 200, 'Owner can unarchive Reel (200 OK)');
    const restoredDoc = await Content.findById(reel1Id);
    assert(restoredDoc.status === 'PUBLISHED', 'Reel status restored to PUBLISHED');

    // Owner Deletes Reel 2
    const deleteRes = await fetch(`${BASE_URL}/v1/reels/${reel2Id}`, {
      method: 'DELETE',
      headers: authHeadersAuthor,
    });
    assert(deleteRes.status === 200, 'Owner can delete Reel (200 OK)');
    const deletedDoc = await Content.findById(reel2Id);
    assert(deletedDoc.status === 'DELETED', 'Reel status is DELETED');

    console.log('\n===========================================================');
    console.log(`REEL PLAYBACK TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runReelPlaybackTests();
}

module.exports = runReelPlaybackTests;
