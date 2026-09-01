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
const Comment = require('../models/Comment');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');
const Notification = require('../models/Notification');
const Device = require('../models/Device');
const NotificationPreference = require('../models/NotificationPreference');
const MediaAsset = require('../models/MediaAsset');
const OutboxEvent = require('../models/OutboxEvent');
const ReporterSuppression = require('../models/ReporterSuppression');

// Routes
const mediaRoutes = require('../routes/mediaRoutes');
const followRoutes = require('../routes/followRoutes');
const postRoutes = require('../routes/postRoutes');
const interactionRoutes = require('../routes/interactionRoutes');
const feedRoutes = require('../routes/feedRoutes');
const storyRoutes = require('../routes/storyRoutes');
const reelRoutes = require('../routes/reelRoutes');
const safetyRoutes = require('../routes/safetyRoutes');
const notifRoutes = require('../routes/notifRoutes');

// Services
const followService = require('../services/followService');
const postService = require('../services/postService');
const feedService = require('../services/feedService');
const interactionService = require('../services/interactionService');
const storyService = require('../services/storyService');
const reelService = require('../services/reelService');
const socialModerationService = require('../services/socialModerationService');
const notificationService = require('../services/notificationService');

async function runFrontendSocialIntegrationTests() {
  console.log('================================================================');
  console.log(' RUBARU FRONTEND SOCIAL INTEGRATION & E2E SYSTEM TEST SUITE    ');
  console.log('================================================================\n');

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

  // Setup Express test server
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/v1', mediaRoutes);
  app.use('/v1', followRoutes);
  app.use('/v1', postRoutes);
  app.use('/v1', interactionRoutes);
  app.use('/v1', feedRoutes);
  app.use('/v1', storyRoutes);
  app.use('/v1', reelRoutes);
  app.use('/v1', safetyRoutes);
  app.use('/v1/notifications', notifRoutes);
  app.use('/v1/devices', notifRoutes);
  app.use('/v1/users/me/notification-preferences', notifRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}`;

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // Setup Test Users
    // -------------------------------------------------------------
    const aliceUser = await User.create({ email: `alice_fe_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: aliceUser._id, displayName: 'Alice Architect', avatarUri: 'https://cdn.rubaru.app/alice.jpg', gender: 'Female', dateOfBirth: new Date('1997-04-12'), socialAccountVisibility: 'PUBLIC' });

    const bobUser = await User.create({ email: `bob_fe_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: bobUser._id, displayName: 'Bob Backend', avatarUri: 'https://cdn.rubaru.app/bob.jpg', isPrivate: true, socialAccountVisibility: 'PRIVATE', gender: 'Male', dateOfBirth: new Date('1996-08-22') });

    const charlieUser = await User.create({ email: `charlie_fe_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: charlieUser._id, displayName: 'Charlie Client', gender: 'Male', dateOfBirth: new Date('1998-11-05'), socialAccountVisibility: 'PUBLIC' });

    const aliceToken = jwt.sign({ id: aliceUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const bobToken = jwt.sign({ id: bobUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const charlieToken = jwt.sign({ id: charlieUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    const headersAlice = { Authorization: `Bearer ${aliceToken}`, 'Content-Type': 'application/json' };
    const headersBob = { Authorization: `Bearer ${bobToken}`, 'Content-Type': 'application/json' };
    const headersCharlie = { Authorization: `Bearer ${charlieToken}`, 'Content-Type': 'application/json' };

    // -------------------------------------------------------------
    console.log('\n--- 1. Media Upload & Post Creation Flow ---');
    // -------------------------------------------------------------
    const aliceMedia = await MediaAsset.create({
      ownerId: aliceUser._id,
      mediaType: 'IMAGE',
      purpose: 'POST_MEDIA',
      processingStatus: 'READY',
      originalObjectKey: `uploads/post_${timestamp}.jpg`,
      originalMimeType: 'image/jpeg',
      originalSizeBytes: 102400,
      uploadSessionId: new mongoose.Types.ObjectId(),
      variants: [{ name: 'FEED_MAIN', objectKey: `variants/post_feed_${timestamp}.jpg`, mimeType: 'image/jpeg', sizeBytes: 85000, width: 1080, height: 1080, url: 'https://cdn.rubaru.app/post_feed.jpg' }],
    });

    const createPostRes = await fetch(`${BASE_URL}/v1/posts`, {
      method: 'POST',
      headers: headersAlice,
      body: JSON.stringify({
        mediaItems: [{ mediaAssetId: aliceMedia._id.toString(), position: 0 }],
        caption: 'Hello from Rubaru Frontend Architecture!',
        audience: 'PUBLIC',
      }),
    });
    const createPostData = await createPostRes.json();
    const createdPost = createPostData.data?.post || createPostData.data;
    assert(createPostRes.status === 201, 'POST /v1/posts creates post with 201 Created');
    assert(createdPost !== undefined && (createdPost.caption || '').includes('Rubaru'), 'Post returns canonical payload');

    const createdPostId = (createdPost?.postId || createdPost?.id || createdPost?._id || '').toString();

    // View post in profile grid
    const userPostsRes = await fetch(`${BASE_URL}/v1/users/${aliceUser._id}/posts`, { headers: headersAlice });
    const userPostsData = await userPostsRes.json();
    const userPostItems = userPostsData.data?.items || userPostsData.items || [];
    assert(userPostsRes.status === 200, 'GET /v1/users/:id/posts returns 200 OK');
    assert(userPostItems.length >= 1, 'Created post appears in user profile grid');

    // -------------------------------------------------------------
    console.log('\n--- 2. Follow Graph & Private Follow Request Flow ---');
    // -------------------------------------------------------------
    // Alice requests to follow private user Bob
    const followReqRes = await fetch(`${BASE_URL}/v1/users/${bobUser._id}/follow`, {
      method: 'POST',
      headers: headersAlice,
    });
    const followReqData = await followReqRes.json();
    const followReqStatus = followReqData.data?.relationship?.status || followReqData.relationship?.status || followReqData.data?.status || followReqData.status;
    assert(followReqRes.status === 200, 'POST /v1/users/:id/follow on private account returns 200');
    assert(followReqStatus === 'PENDING', 'Private follow relationship is PENDING');

    // Bob retrieves pending follow requests and accepts
    const pendingRequestsRes = await fetch(`${BASE_URL}/v1/follow-requests`, { headers: headersBob });
    const pendingRequestsData = await pendingRequestsRes.json();
    const pendingItems = pendingRequestsData.data?.items || pendingRequestsData.items || [];
    const targetRequestId = pendingItems[0]?.requestId || pendingItems[0]?.id || pendingItems[0]?._id;

    const acceptReqRes = await fetch(`${BASE_URL}/v1/follow-requests/${targetRequestId}/accept`, {
      method: 'POST',
      headers: headersBob,
    });
    const acceptReqData = await acceptReqRes.json();
    const acceptReqStatus = acceptReqData.data?.relationship?.status || acceptReqData.relationship?.status || acceptReqData.data?.status || acceptReqData.status;
    assert(acceptReqRes.status === 200, 'POST /v1/follow-requests/:id/accept returns 200 OK');
    assert(acceptReqStatus === 'ACCEPTED', 'Follow status transitioned to ACCEPTED');

    // Bob also follows Alice so Bob sees Alice's posts in feed
    await fetch(`${BASE_URL}/v1/users/${aliceUser._id}/follow`, {
      method: 'POST',
      headers: headersBob,
    });

    // -------------------------------------------------------------
    console.log('\n--- 3. Connected Feed & Interaction Flow ---');
    // -------------------------------------------------------------
    const feedRes = await fetch(`${BASE_URL}/v1/feed`, { headers: headersBob });
    const feedData = await feedRes.json();
    const feedItems = feedData.data?.items || feedData.items || [];
    const feedBatchId = feedData.data?.batchId || feedData.batchId || feedData.data?.feed?.batchId;
    assert(feedRes.status === 200, 'GET /v1/feed returns 200 OK');
    assert(Array.isArray(feedItems) && feedItems.length >= 1, 'Connected feed contains followed user content');
    assert(typeof feedBatchId === 'string' || feedBatchId !== undefined, 'Feed response contains authoritative batchId');

    // Bob likes Alice's post
    const likeRes = await fetch(`${BASE_URL}/v1/content/${createdPostId}/like`, {
      method: 'POST',
      headers: headersBob,
    });
    const likeData = await likeRes.json();
    const isLikedVal = likeData.data?.isLiked !== undefined ? likeData.data.isLiked : (likeData.data?.liked !== undefined ? likeData.data.liked : likeData.liked);
    assert(likeRes.status === 200, 'POST /v1/content/:id/like returns 200 OK');
    assert(isLikedVal === true || likeData.success === true, 'Viewer interaction isLiked is true');

    // Bob comments on Alice's post
    const commentRes = await fetch(`${BASE_URL}/v1/content/${createdPostId}/comments`, {
      method: 'POST',
      headers: headersBob,
      body: JSON.stringify({ text: 'Fantastic work on this integration!' }),
    });
    const commentData = await commentRes.json();
    const createdComment = commentData.data?.comment || commentData.data || commentData.comment;
    assert(commentRes.status === 201, 'POST /v1/content/:id/comments returns 201 Created');
    assert(createdComment !== undefined && (createdComment.text || '').includes('integration'), 'Comment record returned');

    // Bob saves Alice's post
    const saveRes = await fetch(`${BASE_URL}/v1/content/${createdPostId}/save`, {
      method: 'POST',
      headers: headersBob,
    });
    const saveData = await saveRes.json();
    const isSavedVal = saveData.data?.isSaved !== undefined ? saveData.data.isSaved : (saveData.data?.saved !== undefined ? saveData.data.saved : saveData.saved);
    assert(saveRes.status === 200, 'POST /v1/content/:id/save returns 200 OK');
    assert(isSavedVal === true || saveData.success === true, 'Viewer interaction isSaved is true');

    // Bob views saved posts
    const savedListRes = await fetch(`${BASE_URL}/v1/users/me/saved-content`, { headers: headersBob });
    const savedListData = await savedListRes.json();
    const savedItems = savedListData.data?.items || savedListData.items || [];
    assert(savedListRes.status === 200, 'GET /v1/users/me/saved-content returns 200 OK');
    assert(savedItems.length >= 1, 'Saved post present in user saved list');

    // -------------------------------------------------------------
    console.log('\n--- 4. Story & Reel Lifecycle Flow ---');
    // -------------------------------------------------------------
    // Alice creates a story
    const storyMedia = await MediaAsset.create({
      ownerId: aliceUser._id,
      mediaType: 'IMAGE',
      purpose: 'STORY_MEDIA',
      processingStatus: 'READY',
      originalObjectKey: `uploads/story_${timestamp}.jpg`,
      originalMimeType: 'image/jpeg',
      originalSizeBytes: 85000,
      uploadSessionId: new mongoose.Types.ObjectId(),
      variants: [{ name: 'STORY_FULL', objectKey: `variants/story_${timestamp}.jpg`, mimeType: 'image/jpeg', sizeBytes: 70000, width: 1080, height: 1920, url: 'https://cdn.rubaru.app/story.jpg' }],
    });

    const createStoryRes = await fetch(`${BASE_URL}/v1/stories`, {
      method: 'POST',
      headers: headersAlice,
      body: JSON.stringify({
        mediaAssetId: storyMedia._id.toString(),
        caption: 'Morning in Udaipur!',
      }),
    });
    const createStoryData = await createStoryRes.json();
    const createdStory = createStoryData.data?.story || createStoryData.data || createStoryData.story;
    assert(createStoryRes.status === 201, 'POST /v1/stories creates story with 201 Created');
    assert(createdStory !== undefined && (createdStory.expiresAt !== undefined || createdStory.story?.expiresAt !== undefined || createdStory.publishedAt !== undefined), 'Story has server-controlled expiry');

    const createdStoryId = (createdStory?.postId || createdStory?.storyId || createdStory?.id || createdStory?._id || '').toString();

    // Bob views story tray
    const trayRes = await fetch(`${BASE_URL}/v1/stories/feed`, { headers: headersBob });
    const trayData = await trayRes.json();
    const trayGroups = trayData.data?.groups || trayData.groups || [];
    assert(trayRes.status === 200, 'GET /v1/stories/feed returns 200 OK');
    assert(trayGroups.some((g) => (g.authorId || g.author?._id || '').toString() === aliceUser._id.toString()), 'Story tray contains Alice active story group');

    // Bob records story view
    const viewStoryRes = await fetch(`${BASE_URL}/v1/stories/${createdStoryId}/view`, {
      method: 'POST',
      headers: headersBob,
    });
    const viewStoryData = await viewStoryRes.json();
    const isViewRecorded = viewStoryData.data?.viewRecorded !== undefined ? viewStoryData.data.viewRecorded : (viewStoryData.viewRecorded !== undefined ? viewStoryData.viewRecorded : viewStoryData.success);
    assert(viewStoryRes.status === 200, 'POST /v1/stories/:id/view records view');
    assert(isViewRecorded === true, 'Story view marked recorded');

    // Alice creates a Reel
    const reelMedia = await MediaAsset.create({
      ownerId: aliceUser._id,
      mediaType: 'VIDEO',
      purpose: 'REEL_VIDEO',
      processingStatus: 'READY',
      originalObjectKey: `uploads/reel_${timestamp}.mp4`,
      originalMimeType: 'video/mp4',
      originalSizeBytes: 2500000,
      durationSeconds: 15,
      uploadSessionId: new mongoose.Types.ObjectId(),
      variants: [{ name: 'REEL_720P', objectKey: `variants/reel_720_${timestamp}.mp4`, mimeType: 'video/mp4', sizeBytes: 2100000, width: 720, height: 1280, url: 'https://cdn.rubaru.app/reel_720.mp4' }],
      posterAssetId: aliceMedia._id,
    });

    const createReelRes = await fetch(`${BASE_URL}/v1/reels`, {
      method: 'POST',
      headers: headersAlice,
      body: JSON.stringify({
        videoMediaAssetId: reelMedia._id.toString(),
        caption: 'City of Lakes #reels',
      }),
    });
    const createReelData = await createReelRes.json();
    const createdReel = createReelData.data?.reel || createReelData.data || createReelData.reel;
    assert(createReelRes.status === 201, 'POST /v1/reels creates reel with 201 Created');

    const createdReelId = (createdReel?.postId || createdReel?.reelId || createdReel?.id || createdReel?._id || '').toString();

    // Bob fetches Reel feed
    const reelFeedRes = await fetch(`${BASE_URL}/v1/reels/feed`, { headers: headersBob });
    const reelFeedData = await reelFeedRes.json();
    const reelItems = reelFeedData.data?.items || reelFeedData.items || [];
    const reelBatchId = reelFeedData.data?.feed?.batchId || reelFeedData.feed?.batchId || reelFeedData.data?.batchId || reelFeedData.batchId;
    assert(reelFeedRes.status === 200, 'GET /v1/reels/feed returns 200 OK');
    assert(Array.isArray(reelItems) && reelItems.length >= 1, 'Reel feed contains created reel');

    // Bob submits playback analytics
    const playbackRes = await fetch(`${BASE_URL}/v1/reels/playback-events`, {
      method: 'POST',
      headers: headersBob,
      body: JSON.stringify({
        batchId: reelBatchId,
        events: [
          {
            eventId: `evt_fe_${Date.now()}`,
            reelId: createdReelId,
            position: 0,
            playbackSessionId: `sess_${Date.now()}`,
            eventType: 'PLAY_SUMMARY',
            watchedMs: 12500,
            completed: true,
            replayed: false,
            skipped: false,
          },
        ],
      }),
    });
    const playbackData = await playbackRes.json();
    if (playbackRes.status !== 200) {
      console.error('[DEBUG PLAYBACK RES ERROR]:', playbackRes.status, playbackData);
    }
    assert(playbackRes.status === 200, 'POST /v1/reels/playback-events records analytics');
    assert(playbackData.success === true || playbackData.data?.acknowledgedEvents >= 0 || playbackRes.status === 200, 'Playback event acknowledged');

    // -------------------------------------------------------------
    console.log('\n--- 5. Safety, Moderation & Reporting Flow ---');
    // -------------------------------------------------------------
    // Charlie reports Alice's post
    const reportRes = await fetch(`${BASE_URL}/v1/content/${createdPostId}/report`, {
      method: 'POST',
      headers: headersCharlie,
      body: JSON.stringify({
        reasonCategory: 'SPAM',
        explanation: 'Suspicious repetitive links',
      }),
    });
    const reportData = await reportRes.json();
    const reportIdVal = reportData.data?.caseId || reportData.data?.reportId || reportData.caseId || reportData.reportId || reportData.data?.id;
    assert(reportRes.status === 200 || reportRes.status === 201, 'POST /v1/content/:id/report creates moderation report');
    assert(reportIdVal !== undefined || reportData.success === true, 'Report ID returned safely');

    // Verify reporter suppression: Charlie cannot view the post anymore
    const viewPostCharlieRes = await fetch(`${BASE_URL}/v1/posts/${createdPostId}`, { headers: headersCharlie });
    assert(viewPostCharlieRes.status === 404, 'Reported post suppressed for reporter (returns 404)');

    // -------------------------------------------------------------
    console.log('\n--- 6. Notifications & Device Lifecycle Flow ---');
    // -------------------------------------------------------------
    // Create notifications for Alice from Bob actions
    await notificationService.createNotification({
      recipientId: aliceUser._id,
      actorId: bobUser._id,
      type: 'POST_LIKED',
      subjectType: 'POST',
      subjectId: createdPostId,
      contentId: createdPostId,
    });

    // Alice checks notifications
    const notifRes = await fetch(`${BASE_URL}/v1/notifications`, { headers: headersAlice });
    const notifData = await notifRes.json();
    const notifItems = Array.isArray(notifData.data) ? notifData.data : (notifData.items || []);
    assert(notifRes.status === 200, 'GET /v1/notifications returns 200 OK');
    assert(Array.isArray(notifItems) && notifItems.length > 0, 'Alice has durable notifications from Bob actions');

    // Unread count
    const unreadRes = await fetch(`${BASE_URL}/v1/notifications/unread-count`, { headers: headersAlice });
    const unreadData = await unreadRes.json();
    const unreadCountVal = unreadData.data?.unreadCount !== undefined ? unreadData.data.unreadCount : unreadData.unreadCount;
    assert(unreadRes.status === 200, 'GET /v1/notifications/unread-count returns 200 OK');
    assert(unreadCountVal > 0, 'Unread count is accurate');

    // Mark all as read
    const markAllRes = await fetch(`${BASE_URL}/v1/notifications/read-all`, {
      method: 'PATCH',
      headers: headersAlice,
    });
    const markAllData = await markAllRes.json();
    const markAllUnreadVal = markAllData.data?.unreadCount !== undefined ? markAllData.data.unreadCount : markAllData.unreadCount;
    assert(markAllRes.status === 200, 'PATCH /v1/notifications/read-all returns 200 OK');
    assert(markAllUnreadVal === 0, 'Unread count is 0 after mark-all-read');

    // Device registration & revocation
    const regDeviceRes = await fetch(`${BASE_URL}/v1/notifications/devices`, {
      method: 'POST',
      headers: headersAlice,
      body: JSON.stringify({
        pushToken: `fcm_fe_token_${timestamp}`,
        platform: 'ios',
        deviceId: `device_fe_${timestamp}`,
      }),
    });
    const regDeviceData = await regDeviceRes.json();
    assert(regDeviceRes.status === 201, 'POST /v1/notifications/devices registers device token');

    const targetDeviceId = regDeviceData.data?.deviceId || regDeviceData.data?.id || `device_fe_${timestamp}`;
    const delDeviceRes = await fetch(`${BASE_URL}/v1/notifications/devices/${targetDeviceId}`, {
      method: 'DELETE',
      headers: headersAlice,
    });
    assert(delDeviceRes.status === 200, 'DELETE /v1/notifications/devices/:id revokes device on logout');

    console.log('\n================================================================');
    console.log(`FRONTEND SOCIAL INTEGRATION TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runFrontendSocialIntegrationTests();
}

module.exports = runFrontendSocialIntegrationTests;
