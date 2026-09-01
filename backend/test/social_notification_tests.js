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
const Block = require('../models/Block');
const Notification = require('../models/Notification');
const Device = require('../models/Device');
const NotificationPreference = require('../models/NotificationPreference');
const OutboxEvent = require('../models/OutboxEvent');
const ReporterSuppression = require('../models/ReporterSuppression');
const { SocialNotificationTypes, NotificationCategories } = require('../models/enums');

// Services & Routes
const notificationService = require('../services/notificationService');
const notificationConsumer = require('../services/notificationConsumer');
const pushAdapter = require('../services/pushAdapter');
const notifRoutes = require('../routes/notifRoutes');

async function runSocialNotificationTests() {
  console.log('===========================================================');
  console.log('    RUBARU SOCIAL NOTIFICATIONS & DELIVERY TEST SUITE      ');
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

  // Setup test Express server
  const app = express();
  app.use(cors());
  app.use(express.json());
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
    // Setup Test Users
    // -------------------------------------------------------------
    const recipientUser = await User.create({ email: `recip_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: recipientUser._id, displayName: 'Kavya Recipient', avatarUri: 'https://cdn.rubaru.app/kavya.jpg', gender: 'Female', dateOfBirth: new Date('1998-05-15') });

    const actorUser = await User.create({ email: `actor_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: actorUser._id, displayName: 'Aarav Actor', avatarUri: 'https://cdn.rubaru.app/aarav.jpg', gender: 'Male', dateOfBirth: new Date('1997-03-20') });

    const strangerUser = await User.create({ email: `stranger_notif_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: strangerUser._id, displayName: 'Stranger User', gender: 'Female', dateOfBirth: new Date('1999-01-10') });

    const recipientToken = jwt.sign({ id: recipientUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const actorToken = jwt.sign({ id: actorUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const strangerToken = jwt.sign({ id: strangerUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    const authHeadersRecipient = { Authorization: `Bearer ${recipientToken}`, 'Content-Type': 'application/json' };
    const authHeadersActor = { Authorization: `Bearer ${actorToken}`, 'Content-Type': 'application/json' };
    const authHeadersStranger = { Authorization: `Bearer ${strangerToken}`, 'Content-Type': 'application/json' };

    // Create a test Post
    const testPost = await Content.create({
      author: recipientUser._id,
      authorId: recipientUser._id,
      contentType: 'POST',
      caption: 'Sunset in Udaipur #travel',
      mediaAssetIds: [new mongoose.Types.ObjectId()],
      mediaItems: [{ mediaAssetId: new mongoose.Types.ObjectId(), mediaType: 'IMAGE', position: 0 }],
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      audience: 'PUBLIC',
      publishedAt: new Date(),
    });

    // -------------------------------------------------------------
    console.log('\n--- 1. Model & Schema Validation Tests ---');
    // -------------------------------------------------------------

    const testNotif = new Notification({
      recipient: recipientUser._id,
      sender: actorUser._id,
      type: SocialNotificationTypes.POST_LIKED,
      category: NotificationCategories.LIKES,
      subjectType: 'POST',
      subjectId: testPost._id,
      contentId: testPost._id,
      message: 'Aarav Actor liked your post.',
      deepLink: `rubaru://post/${testPost._id}`,
    });
    const notifValidateErr = testNotif.validateSync();
    assert(!notifValidateErr, 'Valid Notification passes Mongoose schema validation');

    const testDevice = new Device({
      user: recipientUser._id,
      pushToken: `fcm_token_${timestamp}_1`,
      platform: 'android',
      deviceId: `device_${timestamp}`,
      status: 'ACTIVE',
    });
    assert(!testDevice.validateSync(), 'Valid Device passes Mongoose schema validation');

    const testPref = new NotificationPreference({
      user: recipientUser._id,
    });
    assert(!testPref.validateSync(), 'Valid NotificationPreference passes Mongoose schema validation');
    assert(testPref.likes.inApp === true && testPref.likes.push === true, 'Default preferences enable inApp and push');

    // -------------------------------------------------------------
    console.log('\n--- 2. Durable Notification Creation & Outbox Processing Tests ---');
    // -------------------------------------------------------------

    // 2.1 Follow Request Event
    const followReqEvent = new OutboxEvent({
      eventType: 'follow.requested',
      aggregateType: 'USER',
      aggregateId: recipientUser._id.toString(),
      payload: {
        relationshipId: new mongoose.Types.ObjectId().toString(),
        followerId: actorUser._id.toString(),
        followingId: recipientUser._id.toString(),
      },
      deduplicationKey: `ev_follow_req_${timestamp}`,
    });
    const followReqRes = await notificationConsumer.processEvent(followReqEvent);
    assert(followReqRes.processed === true, 'Outbox event follow.requested processed successfully');
    assert(followReqRes.createdCount === 1, 'FOLLOW_REQUEST_RECEIVED notification created');

    const createdFollowNotif = await Notification.findOne({ recipient: recipientUser._id, type: SocialNotificationTypes.FOLLOW_REQUEST_RECEIVED });
    assert(createdFollowNotif !== null, 'FOLLOW_REQUEST_RECEIVED record persisted in DB');
    assert(createdFollowNotif.deepLink === 'rubaru://follow-requests', 'Deep link set to rubaru://follow-requests');

    // 2.2 Content Like Event
    const likeEvent = new OutboxEvent({
      eventType: 'content.liked',
      aggregateType: 'CONTENT',
      aggregateId: testPost._id.toString(),
      payload: {
        contentId: testPost._id.toString(),
        authorId: recipientUser._id.toString(),
        userId: actorUser._id.toString(),
        contentType: 'POST',
      },
      deduplicationKey: `ev_like_${timestamp}`,
    });
    const likeEventRes = await notificationConsumer.processEvent(likeEvent);
    assert(likeEventRes.processed === true, 'Outbox event content.liked processed');
    assert(likeEventRes.createdCount === 1, 'POST_LIKED notification created');

    const createdLikeNotif = await Notification.findOne({ recipient: recipientUser._id, type: SocialNotificationTypes.POST_LIKED });
    assert(createdLikeNotif.deepLink === `rubaru://post/${testPost._id}`, 'Post like deep link points to rubaru://post/:id');

    // 2.3 Comment Created & Reply Event
    const parentComment = await Comment.create({
      contentId: testPost._id,
      author: recipientUser._id,
      authorId: recipientUser._id,
      text: 'Original caption discussion',
    });

    const commentEvent = new OutboxEvent({
      eventType: 'comment.created',
      aggregateType: 'CONTENT',
      aggregateId: testPost._id.toString(),
      payload: {
        commentId: new mongoose.Types.ObjectId().toString(),
        contentId: testPost._id.toString(),
        contentAuthorId: recipientUser._id.toString(),
        authorId: actorUser._id.toString(),
        parentCommentId: parentComment._id.toString(),
        parentCommentAuthorId: recipientUser._id.toString(),
        contentType: 'POST',
      },
      deduplicationKey: `ev_comment_${timestamp}`,
    });
    const commentEventRes = await notificationConsumer.processEvent(commentEvent);
    console.log('[DEBUG COMMENT EVENT RES]:', JSON.stringify(commentEventRes));
    assert(commentEventRes.processed === true, 'Outbox event comment.created processed');
    assert(commentEventRes.createdCount >= 1, 'COMMENT_REPLIED notification created');

    // 2.4 Moderation Decision Event
    const modEvent = new OutboxEvent({
      eventType: 'moderation.decision_applied',
      aggregateType: 'CONTENT',
      aggregateId: testPost._id.toString(),
      payload: {
        subjectType: 'POST',
        subjectId: testPost._id.toString(),
        subjectOwnerId: recipientUser._id.toString(),
        decision: 'HIDE',
      },
      deduplicationKey: `ev_mod_${timestamp}`,
    });
    const modEventRes = await notificationConsumer.processEvent(modEvent);
    assert(modEventRes.processed === true, 'Outbox event moderation.decision_applied processed');
    assert(modEventRes.createdCount === 1, 'CONTENT_REMOVED notification created');

    // -------------------------------------------------------------
    console.log('\n--- 3. Deduplication & Idempotency Tests ---');
    // -------------------------------------------------------------

    const duplicateEventRes = await notificationConsumer.processEvent(likeEvent);
    assert(duplicateEventRes.processed === true, 'Duplicate outbox event processed safely');
    assert(duplicateEventRes.duplicateCount === 1, 'Duplicate detected and flagged idempotent (duplicate: true)');
    assert(duplicateEventRes.createdCount === 0, 'Zero duplicate notifications created');

    // -------------------------------------------------------------
    console.log('\n--- 4. Safety & Suppression Rules Tests ---');
    // -------------------------------------------------------------

    // 4.1 Self-action suppression
    const selfLikeRes = await notificationService.createNotification({
      recipientId: recipientUser._id,
      actorId: recipientUser._id,
      type: SocialNotificationTypes.POST_LIKED,
      subjectId: testPost._id,
      contentId: testPost._id,
    });
    assert(selfLikeRes.suppressed === true, 'Self-action suppressed');
    assert(selfLikeRes.reason === 'SELF_ACTION', 'Suppression reason is SELF_ACTION');

    // 4.2 Block suppression
    await Block.create({ blocker: recipientUser._id, blocked: strangerUser._id });
    const blockedNotifRes = await notificationService.createNotification({
      recipientId: recipientUser._id,
      actorId: strangerUser._id,
      type: SocialNotificationTypes.NEW_FOLLOWER,
    });
    assert(blockedNotifRes.suppressed === true, 'Blocked actor notification suppressed');
    assert(blockedNotifRes.reason === 'BLOCKED', 'Suppression reason is BLOCKED');

    // 4.3 Preference suppression
    await NotificationPreference.updateOne(
      { user: recipientUser._id },
      { $set: { 'shares.inApp': false, 'shares.push': false } }
    );
    const prefSuppressedRes = await notificationService.createNotification({
      recipientId: recipientUser._id,
      actorId: actorUser._id,
      type: SocialNotificationTypes.CONTENT_SHARED_INTERNALLY,
      subjectId: testPost._id,
    });
    assert(prefSuppressedRes.suppressed === true, 'Disabled category notification suppressed by preferences');
    assert(prefSuppressedRes.reason === 'IN_APP_PREFERENCE_DISABLED', 'Reason is IN_APP_PREFERENCE_DISABLED');

    // -------------------------------------------------------------
    console.log('\n--- 5. REST API Endpoints & Cursor Pagination Tests ---');
    // -------------------------------------------------------------

    // 5.1 GET /v1/notifications
    const listRes = await fetch(`${BASE_URL}/v1/notifications?limit=2`, { headers: authHeadersRecipient });
    const listData = await listRes.json();
    assert(listRes.status === 200, 'GET /v1/notifications returns 200 OK');
    assert(Array.isArray(listData.items) && listData.items.length === 2, 'Returns bounded page size (limit: 2)');
    assert(listData.hasMore === true, 'hasMore is true when additional pages exist');
    assert(typeof listData.nextCursor === 'string' && listData.nextCursor.length > 0, 'Opaque nextCursor returned');

    // Page 2
    const listPage2Res = await fetch(`${BASE_URL}/v1/notifications?limit=10&cursor=${listData.nextCursor}`, { headers: authHeadersRecipient });
    const listPage2Data = await listPage2Res.json();
    assert(listPage2Res.status === 200, 'Cursor pagination fetch returns 200 OK');
    assert(Array.isArray(listPage2Data.items) && listPage2Data.items.length > 0, 'Page 2 items returned');

    // 5.2 GET /v1/notifications/unread-count
    const unreadRes = await fetch(`${BASE_URL}/v1/notifications/unread-count`, { headers: authHeadersRecipient });
    const unreadData = await unreadRes.json();
    assert(unreadRes.status === 200, 'GET /v1/notifications/unread-count returns 200 OK');
    assert(unreadData.unreadCount > 0, `Unread count is positive (count: ${unreadData.unreadCount})`);

    // 5.3 PATCH /v1/notifications/:id/read
    const targetNotifId = listData.items[0].id;
    const markReadRes = await fetch(`${BASE_URL}/v1/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: authHeadersRecipient,
    });
    const markReadData = await markReadRes.json();
    assert(markReadRes.status === 200, 'PATCH /v1/notifications/:id/read returns 200 OK');
    assert(markReadData.isRead === true, 'Notification state transitioned to isRead: true');

    // IDOR on markRead
    const idorMarkReadRes = await fetch(`${BASE_URL}/v1/notifications/${targetNotifId}/read`, {
      method: 'PATCH',
      headers: authHeadersActor,
    });
    assert(idorMarkReadRes.status === 404, 'Stranger marking other user notification read returns 404 (IDOR protected)');

    // 5.4 PATCH /v1/notifications/read-all
    const markAllRes = await fetch(`${BASE_URL}/v1/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeadersRecipient,
    });
    const markAllData = await markAllRes.json();
    assert(markAllRes.status === 200, 'PATCH /v1/notifications/read-all returns 200 OK');
    assert(markAllData.unreadCount === 0, 'Unread count becomes 0 after mark-all-read');

    // -------------------------------------------------------------
    console.log('\n--- 6. Notification Preferences API Tests ---');
    // -------------------------------------------------------------

    // 6.1 GET Preferences
    const getPrefRes = await fetch(`${BASE_URL}/v1/users/me/notification-preferences/preferences`, { headers: authHeadersRecipient });
    const getPrefData = await getPrefRes.json();
    assert(getPrefRes.status === 200, 'GET /v1/users/me/notification-preferences returns 200 OK');
    assert(getPrefData.data.likes !== undefined, 'Preferences contain likes category');

    // 6.2 PATCH Preferences
    const patchPrefRes = await fetch(`${BASE_URL}/v1/users/me/notification-preferences/preferences`, {
      method: 'PATCH',
      headers: authHeadersRecipient,
      body: JSON.stringify({
        likes: { inApp: false, push: false },
        pauseAll: true,
      }),
    });
    const patchPrefData = await patchPrefRes.json();
    assert(patchPrefRes.status === 200, 'PATCH /v1/users/me/notification-preferences returns 200 OK');
    assert(patchPrefData.data.likes.inApp === false, 'Likes preference updated to inApp: false');
    assert(patchPrefData.data.pauseAll === true, 'pauseAll updated to true');

    // -------------------------------------------------------------
    console.log('\n--- 7. Device Token Lifecycle & Push Invalidation Tests ---');
    // -------------------------------------------------------------

    // 7.1 Register Device
    const regDeviceRes = await fetch(`${BASE_URL}/v1/devices/devices`, {
      method: 'POST',
      headers: authHeadersRecipient,
      body: JSON.stringify({
        pushToken: `fcm_active_token_${timestamp}`,
        platform: 'ios',
        deviceId: `ios_dev_${timestamp}`,
        appVersion: '2.1.0',
      }),
    });
    const regDeviceData = await regDeviceRes.json();
    assert(regDeviceRes.status === 201, 'POST /v1/devices returns 201 Created');
    assert(regDeviceData.data.status === 'ACTIVE', 'Device token status is ACTIVE');

    // 7.2 Push dispatch with token invalidation
    await Device.create({
      user: recipientUser._id,
      pushToken: 'invalid_token_xyz',
      platform: 'android',
      status: 'ACTIVE',
    });

    const pushDispatchRes = await pushAdapter.sendToUser(recipientUser._id.toString(), {
      title: 'Rubaru',
      body: 'Test push',
    });
    assert(pushDispatchRes.revokedTokens.includes('invalid_token_xyz'), 'Invalid token detected and revoked');

    const revokedDevice = await Device.findOne({ user: recipientUser._id, pushToken: 'invalid_token_xyz' });
    assert(revokedDevice.status === 'REVOKED', 'Device record transitioned to REVOKED');

    // 7.3 Delete Device
    const delDeviceRes = await fetch(`${BASE_URL}/v1/devices/devices/${regDeviceData.data.deviceId}`, {
      method: 'DELETE',
      headers: authHeadersRecipient,
    });
    assert(delDeviceRes.status === 200, 'DELETE /v1/devices/:id returns 200 OK');

    const deletedDevice = await Device.findById(regDeviceData.data.deviceId);
    assert(deletedDevice.status === 'REVOKED', 'Device status revoked on logout/delete');

    console.log('\n===========================================================');
    console.log(`SOCIAL NOTIFICATIONS TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runSocialNotificationTests();
}

module.exports = runSocialNotificationTests;
