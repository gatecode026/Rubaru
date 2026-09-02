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
const StoryView = require('../models/StoryView');
const OutboxEvent = require('../models/OutboxEvent');

// Services & Routes
const storyRoutes = require('../routes/storyRoutes');
const storyService = require('../services/storyService');

async function runStoryLifecycleTests() {
  console.log('===========================================================');
  console.log('      RUBARU STORIES & EPHEMERAL LIFECYCLE TESTS           ');
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
  app.use('/v1', storyRoutes);

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userAuthor = await User.create({ email: `story_author_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAuthor._id, displayName: 'Story Author', dateOfBirth: new Date('1997-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenAuthor = jwt.sign({ id: userAuthor._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthor = { Authorization: `Bearer ${tokenAuthor}`, 'Content-Type': 'application/json' };

    const userFollower = await User.create({ email: `story_follower_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userFollower._id, displayName: 'Story Follower', dateOfBirth: new Date('1998-02-02'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenFollower = jwt.sign({ id: userFollower._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersFollower = { Authorization: `Bearer ${tokenFollower}`, 'Content-Type': 'application/json' };

    const userStranger = await User.create({ email: `story_stranger_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userStranger._id, displayName: 'Story Stranger', dateOfBirth: new Date('1999-03-03'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenStranger = jwt.sign({ id: userStranger._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersStranger = { Authorization: `Bearer ${tokenStranger}`, 'Content-Type': 'application/json' };

    // Follower follows Author
    await FollowRelationship.create({ followerId: userFollower._id, followingId: userAuthor._id, status: 'ACCEPTED', acceptedAt: new Date() });

    // 2. Create Media Assets for Author
    const mediaImage = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'STORY_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/story1/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthor._id}/story1/med.webp`, mimeType: 'image/webp', width: 1080, height: 1920, url: 'https://cdn.rubaru.app/story1.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/story1/thumb.webp`, url: 'https://cdn.rubaru.app/story1_thumb.webp', width: 300, height: 300 },
    });

    const mediaVideo = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'STORY_MEDIA',
      mediaType: 'VIDEO',
      originalObjectKey: `media/test/${userAuthor._id}/story2/orig.mp4`,
      originalMimeType: 'video/mp4',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: '720p', objectKey: `media/test/${userAuthor._id}/story2/720p.mp4`, mimeType: 'video/mp4', width: 720, height: 1280, url: 'https://cdn.rubaru.app/story2.mp4' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/story2/thumb.webp`, url: 'https://cdn.rubaru.app/story2_thumb.webp', width: 300, height: 300 },
    });

    // -------------------------------------------------------------
    // 1. Story Creation & Timing Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Story Creation & Timing Tests ---');

    const createRes1 = await fetch(`${BASE_URL}/v1/stories`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        mediaAssetId: mediaImage._id.toString(),
        caption: 'My first image story!',
        audience: 'PUBLIC',
      }),
    });
    const createData1 = await createRes1.json();
    assert(createRes1.status === 201, 'POST /v1/stories returns 201 Created');
    assert(createData1.data.contentType === 'STORY', 'Content type is STORY');
    assert(createData1.data.mediaItems[0].mediaType === 'IMAGE', 'Media type is IMAGE');

    const story1Id = createData1.data.postId;
    const story1Doc = await Content.findById(story1Id);
    assert(story1Doc.sequencePosition === 0, 'First story assigned sequence position 0');
    assert(story1Doc.expiresAt !== null, 'Server-assigned expiresAt is set');

    const durationHrs = (new Date(story1Doc.expiresAt).getTime() - new Date(story1Doc.publishedAt).getTime()) / (1000 * 60 * 60);
    assert(Math.round(durationHrs) === 24, 'Story duration is exactly 24 hours');

    // Create 2nd story (video)
    const createRes2 = await fetch(`${BASE_URL}/v1/stories`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        mediaAssetId: mediaVideo._id.toString(),
        caption: 'My second video story!',
        audience: 'PUBLIC',
      }),
    });
    const createData2 = await createRes2.json();
    assert(createRes2.status === 201, 'POST /v1/stories returns 201 for video story');
    const story2Id = createData2.data.postId;
    const story2Doc = await Content.findById(story2Id);
    assert(story2Doc.sequencePosition === 1, 'Second story assigned sequence position 1');

    // -------------------------------------------------------------
    // 2. Story Tray & Unviewed Indicator Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Story Tray & Unviewed Tests ---');

    const trayRes1 = await fetch(`${BASE_URL}/v1/stories/feed`, { headers: authHeadersFollower });
    const trayData1 = await trayRes1.json();
    assert(trayRes1.status === 200, 'GET /v1/stories/feed returns 200 OK');
    assert(Array.isArray(trayData1.data.groups), 'Tray returns groups array');

    const authorGroup1 = trayData1.data.groups.find((g) => g.authorId === userAuthor._id.toString());
    assert(authorGroup1 !== undefined, 'Author group is present in follower tray');
    assert(authorGroup1.storyCount === 2, 'Author has 2 active stories');
    assert(authorGroup1.hasUnviewed === true, 'Author group is marked unviewed (hasUnviewed: true)');

    // -------------------------------------------------------------
    // 3. Story View Recording & Idempotency Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Story View Recording & Idempotency Tests ---');

    const viewRes1 = await fetch(`${BASE_URL}/v1/stories/${story1Id}/view`, {
      method: 'POST',
      headers: authHeadersFollower,
      body: JSON.stringify({ eventId: `view_ev_${timestamp}_1` }),
    });
    const viewData1 = await viewRes1.json();
    assert(viewRes1.status === 200, 'POST /v1/stories/:id/view returns 200 OK');
    assert(viewData1.data.isNewView === true, 'First view is marked isNewView: true');
    assert(viewData1.data.status === 'RECORDED', 'Status is RECORDED');

    // Verify Story viewsCount incremented
    const updatedStory1 = await Content.findById(story1Id);
    assert(updatedStory1.viewsCount === 1, 'Story viewsCount incremented to 1');

    // Duplicate View Submission
    const viewResDup = await fetch(`${BASE_URL}/v1/stories/${story1Id}/view`, {
      method: 'POST',
      headers: authHeadersFollower,
      body: JSON.stringify({ eventId: `view_ev_${timestamp}_1` }),
    });
    const viewDataDup = await viewResDup.json();
    assert(viewResDup.status === 200, 'Duplicate view returns 200 OK');
    assert(viewDataDup.data.isNewView === false, 'Duplicate view is marked isNewView: false');
    assert(viewDataDup.data.status === 'DUPLICATE', 'Status is DUPLICATE');

    const updatedStory1AfterDup = await Content.findById(story1Id);
    assert(updatedStory1AfterDup.viewsCount === 1, 'viewsCount remains 1 on duplicate view');

    // View Story 2
    await fetch(`${BASE_URL}/v1/stories/${story2Id}/view`, {
      method: 'POST',
      headers: authHeadersFollower,
      body: JSON.stringify({ eventId: `view_ev_${timestamp}_2` }),
    });

    // Check Tray again -> Both stories viewed -> hasUnviewed: false
    const trayRes2 = await fetch(`${BASE_URL}/v1/stories/feed`, { headers: authHeadersFollower });
    const trayData2 = await trayRes2.json();
    const authorGroup2 = trayData2.data.groups.find((g) => g.authorId === userAuthor._id.toString());
    assert(authorGroup2.hasUnviewed === false, 'Author group is now marked viewed (hasUnviewed: false)');

    // -------------------------------------------------------------
    // 4. Owner-Only Viewer List Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Owner-Only Viewer List Security Tests ---');

    // 4.1 Owner Accesses Viewer List
    const viewersResOwner = await fetch(`${BASE_URL}/v1/stories/${story1Id}/viewers`, { headers: authHeadersAuthor });
    const viewersDataOwner = await viewersResOwner.json();
    assert(viewersResOwner.status === 200, 'Story owner can retrieve viewer list (200 OK)');
    assert(viewersDataOwner.data.viewers.length === 1, 'Viewer list contains 1 viewer');
    assert(viewersDataOwner.data.viewers[0].displayName === 'Story Follower', 'Viewer display name matches follower');

    // 4.2 Non-Owner (Follower / Stranger) Access Attempt
    const viewersResStranger = await fetch(`${BASE_URL}/v1/stories/${story1Id}/viewers`, { headers: authHeadersStranger });
    const viewersDataStranger = await viewersResStranger.json();
    assert(viewersResStranger.status === 403, 'Non-owner viewer list access returns 403 Forbidden');
    assert(viewersDataStranger.code === 'VIEWER_LIST_PRIVATE', 'Returns VIEWER_LIST_PRIVATE error code');

    // -------------------------------------------------------------
    // 5. Expiry Enforcement & Background Expiry Worker Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Expiry Enforcement Tests ---');

    // Manually backdate Story 2 to expired state
    await Content.updateOne({ _id: story2Id }, { $set: { expiresAt: new Date(Date.now() - 5000) } });

    // Synchronous Read Check: Single Story GET should reject expired story
    const expiredRes = await fetch(`${BASE_URL}/v1/stories/${story2Id}`, { headers: authHeadersFollower });
    const expiredData = await expiredRes.json();
    assert(expiredRes.status === 404, 'Expired story returns 404 on direct read');
    assert(expiredData.code === 'STORY_EXPIRED', 'Returns STORY_EXPIRED code');

    // Tray check: Expired story is filtered out on read
    const trayRes3 = await fetch(`${BASE_URL}/v1/stories/feed`, { headers: authHeadersFollower });
    const trayData3 = await trayRes3.json();
    const authorGroup3 = trayData3.data.groups.find((g) => g.authorId === userAuthor._id.toString());
    assert(authorGroup3.storyCount === 1, 'Story count in tray reduced to 1 active story');

    // Run Expiry Worker Batch
    const expireResult = await storyService.expireStoriesBatch(10);
    assert(expireResult.expiredCount >= 1, 'Expiry worker transitioned expired stories');
    const expiredDoc = await Content.findById(story2Id);
    assert(expiredDoc.status === 'EXPIRED', 'Story document status is EXPIRED');

    // -------------------------------------------------------------
    // 6. Story Deletion Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Story Deletion Tests ---');

    // Unauthorized Delete Attempt
    const deleteResStranger = await fetch(`${BASE_URL}/v1/stories/${story1Id}`, {
      method: 'DELETE',
      headers: authHeadersStranger,
    });
    assert(deleteResStranger.status === 403, 'Stranger cannot delete author story (403)');

    // Owner Deletes Story
    const deleteResOwner = await fetch(`${BASE_URL}/v1/stories/${story1Id}`, {
      method: 'DELETE',
      headers: authHeadersAuthor,
    });
    assert(deleteResOwner.status === 200, 'Owner can delete story (200 OK)');

    const deletedDoc = await Content.findById(story1Id);
    assert(deletedDoc.status === 'DELETED', 'Story status set to DELETED');
    assert(deletedDoc.deletedAt !== null, 'deletedAt timestamp set');

    // Tray after all stories deleted/expired
    const trayRes4 = await fetch(`${BASE_URL}/v1/stories/feed`, { headers: authHeadersFollower });
    const trayData4 = await trayRes4.json();
    const authorGroup4 = trayData4.data.groups.find((g) => g.authorId === userAuthor._id.toString());
    assert(authorGroup4 === undefined, 'Author group removed from tray when no active stories remain');

    console.log('\n===========================================================');
    console.log(`STORY LIFECYCLE TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runStoryLifecycleTests();
}

module.exports = runStoryLifecycleTests;
