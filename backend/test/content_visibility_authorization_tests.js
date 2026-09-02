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

// Services & Routes & Serializers
const socialPolicyService = require('../services/socialPolicyService');
const safetyService = require('../services/safetyService');
const { serializeContentForViewer } = require('../utils/contentSerializers');
const postRoutes = require('../routes/postRoutes');
const mediaRoutes = require('../routes/mediaRoutes');

async function runContentVisibilityAuthorizationTests() {
  console.log('===========================================================');
  console.log('   RUBARU CENTRALIZED CONTENT VISIBILITY & AUTH TEST SUITE  ');
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
  app.use('/v1/media', mediaRoutes);

  const TEST_PORT = 5099;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userAuthorPub = await User.create({ email: `auth_pub_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileAuthorPub = await Profile.create({ user: userAuthorPub._id, displayName: 'Public Author', dateOfBirth: new Date('1996-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenAuthorPub = jwt.sign({ id: userAuthorPub._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthorPub = { Authorization: `Bearer ${tokenAuthorPub}`, 'Content-Type': 'application/json' };

    const userAuthorPriv = await User.create({ email: `auth_priv_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileAuthorPriv = await Profile.create({ user: userAuthorPriv._id, displayName: 'Private Author', dateOfBirth: new Date('1997-02-02'), gender: 'Male', socialAccountVisibility: 'PRIVATE' });
    const tokenAuthorPriv = jwt.sign({ id: userAuthorPriv._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthorPriv = { Authorization: `Bearer ${tokenAuthorPriv}`, 'Content-Type': 'application/json' };

    const userFollower = await User.create({ email: `follower_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileFollower = await Profile.create({ user: userFollower._id, displayName: 'Accepted Follower', dateOfBirth: new Date('1998-03-03'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenFollower = jwt.sign({ id: userFollower._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersFollower = { Authorization: `Bearer ${tokenFollower}`, 'Content-Type': 'application/json' };

    const userStranger = await User.create({ email: `stranger_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileStranger = await Profile.create({ user: userStranger._id, displayName: 'Stranger User', dateOfBirth: new Date('2000-04-04'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenStranger = jwt.sign({ id: userStranger._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersStranger = { Authorization: `Bearer ${tokenStranger}`, 'Content-Type': 'application/json' };

    const userBlocked = await User.create({ email: `blocked_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const profileBlocked = await Profile.create({ user: userBlocked._id, displayName: 'Blocked User', dateOfBirth: new Date('2001-05-05'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenBlocked = jwt.sign({ id: userBlocked._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersBlocked = { Authorization: `Bearer ${tokenBlocked}`, 'Content-Type': 'application/json' };

    // Establish Follows
    await FollowRelationship.create({ followerId: userFollower._id, followingId: userAuthorPub._id, status: 'ACCEPTED', acceptedAt: new Date() });
    await FollowRelationship.create({ followerId: userFollower._id, followingId: userAuthorPriv._id, status: 'ACCEPTED', acceptedAt: new Date() });

    // Establish Block
    await safetyService.blockUser(userAuthorPub._id, userBlocked._id, { reason: 'POLICY_TEST_BLOCK' });

    // 2. Create Media Assets
    const mediaPub = await MediaAsset.create({
      ownerId: userAuthorPub._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthorPub._id}/pub/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthorPub._id}/pub/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/pub_med.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthorPub._id}/pub/thumb.webp`, url: 'https://cdn.rubaru.app/pub_thumb.webp', width: 300, height: 300 },
    });

    const mediaFollowersOnly = await MediaAsset.create({
      ownerId: userAuthorPub._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthorPub._id}/fol/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthorPub._id}/fol/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/fol_med.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthorPub._id}/fol/thumb.webp`, url: 'https://cdn.rubaru.app/fol_thumb.webp', width: 300, height: 300 },
    });

    const mediaPriv = await MediaAsset.create({
      ownerId: userAuthorPriv._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthorPriv._id}/priv/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthorPriv._id}/priv/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/priv_med.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthorPriv._id}/priv/thumb.webp`, url: 'https://cdn.rubaru.app/priv_thumb.webp', width: 300, height: 300 },
    });

    const mediaArchived = await MediaAsset.create({
      ownerId: userAuthorPub._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthorPub._id}/arch/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthorPub._id}/arch/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/arch_med.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthorPub._id}/arch/thumb.webp`, url: 'https://cdn.rubaru.app/arch_thumb.webp', width: 300, height: 300 },
    });

    const mediaRejected = await MediaAsset.create({
      ownerId: userAuthorPub._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthorPub._id}/rej/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthorPub._id}/rej/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/rej_med.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthorPub._id}/rej/thumb.webp`, url: 'https://cdn.rubaru.app/rej_thumb.webp', width: 300, height: 300 },
    });

    const mediaUnbound = await MediaAsset.create({
      ownerId: userAuthorPub._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthorPub._id}/unbound/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'medium', objectKey: `media/test/${userAuthorPub._id}/unbound/med.webp`, mimeType: 'image/webp', width: 1080, height: 1350, url: 'https://cdn.rubaru.app/unbound_med.webp' }],
    });

    // 3. Create Posts
    const postPub = await Content.create({
      authorId: userAuthorPub._id,
      contentType: 'POST',
      caption: 'Public post by public author',
      mediaItems: [{ mediaAssetId: mediaPub._id, position: 0, mediaType: 'IMAGE', variants: mediaPub.variants, thumbnail: mediaPub.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
    });

    const postFollowersOnly = await Content.create({
      authorId: userAuthorPub._id,
      contentType: 'POST',
      caption: 'Followers only post by public author',
      mediaItems: [{ mediaAssetId: mediaFollowersOnly._id, position: 0, mediaType: 'IMAGE', variants: mediaFollowersOnly.variants, thumbnail: mediaFollowersOnly.thumbnail }],
      audience: 'FOLLOWERS',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
    });

    const postPrivAuthor = await Content.create({
      authorId: userAuthorPriv._id,
      contentType: 'POST',
      caption: 'Post by private author',
      mediaItems: [{ mediaAssetId: mediaPriv._id, position: 0, mediaType: 'IMAGE', variants: mediaPriv.variants, thumbnail: mediaPriv.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
    });

    const postArchived = await Content.create({
      authorId: userAuthorPub._id,
      contentType: 'POST',
      caption: 'Archived post',
      mediaItems: [{ mediaAssetId: mediaArchived._id, position: 0, mediaType: 'IMAGE', variants: mediaArchived.variants, thumbnail: mediaArchived.thumbnail }],
      status: 'ARCHIVED',
    });

    const postRejected = await Content.create({
      authorId: userAuthorPub._id,
      contentType: 'POST',
      caption: 'Rejected moderation post',
      mediaItems: [{ mediaAssetId: mediaRejected._id, position: 0, mediaType: 'IMAGE', variants: mediaRejected.variants, thumbnail: mediaRejected.thumbnail }],
      status: 'PUBLISHED',
      moderationStatus: 'REJECTED',
    });

    // -------------------------------------------------------------
    // 1. Central Policy Table-Driven Matrix Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Central Policy Table-Driven Matrix Tests ---');

    // Matrix Evaluation
    const evalOwner = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userAuthorPub._id, contentDoc: postPub });
    assert(evalOwner.allowed === true && evalOwner.reasonCode === 'OWNER', 'Owner has OWNER level access to post');

    const evalPubStranger = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userStranger._id, contentDoc: postPub });
    assert(evalPubStranger.allowed === true && evalPubStranger.reasonCode === 'PUBLIC', 'Stranger has PUBLIC access to public post');

    const evalFolStranger = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userStranger._id, contentDoc: postFollowersOnly });
    assert(evalFolStranger.allowed === false && evalFolStranger.reasonCode === 'AUDIENCE_DENIED', 'Stranger denied access to followers-only post');

    const evalFolFollower = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userFollower._id, contentDoc: postFollowersOnly });
    assert(evalFolFollower.allowed === true && evalFolFollower.reasonCode === 'ACCEPTED_FOLLOWER', 'Follower allowed access to followers-only post');

    const evalPrivStranger = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userStranger._id, contentDoc: postPrivAuthor });
    assert(evalPrivStranger.allowed === false && evalPrivStranger.reasonCode === 'PRIVATE_ACCOUNT', 'Stranger denied access to private author post');

    const evalPrivFollower = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userFollower._id, contentDoc: postPrivAuthor });
    assert(evalPrivFollower.allowed === true && evalPrivFollower.reasonCode === 'ACCEPTED_FOLLOWER', 'Follower allowed access to private author post');

    const evalBlocked = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userBlocked._id, contentDoc: postPub });
    assert(evalBlocked.allowed === false && evalBlocked.reasonCode === 'BLOCKED', 'Blocked user denied access to author posts');

    const evalArchivedStranger = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userStranger._id, contentDoc: postArchived });
    assert(evalArchivedStranger.allowed === false && evalArchivedStranger.reasonCode === 'CONTENT_UNAVAILABLE', 'Stranger denied access to archived post');

    const evalArchivedOwner = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userAuthorPub._id, contentDoc: postArchived });
    assert(evalArchivedOwner.allowed === true && evalArchivedOwner.reasonCode === 'OWNER', 'Owner allowed access to own archived post');

    const evalRejectedStranger = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userStranger._id, contentDoc: postRejected });
    assert(evalRejectedStranger.allowed === false && evalRejectedStranger.reasonCode === 'MODERATION_RESTRICTED', 'Stranger denied access to moderation rejected post');

    // -------------------------------------------------------------
    // 2. Batch Authorization Tests (List Operations)
    // -------------------------------------------------------------
    console.log('\n--- 2. Batch Authorization Tests ---');

    const testBatchDocs = [postPub, postFollowersOnly, postPrivAuthor, postArchived, postRejected];

    // Stranger evaluation across batch
    const batchStranger = await socialPolicyService.batchEvaluateContentAccess({ viewerId: userStranger._id, contentDocs: testBatchDocs });
    const allowedStrangerIds = batchStranger.filter((b) => b.allowed).map((b) => b.contentDoc._id.toString());
    assert(allowedStrangerIds.length === 1 && allowedStrangerIds[0] === postPub._id.toString(), 'Batch evaluation correctly permits ONLY public post for stranger');

    // Follower evaluation across batch
    const batchFollower = await socialPolicyService.batchEvaluateContentAccess({ viewerId: userFollower._id, contentDocs: testBatchDocs });
    const allowedFollowerIds = batchFollower.filter((b) => b.allowed).map((b) => b.contentDoc._id.toString());
    assert(allowedFollowerIds.length === 3, 'Batch evaluation permits 3 posts (Public, FollowersOnly, PrivateAuthor) for follower');

    // -------------------------------------------------------------
    // 3. Media Delivery Authorization Endpoint Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Media Delivery Authorization Endpoint Tests ---');

    // 3.1 Stranger accesses public post media -> 200 OK
    const mediaPubRes = await fetch(`${BASE_URL}/v1/media/${mediaPub._id}/access?variant=medium`, { headers: authHeadersStranger });
    const mediaPubData = await mediaPubRes.json();
    assert(mediaPubRes.status === 200, 'Stranger accessing public post media returns 200 OK', JSON.stringify(mediaPubData));
    assert(typeof mediaPubData.data?.url === 'string', 'Returns safe delivery URL');

    // 3.2 Stranger accesses followers-only post media -> 403 Forbidden
    const mediaFolDeniedRes = await fetch(`${BASE_URL}/v1/media/${mediaFollowersOnly._id}/access?variant=medium`, { headers: authHeadersStranger });
    assert(mediaFolDeniedRes.status === 403, 'Stranger accessing followers-only media returns 403 Forbidden');

    // 3.3 Accepted Follower accesses followers-only post media -> 200 OK
    const mediaFolAllowedRes = await fetch(`${BASE_URL}/v1/media/${mediaFollowersOnly._id}/access?variant=medium`, { headers: authHeadersFollower });
    assert(mediaFolAllowedRes.status === 200, 'Accepted follower accessing followers-only media returns 200 OK');

    // 3.4 Stranger accesses unbound draft media -> 403 Forbidden
    const mediaUnboundStrangerRes = await fetch(`${BASE_URL}/v1/media/${mediaUnbound._id}/access?variant=medium`, { headers: authHeadersStranger });
    assert(mediaUnboundStrangerRes.status === 403, 'Stranger accessing unbound media returns 403 Forbidden');

    // 3.5 Owner accesses unbound draft media -> 200 OK
    const mediaUnboundOwnerRes = await fetch(`${BASE_URL}/v1/media/${mediaUnbound._id}/access?variant=medium`, { headers: authHeadersAuthorPub });
    assert(mediaUnboundOwnerRes.status === 200, 'Owner accessing unbound media returns 200 OK');

    // -------------------------------------------------------------
    // 4. Safe Serialization & Leakage Prevention Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Safe Serialization & Leakage Prevention Tests ---');

    const serializedPublic = serializeContentForViewer(postPub, profileAuthorPub, 'PUBLIC');
    assert(serializedPublic.originalObjectKey === undefined, 'Serialized projection does NOT leak originalObjectKey');
    assert(serializedPublic.bucket === undefined, 'Serialized projection does NOT leak bucket');
    assert(serializedPublic.uploadSessionId === undefined, 'Serialized projection does NOT leak uploadSessionId');
    assert(serializedPublic.author.email === undefined, 'Serialized author summary does NOT leak email');
    assert(serializedPublic.author.phone === undefined, 'Serialized author summary does NOT leak phone');

    // -------------------------------------------------------------
    // 5. Dynamic Revocation Lifecycle Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Dynamic Revocation Lifecycle Tests ---');

    // Setup: Follower unfollows Private Author
    await FollowRelationship.updateOne({ followerId: userFollower._id, followingId: userAuthorPriv._id }, { $set: { status: 'REMOVED' } });

    // Follower re-evaluates access to Private Author post -> 403 Forbidden immediately
    const evalRevokedFollow = await socialPolicyService.evaluateSocialContentAccess({ viewerId: userFollower._id, contentDoc: postPrivAuthor });
    assert(evalRevokedFollow.allowed === false && evalRevokedFollow.reasonCode === 'PRIVATE_ACCOUNT', 'Follow removal immediately revokes content access');

    console.log('\n===========================================================');
    console.log(`CONTENT VISIBILITY TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runContentVisibilityAuthorizationTests();
}

module.exports = runContentVisibilityAuthorizationTests;
