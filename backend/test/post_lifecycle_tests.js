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
const UploadSession = require('../models/UploadSession');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');

// Services & Routes
const postService = require('../services/postService');
const safetyService = require('../services/safetyService');
const postRoutes = require('../routes/postRoutes');
const followRoutes = require('../routes/followRoutes');

async function runPostLifecycleTests() {
  console.log('===========================================================');
  console.log('         RUBARU POST & CONTENT LIFECYCLE TEST SUITE        ');
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
  app.use('/v1', postRoutes);
  app.use('/v1', followRoutes);

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userAuthor = await User.create({ email: `author_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileAuthor = await Profile.create({ user: userAuthor._id, displayName: 'Author User', dateOfBirth: new Date('1997-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenAuthor = jwt.sign({ id: userAuthor._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthor = { Authorization: `Bearer ${tokenAuthor}`, 'Content-Type': 'application/json' };

    const userFollower = await User.create({ email: `follower_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileFollower = await Profile.create({ user: userFollower._id, displayName: 'Follower User', dateOfBirth: new Date('1999-03-03'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenFollower = jwt.sign({ id: userFollower._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersFollower = { Authorization: `Bearer ${tokenFollower}`, 'Content-Type': 'application/json' };

    const userStranger = await User.create({ email: `stranger_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileStranger = await Profile.create({ user: userStranger._id, displayName: 'Stranger User', dateOfBirth: new Date('2001-07-07'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenStranger = jwt.sign({ id: userStranger._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersStranger = { Authorization: `Bearer ${tokenStranger}`, 'Content-Type': 'application/json' };

    // Establish Follow Relationship: Follower -> Author (ACCEPTED)
    await FollowRelationship.create({
      followerId: userFollower._id,
      followingId: userAuthor._id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    });

    // 2. Create Ready Media Assets for Author
    const mediaAsset1 = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/asset1/original/img1.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      width: 1080,
      height: 1350,
      variants: [{ name: 'medium', objectKey: 'media/test/asset1/v/medium.webp', mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/asset1_med.webp' }],
      thumbnail: { url: 'https://cdn.rubaru.app/asset1_thumb.webp', width: 300, height: 300 },
    });

    const mediaAsset2 = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/asset2/original/img2.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      width: 1080,
      height: 1080,
      variants: [{ name: 'medium', objectKey: 'media/test/asset2/v/medium.webp', mimeType: 'image/webp', width: 1080, height: 1080, url: 'https://cdn.rubaru.app/asset2_med.webp' }],
      thumbnail: { url: 'https://cdn.rubaru.app/asset2_thumb.webp', width: 300, height: 300 },
    });

    // Media asset owned by Stranger
    const strangerMedia = await MediaAsset.create({
      ownerId: userStranger._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userStranger._id}/stranger_asset/original/img.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
    });

    // Non-ready media asset
    const pendingMedia = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/pending_asset/original/img.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'PENDING_UPLOAD',
    });

    // -------------------------------------------------------------
    // 1. Model Level Validation Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Model Level Validation Tests ---');

    const validContent = new Content({
      authorId: userAuthor._id,
      contentType: 'POST',
      caption: 'Valid post caption',
      mediaItems: [{
        mediaAssetId: mediaAsset1._id,
        position: 0,
        mediaType: 'IMAGE',
      }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
    });
    await validContent.validate();
    assert(true, 'Valid Content passes Mongoose schema validation');

    let emptyMediaFailed = false;
    try {
      const emptyContent = new Content({
        authorId: userAuthor._id,
        contentType: 'POST',
        mediaItems: [],
      });
      await emptyContent.validate();
    } catch (e) {
      emptyMediaFailed = true;
    }
    assert(emptyMediaFailed, 'Empty mediaItems array is rejected by model validator');

    // -------------------------------------------------------------
    // 2. Media Binding & IDOR Security Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Media Binding & Security Tests ---');

    // 2.1 Unauthenticated POST /v1/posts returns 401
    const unauthPostRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: 'Test' }),
    });
    assert(unauthPostRes.status === 401, 'Unauthenticated POST /v1/posts returns 401');

    // 2.2 Author attempting to bind stranger's media is rejected (403 IDOR)
    const idorPostRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        caption: 'Attempting to steal stranger media',
        mediaItems: [{ mediaAssetId: strangerMedia._id.toString(), position: 0 }],
      }),
    });
    const idorPostData = await idorPostRes.json();
    assert(idorPostRes.status === 403, 'Cross-user media binding returns 403 Forbidden');
    assert(idorPostData.code === 'CROSS_USER_MEDIA_BINDING_FORBIDDEN', 'Returns CROSS_USER_MEDIA_BINDING_FORBIDDEN code');

    // 2.3 Author attempting to bind non-ready media is rejected (400)
    const notReadyRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        caption: 'Binding un-uploaded media',
        mediaItems: [{ mediaAssetId: pendingMedia._id.toString(), position: 0 }],
      }),
    });
    const notReadyData = await notReadyRes.json();
    assert(notReadyRes.status === 400, 'Non-ready media binding returns 400 Bad Request');
    assert(notReadyData.code === 'MEDIA_NOT_READY', 'Returns MEDIA_NOT_READY code');

    // 2.4 Duplicate carousel positions rejected
    const dupPosRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        caption: 'Duplicate positions',
        mediaItems: [
          { mediaAssetId: mediaAsset1._id.toString(), position: 0 },
          { mediaAssetId: mediaAsset2._id.toString(), position: 0 },
        ],
      }),
    });
    assert(dupPosRes.status === 400, 'Duplicate carousel position returns 400 Bad Request');

    // -------------------------------------------------------------
    // 3. Post Creation & Publication Lifecycle Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Post Creation & Publication Lifecycle Tests ---');

    // 3.1 Create single-image public post
    const post1Res = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        caption: 'First sunset in Jaipur #rubaru',
        mediaItems: [{ mediaAssetId: mediaAsset1._id.toString(), position: 0, accessibilityDescription: 'Jaipur Sunset' }],
        audience: 'PUBLIC',
        locationLabel: 'Hawa Mahal, Jaipur',
        idempotencyKey: `post_key_1_${timestamp}`,
      }),
    });
    const post1Data = await post1Res.json();
    assert(post1Res.status === 201, 'Valid single-image post returns 201 Created');
    assert(post1Data.success === true, 'Response contains success: true');
    assert(post1Data.data.status === 'PUBLISHED', 'Post status is PUBLISHED');
    assert(post1Data.data.mediaItems.length === 1, 'Post contains 1 media item');
    assert(post1Data.data.mediaItems[0].variants.length > 0, 'Media variants safely hydrated');

    const createdPost1Id = post1Data.data.postId;

    // 3.2 Idempotent retry returns identical post
    const idempRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        caption: 'First sunset in Jaipur #rubaru',
        mediaItems: [{ mediaAssetId: mediaAsset1._id.toString(), position: 0 }],
        idempotencyKey: `post_key_1_${timestamp}`,
      }),
    });
    const idempData = await idempRes.json();
    assert(idempData.data.postId === createdPost1Id, 'Idempotent request returns identical postId');

    // 3.3 Create multi-image carousel post (2 items) with FOLLOWERS audience
    const carouselRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({
        caption: 'Jaipur trip highlights carousel',
        mediaItems: [
          { mediaAssetId: mediaAsset1._id.toString(), position: 0 },
          { mediaAssetId: mediaAsset2._id.toString(), position: 1 },
        ],
        audience: 'FOLLOWERS',
        idempotencyKey: `post_key_carousel_${timestamp}`,
      }),
    });
    const carouselData = await carouselRes.json();
    assert(carouselRes.status === 201, 'Carousel post returns 201 Created');
    assert(carouselData.data.mediaItems.length === 2, 'Carousel contains 2 ordered media items');
    assert(carouselData.data.audience === 'FOLLOWERS', 'Audience is FOLLOWERS');

    const createdCarouselId = carouselData.data.postId;

    // -------------------------------------------------------------
    // 4. Privacy & Audience Authorization Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Privacy & Audience Authorization Tests ---');

    // 4.1 Stranger queries Public Post 1 -> 200 OK
    const getPublicRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, { headers: authHeadersStranger });
    assert(getPublicRes.status === 200, 'Stranger accessing public post returns 200 OK');

    // 4.2 Stranger queries Followers-Only Carousel Post -> 403 Forbidden
    const getFollowersOnlyRes = await fetch(`${BASE_URL}/v1/posts/${createdCarouselId}`, { headers: authHeadersStranger });
    assert(getFollowersOnlyRes.status === 403, 'Non-follower accessing followers-only post returns 403 Forbidden');

    // 4.3 Accepted Follower queries Followers-Only Carousel Post -> 200 OK
    const getFollowerOkRes = await fetch(`${BASE_URL}/v1/posts/${createdCarouselId}`, { headers: authHeadersFollower });
    assert(getFollowerOkRes.status === 200, 'Accepted follower accessing followers-only post returns 200 OK');

    // -------------------------------------------------------------
    // 5. User Post List & Cursor Pagination Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. User Post List & Cursor Pagination Tests ---');

    // 5.1 Follower queries Author post list -> 200 OK
    const userPostsRes = await fetch(`${BASE_URL}/v1/users/${userAuthor._id}/posts?limit=1`, { headers: authHeadersFollower });
    const userPostsData = await userPostsRes.json();
    assert(userPostsRes.status === 200, 'Get user posts returns 200 OK');
    assert(userPostsData.data.items.length === 1, 'Returns bounded limit of 1 post');
    assert(userPostsData.data.hasMore === true, 'hasMore is true');
    assert(typeof userPostsData.data.nextCursor === 'string', 'nextCursor is returned');

    // 5.2 Follower queries next page using nextCursor
    const page2Res = await fetch(`${BASE_URL}/v1/users/${userAuthor._id}/posts?cursor=${encodeURIComponent(userPostsData.data.nextCursor)}&limit=1`, { headers: authHeadersFollower });
    const page2Data = await page2Res.json();
    assert(page2Res.status === 200, 'Page 2 with cursor returns 200 OK');
    assert(page2Data.data.items.length === 1, 'Returns 1 item on page 2');
    assert(page2Data.data.items[0].postId !== userPostsData.data.items[0].postId, 'Page 2 item is distinct from page 1');

    // -------------------------------------------------------------
    // 6. Edit, Archive, Unarchive & Soft Delete Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Edit, Archive, Unarchive & Delete Tests ---');

    // 6.1 Stranger attempting to edit Author's post returns 403
    const strangerEditRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, {
      method: 'PATCH',
      headers: authHeadersStranger,
      body: JSON.stringify({ caption: 'Hacked caption' }),
    });
    assert(strangerEditRes.status === 403, 'Non-owner edit returns 403 Forbidden');

    // 6.2 Author edits post caption
    const authorEditRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, {
      method: 'PATCH',
      headers: authHeadersAuthor,
      body: JSON.stringify({ caption: 'Updated sunset in Jaipur #rubaru #sunset' }),
    });
    const authorEditData = await authorEditRes.json();
    assert(authorEditRes.status === 200, 'Owner edit returns 200 OK');
    assert(authorEditData.data.caption === 'Updated sunset in Jaipur #rubaru #sunset', 'Caption updated successfully');
    assert(authorEditData.data.editedAt !== null, 'editedAt timestamp recorded');

    // 6.3 Author archives post
    const archiveRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}/archive`, {
      method: 'POST',
      headers: authHeadersAuthor,
    });
    const archiveData = await archiveRes.json();
    assert(archiveRes.status === 200, 'Owner archive returns 200 OK');
    assert(archiveData.data.archived === true, 'Response confirms archived: true');

    // Verify archived post is no longer visible to Stranger
    const getArchivedRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, { headers: authHeadersStranger });
    assert(getArchivedRes.status === 404, 'Archived post is hidden from stranger (404 Not Found)');

    // 6.4 Author unarchives post
    const unarchiveRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}/unarchive`, {
      method: 'POST',
      headers: authHeadersAuthor,
    });
    assert(unarchiveRes.status === 200, 'Owner unarchive returns 200 OK');

    const getUnarchivedRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, { headers: authHeadersStranger });
    assert(getUnarchivedRes.status === 200, 'Unarchived post is accessible again to stranger');

    // 6.5 Author deletes post
    const deleteRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, {
      method: 'DELETE',
      headers: authHeadersAuthor,
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200, 'Owner delete returns 200 OK');
    assert(deleteData.data.deleted === true, 'Response confirms deleted: true');

    // Deleted post returns 404 to all callers
    const getDeletedRes = await fetch(`${BASE_URL}/v1/posts/${createdPost1Id}`, { headers: authHeadersAuthor });
    assert(getDeletedRes.status === 404, 'Deleted post returns 404 Not Found');

    // -------------------------------------------------------------
    // 7. Bilateral Block Suppression Tests
    // -------------------------------------------------------------
    console.log('\n--- 7. Bilateral Block Suppression Tests ---');

    // Stranger blocks Author
    await safetyService.blockUser(userStranger._id, userAuthor._id, { reason: 'CONTENT_BLOCK' });

    // Stranger attempting to view Carousel Post returns 400/404
    const blockedGetRes = await fetch(`${BASE_URL}/v1/posts/${createdCarouselId}`, { headers: authHeadersStranger });
    assert(blockedGetRes.status === 404 || blockedGetRes.status === 403, 'Blocked user cannot access author posts');

    console.log('\n===========================================================');
    console.log(`POST LIFECYCLE TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runPostLifecycleTests();
}

module.exports = runPostLifecycleTests;
