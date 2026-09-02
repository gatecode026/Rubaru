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
const ContentLike = require('../models/ContentLike');
const Save = require('../models/Save');
const Block = require('../models/Block');

// Services & Routes
const safetyService = require('../services/safetyService');
const followService = require('../services/followService');
const feedService = require('../services/feedService');
const feedRoutes = require('../routes/feedRoutes');

async function runConnectedFeedTests() {
  console.log('===========================================================');
  console.log('           RUBARU CONNECTED HOME FEED TEST SUITE           ');
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

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    // Viewer
    const userViewer = await User.create({ email: `feed_viewer_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userViewer._id, displayName: 'Feed Viewer', dateOfBirth: new Date('1997-01-01'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenViewer = jwt.sign({ id: userViewer._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersViewer = { Authorization: `Bearer ${tokenViewer}`, 'Content-Type': 'application/json' };

    // Followed User 1 (Public Account)
    const userAlice = await User.create({ email: `feed_alice_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAlice._id, displayName: 'Alice Public', dateOfBirth: new Date('1998-02-02'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });

    // Followed User 2 (Private Account with Accepted follow)
    const userBob = await User.create({ email: `feed_bob_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userBob._id, displayName: 'Bob Private', dateOfBirth: new Date('1996-03-03'), gender: 'Male', socialAccountVisibility: 'PRIVATE' });

    // Pending Follow User (Charlie)
    const userCharlie = await User.create({ email: `feed_charlie_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userCharlie._id, displayName: 'Charlie Pending', dateOfBirth: new Date('1999-04-04'), gender: 'Male', socialAccountVisibility: 'PRIVATE' });

    // Stranger (Not Followed)
    const userStranger = await User.create({ email: `feed_stranger_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userStranger._id, displayName: 'Stranger User', dateOfBirth: new Date('1995-05-05'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });

    // Blocked User (David)
    const userDavid = await User.create({ email: `feed_david_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userDavid._id, displayName: 'David Blocked', dateOfBirth: new Date('1994-06-06'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });

    // 2. Setup Relationships
    // Viewer follows Alice (ACCEPTED)
    await FollowRelationship.create({ followerId: userViewer._id, followingId: userAlice._id, status: 'ACCEPTED', acceptedAt: new Date() });

    // Viewer follows Bob (ACCEPTED)
    await FollowRelationship.create({ followerId: userViewer._id, followingId: userBob._id, status: 'ACCEPTED', acceptedAt: new Date() });

    // Viewer follows Charlie (PENDING)
    await FollowRelationship.create({ followerId: userViewer._id, followingId: userCharlie._id, status: 'PENDING', requestedAt: new Date() });

    // Viewer blocked David
    await safetyService.blockUser(userViewer._id, userDavid._id, { reason: 'TEST_FEED_BLOCK' });

    // 3. Helper to create published media post
    const createPost = async (authorId, caption, publishedAt, audience = 'PUBLIC', status = 'PUBLISHED', moderationStatus = 'APPROVED') => {
      const media = await MediaAsset.create({
        ownerId: authorId,
        uploadSessionId: new mongoose.Types.ObjectId(),
        purpose: 'POST_MEDIA',
        mediaType: 'IMAGE',
        originalObjectKey: `media/test/${authorId}/${Date.now()}/orig.jpg`,
        originalMimeType: 'image/jpeg',
        processingStatus: 'READY',
        moderationStatus: 'APPROVED',
        variants: [{ name: 'medium', objectKey: `media/test/${authorId}/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: `https://cdn.rubaru.app/med_${Date.now()}.webp` }],
        thumbnail: { objectKey: `media/test/${authorId}/thumb.webp`, url: `https://cdn.rubaru.app/thumb_${Date.now()}.webp`, width: 300, height: 300 },
      });

      return Content.create({
        authorId,
        contentType: 'POST',
        caption,
        mediaItems: [{ mediaAssetId: media._id, position: 0, mediaType: 'IMAGE', variants: media.variants, thumbnail: media.thumbnail }],
        audience,
        status,
        moderationStatus,
        publishedAt,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        savesCount: 0,
      });
    };

    // 4. Create Posts with Controlled Timestamps
    const t0 = new Date(Date.now() - 50000);
    const t1 = new Date(Date.now() - 40000);
    const t2 = new Date(Date.now() - 30000);
    const t3 = new Date(Date.now() - 20000);
    const t4 = new Date(Date.now() - 10000);
    const t5 = new Date(Date.now());

    // Alice Posts (Followed Public)
    const postAlice1 = await createPost(userAlice._id, 'Alice Post 1', t1);
    const postAliceFollowersOnly = await createPost(userAlice._id, 'Alice Followers Only', t3, 'FOLLOWERS');

    // Bob Posts (Followed Private)
    const postBob1 = await createPost(userBob._id, 'Bob Private Post', t2);

    // Viewer Own Post
    const postViewer = await createPost(userViewer._id, 'Viewer Own Post', t4);

    // Charlie Post (Pending Follow -> Should be Excluded)
    const postCharlie = await createPost(userCharlie._id, 'Charlie Pending Post', t5);

    // Stranger Post (Not Followed -> Should be Excluded)
    const postStranger = await createPost(userStranger._id, 'Stranger Post', t5);

    // David Post (Blocked -> Should be Excluded)
    const postDavid = await createPost(userDavid._id, 'David Blocked Post', t5);

    // Alice Inactive/Archived/Deleted Posts -> Should be Excluded
    const postAliceArchived = await createPost(userAlice._id, 'Alice Archived Post', t5, 'PUBLIC', 'ARCHIVED');
    const postAliceDeleted = await createPost(userAlice._id, 'Alice Deleted Post', t5, 'PUBLIC', 'DELETED');
    const postAliceRejected = await createPost(userAlice._id, 'Alice Rejected Post', t5, 'PUBLIC', 'PUBLISHED', 'REJECTED');

    // Viewer Likes & Saves postAlice1
    await ContentLike.create({ userId: userViewer._id, contentId: postAlice1._id, reactionType: 'LIKE', status: 'ACTIVE' });
    await Save.create({ userId: userViewer._id, contentId: postAlice1._id, status: 'ACTIVE' });

    // -------------------------------------------------------------
    // 1. Candidate Source & Authorization Inclusion/Exclusion Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Candidate Source & Inclusion/Exclusion Tests ---');

    const feedResult = await feedService.getConnectedFeed(userViewer._id, { limit: 20 });
    const feedItems = feedResult.items;

    assert(Array.isArray(feedItems), 'Feed returns items array');
    assert(feedItems.length === 4, `Feed contains exactly 4 eligible posts (got ${feedItems.length})`);

    const feedPostIds = feedItems.map((p) => p.postId);

    // Verify Inclusions
    assert(feedPostIds.includes(postViewer._id.toString()), 'Viewer own post is included');
    assert(feedPostIds.includes(postAlice1._id.toString()), 'Alice public post is included');
    assert(feedPostIds.includes(postAliceFollowersOnly._id.toString()), 'Alice followers-only post is included');
    assert(feedPostIds.includes(postBob1._id.toString()), 'Bob accepted private post is included');

    // Verify Strict Exclusions
    assert(!feedPostIds.includes(postCharlie._id.toString()), 'Pending follow post (Charlie) is excluded');
    assert(!feedPostIds.includes(postStranger._id.toString()), 'Stranger post is excluded');
    assert(!feedPostIds.includes(postDavid._id.toString()), 'Blocked user post (David) is excluded');
    assert(!feedPostIds.includes(postAliceArchived._id.toString()), 'Archived post is excluded');
    assert(!feedPostIds.includes(postAliceDeleted._id.toString()), 'Deleted post is excluded');
    assert(!feedPostIds.includes(postAliceRejected._id.toString()), 'Moderation rejected post is excluded');

    // -------------------------------------------------------------
    // 2. Deterministic Reverse Chronological Ordering Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Deterministic Ordering Tests ---');

    assert(feedResult.feed.orderingVersion === 'connected_feed_chronological_v1', 'Ordering version matches connected_feed_chronological_v1');
    assert(feedItems[0].postId === postViewer._id.toString(), 'Newest post (Viewer t4) is ranked 1st');
    assert(feedItems[1].postId === postAliceFollowersOnly._id.toString(), '2nd newest post (Alice t3) is ranked 2nd');
    assert(feedItems[2].postId === postBob1._id.toString(), '3rd newest post (Bob t2) is ranked 3rd');
    assert(feedItems[3].postId === postAlice1._id.toString(), 'Oldest post (Alice t1) is ranked 4th');

    // -------------------------------------------------------------
    // 3. Opaque Cursor Pagination Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Opaque Cursor Pagination Tests ---');

    // Page 1 with limit 2
    const page1Res = await feedService.getConnectedFeed(userViewer._id, { limit: 2 });
    assert(page1Res.items.length === 2, 'Page 1 returns 2 items');
    assert(page1Res.pageInfo.hasMore === true, 'Page 1 hasMore is true');
    assert(typeof page1Res.pageInfo.nextCursor === 'string', 'Page 1 returns opaque nextCursor');

    // Page 2 using nextCursor
    const page2Res = await feedService.getConnectedFeed(userViewer._id, { cursor: page1Res.pageInfo.nextCursor, limit: 2 });
    assert(page2Res.items.length === 2, 'Page 2 returns remaining 2 items');
    assert(page2Res.items[0].postId === postBob1._id.toString(), 'Page 2 starts with 3rd item (Bob t2)');
    assert(page2Res.items[1].postId === postAlice1._id.toString(), 'Page 2 ends with 4th item (Alice t1)');

    // Ensure no overlapping items between Page 1 and Page 2
    const page1Ids = page1Res.items.map((i) => i.postId);
    const page2Ids = page2Res.items.map((i) => i.postId);
    const hasOverlap = page1Ids.some((id) => page2Ids.includes(id));
    assert(hasOverlap === false, 'Page 1 and Page 2 contain 0 overlapping duplicates');

    // Page 2 is the terminal page
    assert(page2Res.pageInfo.hasMore === false, 'Final page hasMore is false');
    assert(page2Res.pageInfo.nextCursor === null, 'Final page nextCursor is null');

    // -------------------------------------------------------------
    // 4. Cursor Security & Validation Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Cursor Security & Validation Tests ---');

    try {
      await feedService.getConnectedFeed(userViewer._id, { cursor: 'malformed_non_base64_json!@#' });
      assert(false, 'Malformed cursor should throw');
    } catch (err) {
      assert(err.code === 'INVALID_CURSOR', 'Malformed cursor throws INVALID_CURSOR (400)');
    }

    const incompatibleCursor = Buffer.from(JSON.stringify({ p: new Date().toISOString(), i: new mongoose.Types.ObjectId().toString(), v: 'incompatible_version_v99' })).toString('base64');
    try {
      await feedService.getConnectedFeed(userViewer._id, { cursor: incompatibleCursor });
      assert(false, 'Incompatible cursor version should throw');
    } catch (err) {
      assert(err.code === 'INCOMPATIBLE_CURSOR_VERSION', 'Incompatible cursor version throws INCOMPATIBLE_CURSOR_VERSION (400)');
    }

    // -------------------------------------------------------------
    // 5. Bulk Hydration & Safe Projection Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Bulk Hydration & Safe Projection Tests ---');

    const aliceItem = feedItems.find((i) => i.postId === postAlice1._id.toString());
    assert(aliceItem.author.displayName === 'Alice Public', 'Author displayName is hydrated');
    assert(aliceItem.isLiked === true, 'Viewer isLiked state is hydrated (true)');
    assert(aliceItem.isSaved === true, 'Viewer isSaved state is hydrated (true)');

    const bobItem = feedItems.find((i) => i.postId === postBob1._id.toString());
    assert(bobItem.isLiked === false, 'Viewer isLiked state is hydrated (false for Bob)');
    assert(bobItem.isSaved === false, 'Viewer isSaved state is hydrated (false for Bob)');

    // Security: verify no private storage or account fields leaked
    assert(!aliceItem.mediaItems[0].originalObjectKey, 'originalObjectKey is NOT leaked in feed DTO');
    assert(!aliceItem.mediaItems[0].uploadSessionId, 'uploadSessionId is NOT leaked in feed DTO');
    assert(!aliceItem.author.email, 'Author email is NOT leaked in feed DTO');

    // -------------------------------------------------------------
    // 6. HTTP REST API Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. HTTP REST API Endpoint Tests ---');

    // Unauthenticated GET /v1/feed returns 401
    const unauthRes = await fetch(`${BASE_URL}/v1/feed`);
    assert(unauthRes.status === 401, 'Unauthenticated GET /v1/feed returns 401 Unauthorized');

    // Authenticated GET /v1/feed returns 200 OK
    const authRes = await fetch(`${BASE_URL}/v1/feed?limit=10`, { headers: authHeadersViewer });
    const authData = await authRes.json();
    assert(authRes.status === 200, 'Authenticated GET /v1/feed returns 200 OK');
    assert(authData.success === true, 'Response contains success: true');
    assert(authData.data.items.length === 4, 'API returns 4 feed items');
    assert(authData.data.feed.source === 'CONNECTED', 'Feed source is CONNECTED');

    // User with 0 follows and 0 posts
    const emptyUser = await User.create({ email: `feed_empty_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const tokenEmpty = jwt.sign({ id: emptyUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const emptyRes = await fetch(`${BASE_URL}/v1/feed`, { headers: { Authorization: `Bearer ${tokenEmpty}`, 'Content-Type': 'application/json' } });
    const emptyData = await emptyRes.json();
    assert(emptyRes.status === 200, 'Empty feed user query returns 200 OK');
    assert(emptyData.data.items.length === 0, 'Returns 0 items for empty feed');
    assert(emptyData.data.feed.reason === 'NO_CONNECTED_CONTENT', 'Returns NO_CONNECTED_CONTENT reason');

    console.log('\n===========================================================');
    console.log(`CONNECTED FEED TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runConnectedFeedTests();
}

module.exports = runConnectedFeedTests;
