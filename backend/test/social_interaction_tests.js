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

// Services & Routes
const safetyService = require('../services/safetyService');
const postRoutes = require('../routes/postRoutes');
const interactionRoutes = require('../routes/interactionRoutes');

async function runSocialInteractionTests() {
  console.log('===========================================================');
  console.log('         RUBARU SOCIAL INTERACTIONS TEST SUITE             ');
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
  app.use('/v1', interactionRoutes);

  const TEST_PORT = 5097;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userAuthor = await User.create({ email: `inter_author_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileAuthor = await Profile.create({ user: userAuthor._id, displayName: 'Interaction Author', dateOfBirth: new Date('1996-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenAuthor = jwt.sign({ id: userAuthor._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthor = { Authorization: `Bearer ${tokenAuthor}`, 'Content-Type': 'application/json' };

    const userViewer = await User.create({ email: `inter_viewer_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileViewer = await Profile.create({ user: userViewer._id, displayName: 'Interaction Viewer', dateOfBirth: new Date('1998-02-02'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenViewer = jwt.sign({ id: userViewer._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersViewer = { Authorization: `Bearer ${tokenViewer}`, 'Content-Type': 'application/json' };

    const userStranger = await User.create({ email: `inter_stranger_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileStranger = await Profile.create({ user: userStranger._id, displayName: 'Stranger User', dateOfBirth: new Date('2000-03-03'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenStranger = jwt.sign({ id: userStranger._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersStranger = { Authorization: `Bearer ${tokenStranger}`, 'Content-Type': 'application/json' };

    // 2. Create Media & Published Post
    const mediaPub = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/inter/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthor._id}/inter/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/inter_med.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/inter/thumb.webp`, url: 'https://cdn.rubaru.app/inter_thumb.webp', width: 300, height: 300 },
    });

    const postDoc = await Content.create({
      authorId: userAuthor._id,
      contentType: 'POST',
      caption: 'Awesome interaction post',
      mediaItems: [{ mediaAssetId: mediaPub._id, position: 0, mediaType: 'IMAGE', variants: mediaPub.variants, thumbnail: mediaPub.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
    });

    const postId = postDoc._id.toString();

    // -------------------------------------------------------------
    // 1. Like and Unlike Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Like & Unlike Tests ---');

    // 1.1 Viewer likes post
    const likeRes = await fetch(`${BASE_URL}/v1/content/${postId}/like`, { method: 'POST', headers: authHeadersViewer });
    const likeData = await likeRes.json();
    assert(likeRes.status === 200, 'POST /v1/content/:id/like returns 200 OK');
    assert(likeData.data.liked === true, 'Response confirms liked: true');
    assert(likeData.data.likesCount === 1, 'likesCount incremented to 1');

    // 1.2 Duplicate like is idempotent
    const dupLikeRes = await fetch(`${BASE_URL}/v1/content/${postId}/like`, { method: 'POST', headers: authHeadersViewer });
    const dupLikeData = await dupLikeRes.json();
    assert(dupLikeRes.status === 200, 'Duplicate like returns 200 OK');
    assert(dupLikeData.data.likesCount === 1, 'likesCount remains 1 (no duplicate increment)');

    // 1.3 Viewer unlikes post
    const unlikeRes = await fetch(`${BASE_URL}/v1/content/${postId}/like`, { method: 'DELETE', headers: authHeadersViewer });
    const unlikeData = await unlikeRes.json();
    assert(unlikeRes.status === 200, 'DELETE /v1/content/:id/like returns 200 OK');
    assert(unlikeData.data.liked === false, 'Response confirms liked: false');
    assert(unlikeData.data.likesCount === 0, 'likesCount decremented to 0');

    // 1.4 Repeated unlike does not decrement below 0
    const repUnlikeRes = await fetch(`${BASE_URL}/v1/content/${postId}/like`, { method: 'DELETE', headers: authHeadersViewer });
    const repUnlikeData = await repUnlikeRes.json();
    assert(repUnlikeData.data.likesCount === 0, 'likesCount never drops below 0');

    // -------------------------------------------------------------
    // 2. Comments & 1-Level Replies Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. Comments & 1-Level Replies Tests ---');

    // 2.1 Empty comment rejected
    const emptyCommentRes = await fetch(`${BASE_URL}/v1/content/${postId}/comments`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({ text: '   ' }),
    });
    assert(emptyCommentRes.status === 400, 'Empty comment text returns 400 Bad Request');

    // 2.2 Create top-level comment (depth 0)
    const comment1Res = await fetch(`${BASE_URL}/v1/content/${postId}/comments`, {
      method: 'POST',
      headers: authHeadersViewer,
      body: JSON.stringify({ text: 'Love this photo!', idempotencyKey: `c1_${timestamp}` }),
    });
    const comment1Data = await comment1Res.json();
    assert(comment1Res.status === 201, 'Valid top-level comment returns 201 Created');
    assert(comment1Data.data.depth === 0, 'Top-level comment depth is 0');
    assert(comment1Data.data.text === 'Love this photo!', 'Comment text matched');

    const comment1Id = comment1Data.data.commentId;

    // Verify post commentsCount is now 1
    const postAfterC1 = await Content.findById(postId);
    assert(postAfterC1.commentsCount === 1, 'Post commentsCount is 1');

    // 2.3 Create 1-level reply (depth 1)
    const reply1Res = await fetch(`${BASE_URL}/v1/content/${postId}/comments`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({ text: 'Thank you so much!', parentCommentId: comment1Id }),
    });
    const reply1Data = await reply1Res.json();
    assert(reply1Res.status === 201, 'Valid 1-level reply returns 201 Created');
    assert(reply1Data.data.depth === 1, 'Reply depth is 1');
    assert(reply1Data.data.parentCommentId === comment1Id, 'Reply references parentCommentId');

    const reply1Id = reply1Data.data.commentId;

    // 2.4 Reply to a reply (depth 2) is strictly rejected (400)
    const nestedReplyRes = await fetch(`${BASE_URL}/v1/content/${postId}/comments`, {
      method: 'POST',
      headers: authHeadersStranger,
      body: JSON.stringify({ text: 'Attempting depth 2', parentCommentId: reply1Id }),
    });
    const nestedReplyData = await nestedReplyRes.json();
    assert(nestedReplyRes.status === 400, 'Depth 2 reply returns 400 Bad Request');
    assert(nestedReplyData.code === 'MAX_REPLY_DEPTH_EXCEEDED', 'Returns MAX_REPLY_DEPTH_EXCEEDED code');

    // 2.5 List top-level comments
    const listCommentsRes = await fetch(`${BASE_URL}/v1/content/${postId}/comments`, { headers: authHeadersViewer });
    const listCommentsData = await listCommentsRes.json();
    assert(listCommentsRes.status === 200, 'GET /v1/content/:id/comments returns 200 OK');
    assert(listCommentsData.data.items.length === 1, 'Returns 1 top-level comment');
    assert(listCommentsData.data.items[0].repliesCount === 1, 'Parent comment reflects repliesCount: 1');

    // 2.6 List comment replies
    const listRepliesRes = await fetch(`${BASE_URL}/v1/comments/${comment1Id}/replies`, { headers: authHeadersViewer });
    const listRepliesData = await listRepliesRes.json();
    assert(listRepliesRes.status === 200, 'GET /v1/comments/:id/replies returns 200 OK');
    assert(listRepliesData.data.items.length === 1, 'Returns 1 reply');
    assert(listRepliesData.data.items[0].commentId === reply1Id, 'Reply ID matches created reply');

    // -------------------------------------------------------------
    // 3. Comment Likes Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Comment Likes Tests ---');

    // 3.1 Like comment
    const likeCommentRes = await fetch(`${BASE_URL}/v1/comments/${comment1Id}/like`, { method: 'POST', headers: authHeadersAuthor });
    const likeCommentData = await likeCommentRes.json();
    assert(likeCommentRes.status === 200, 'POST /v1/comments/:id/like returns 200 OK');
    assert(likeCommentData.data.liked === true, 'Comment liked: true');
    assert(likeCommentData.data.likesCount === 1, 'Comment likesCount: 1');

    // 3.2 Unlike comment
    const unlikeCommentRes = await fetch(`${BASE_URL}/v1/comments/${comment1Id}/like`, { method: 'DELETE', headers: authHeadersAuthor });
    const unlikeCommentData = await unlikeCommentRes.json();
    assert(unlikeCommentRes.status === 200, 'DELETE /v1/comments/:id/like returns 200 OK');
    assert(unlikeCommentData.data.liked === false, 'Comment liked: false');
    assert(unlikeCommentData.data.likesCount === 0, 'Comment likesCount: 0');

    // -------------------------------------------------------------
    // 4. Comment Deletion & Tombstone Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Comment Deletion & Tombstone Tests ---');

    // 4.1 Stranger cannot delete Viewer's comment
    const strangerDelRes = await fetch(`${BASE_URL}/v1/comments/${comment1Id}`, { method: 'DELETE', headers: authHeadersStranger });
    assert(strangerDelRes.status === 403, 'Stranger deleting another comment returns 403 Forbidden');

    // 4.2 Viewer deletes parent comment (which has replies) -> Tombstone preserved
    const delParentRes = await fetch(`${BASE_URL}/v1/comments/${comment1Id}`, { method: 'DELETE', headers: authHeadersViewer });
    assert(delParentRes.status === 200, 'Owner deletes comment returns 200 OK');

    // Verify parent comment is now a tombstone [deleted] in listing
    const listAfterDelRes = await fetch(`${BASE_URL}/v1/content/${postId}/comments`, { headers: authHeadersStranger });
    const listAfterDelData = await listAfterDelRes.json();
    assert(listAfterDelData.data.items.length === 1, 'Tombstone comment remains in list');
    assert(listAfterDelData.data.items[0].text === '[deleted]', 'Text is redacted to [deleted]');
    assert(listAfterDelData.data.items[0].status === 'DELETED', 'Status is DELETED');

    // -------------------------------------------------------------
    // 5. Private Saves & Saved Content List Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Private Saves & Saved Content List Tests ---');

    // 5.1 Viewer saves post
    const saveRes = await fetch(`${BASE_URL}/v1/content/${postId}/save`, { method: 'POST', headers: authHeadersViewer });
    const saveData = await saveRes.json();
    assert(saveRes.status === 200, 'POST /v1/content/:id/save returns 200 OK');
    assert(saveData.data.saved === true, 'Response confirms saved: true');

    // 5.2 Viewer lists saved content -> includes post
    const getSavedRes = await fetch(`${BASE_URL}/v1/users/me/saved-content`, { headers: authHeadersViewer });
    const getSavedData = await getSavedRes.json();
    assert(getSavedRes.status === 200, 'GET /v1/users/me/saved-content returns 200 OK');
    assert(getSavedData.data.items.length === 1, 'Saved items contains 1 post');
    assert(getSavedData.data.items[0].postId === postId, 'Saved post ID matches');

    // 5.3 Author blocks Viewer -> Saved post is dynamically re-authorized and excluded
    await safetyService.blockUser(userAuthor._id, userViewer._id, { reason: 'TEST_SAVE_REVOCATION' });

    const getSavedBlockedRes = await fetch(`${BASE_URL}/v1/users/me/saved-content`, { headers: authHeadersViewer });
    const getSavedBlockedData = await getSavedBlockedRes.json();
    assert(getSavedBlockedRes.status === 200, 'Saved content query returns 200 OK');
    assert(getSavedBlockedData.data.items.length === 0, 'Blocked author post is automatically excluded from saved content');

    // -------------------------------------------------------------
    // 6. Share Event & Not Interested Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Share Event & Not Interested Tests ---');

    // 6.1 Stranger shares post via COPY_LINK
    const shareRes = await fetch(`${BASE_URL}/v1/content/${postId}/share`, {
      method: 'POST',
      headers: authHeadersStranger,
      body: JSON.stringify({ destinationType: 'COPY_LINK' }),
    });
    const shareData = await shareRes.json();
    assert(shareRes.status === 200, 'POST /v1/content/:id/share returns 200 OK');
    assert(shareData.data.shared === true, 'Response confirms shared: true');
    assert(shareData.data.sharesCount === 1, 'sharesCount incremented to 1');

    // 6.2 Stranger marks post not interested
    const notIntRes = await fetch(`${BASE_URL}/v1/content/${postId}/not-interested`, { method: 'POST', headers: authHeadersStranger });
    const notIntData = await notIntRes.json();
    assert(notIntRes.status === 200, 'POST /v1/content/:id/not-interested returns 200 OK');
    assert(notIntData.data.notInterested === true, 'Response confirms notInterested: true');

    // 6.3 Stranger unmarks not interested
    const unNotIntRes = await fetch(`${BASE_URL}/v1/content/${postId}/not-interested`, { method: 'DELETE', headers: authHeadersStranger });
    const unNotIntData = await unNotIntRes.json();
    assert(unNotIntRes.status === 200, 'DELETE /v1/content/:id/not-interested returns 200 OK');
    assert(unNotIntData.data.notInterested === false, 'Response confirms notInterested: false');

    console.log('\n===========================================================');
    console.log(`SOCIAL INTERACTIONS TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runSocialInteractionTests();
}

module.exports = runSocialInteractionTests;
