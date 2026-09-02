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
const MediaAsset = require('../models/MediaAsset');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');
const Report = require('../models/Report');
const ModerationCase = require('../models/ModerationCase');
const ModerationEvidenceSnapshot = require('../models/ModerationEvidenceSnapshot');
const ModerationAuditLog = require('../models/ModerationAuditLog');
const ReporterSuppression = require('../models/ReporterSuppression');

// Services & Routes
const safetyRoutes = require('../routes/safetyRoutes');
const postRoutes = require('../routes/postRoutes');
const socialPolicyService = require('../services/socialPolicyService');

async function runSocialSafetyModerationTests() {
  console.log('===========================================================');
  console.log('    RUBARU SOCIAL CONTENT SAFETY & MODERATION TESTS        ');
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
  app.use('/v1', safetyRoutes);
  app.use('/v1', postRoutes);

  const TEST_PORT = 5098;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

  try {
    const timestamp = Date.now();

    // 1. Create Test Users
    const userAuthor = await User.create({ email: `mod_author_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userAuthor._id, displayName: 'Author Alice', dateOfBirth: new Date('1997-01-01'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenAuthor = jwt.sign({ id: userAuthor._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersAuthor = { Authorization: `Bearer ${tokenAuthor}`, 'Content-Type': 'application/json' };

    const userReporter = await User.create({ email: `mod_reporter_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userReporter._id, displayName: 'Reporter Bob', dateOfBirth: new Date('1998-02-02'), gender: 'Male', socialAccountVisibility: 'PUBLIC' });
    const tokenReporter = jwt.sign({ id: userReporter._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersReporter = { Authorization: `Bearer ${tokenReporter}`, 'Content-Type': 'application/json' };

    const userModerator = await User.create({ email: `mod_staff_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    await Profile.create({ user: userModerator._id, displayName: 'Moderator Mary', dateOfBirth: new Date('1995-03-03'), gender: 'Female', socialAccountVisibility: 'PUBLIC' });
    const tokenModerator = jwt.sign({ id: userModerator._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersModerator = { Authorization: `Bearer ${tokenModerator}`, 'Content-Type': 'application/json' };

    // 2. Create Media Asset & Content Subjects
    const testMedia = await MediaAsset.create({
      ownerId: userAuthor._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose: 'POST_MEDIA',
      mediaType: 'IMAGE',
      originalObjectKey: `media/test/${userAuthor._id}/orig.jpg`,
      originalMimeType: 'image/jpeg',
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
      variants: [{ name: 'standard', objectKey: `media/test/${userAuthor._id}/std.webp`, mimeType: 'image/webp', width: 1080, height: 1080, url: 'https://cdn.rubaru.app/std.webp' }],
      thumbnail: { objectKey: `media/test/${userAuthor._id}/thumb.webp`, url: 'https://cdn.rubaru.app/thumb.webp', width: 300, height: 300 },
    });

    const testPost = await Content.create({
      authorId: userAuthor._id,
      contentType: 'POST',
      caption: 'Suspicious post with offensive language',
      mediaItems: [{ mediaAssetId: testMedia._id, position: 0, mediaType: 'IMAGE', variants: testMedia.variants, thumbnail: testMedia.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      publishedAt: new Date(),
    });

    const testStory = await Content.create({
      authorId: userAuthor._id,
      contentType: 'STORY',
      caption: 'Ephemeral violent story threat',
      mediaItems: [{ mediaAssetId: testMedia._id, position: 0, mediaType: 'IMAGE', variants: testMedia.variants, thumbnail: testMedia.thumbnail }],
      audience: 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      publishedAt: new Date(),
    });

    const testComment = await Comment.create({
      contentId: testPost._id,
      authorId: userAuthor._id,
      text: 'Offensive comment under post',
      status: 'ACTIVE',
    });

    // -------------------------------------------------------------
    // 1. Social Content & Comment Reporting Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. Social Reporting Tests ---');

    // 1.1 Report Post
    const repPostRes = await fetch(`${BASE_URL}/v1/content/${testPost._id}/report`, {
      method: 'POST',
      headers: authHeadersReporter,
      body: JSON.stringify({
        reasonCode: 'HARASSMENT_OR_BULLYING',
        description: 'Bullying content targeting me',
        sourceSurface: 'FEED',
      }),
    });
    const repPostData = await repPostRes.json();
    assert(repPostRes.status === 200, 'POST /v1/content/:id/report returns 200 OK');
    assert(repPostData.success === true, 'Report submission successful');
    assert(typeof repPostData.data.caseNumber === 'string', 'Moderation case created and caseNumber returned');

    const createdReportId = repPostData.data.reportId;

    // 1.2 Self-Report Disallowed
    const selfRepRes = await fetch(`${BASE_URL}/v1/content/${testPost._id}/report`, {
      method: 'POST',
      headers: authHeadersAuthor,
      body: JSON.stringify({ reasonCode: 'SPAM' }),
    });
    assert(selfRepRes.status === 400, 'Reject self-report on own content (400)');

    // 1.3 Report Story (Critical Escalation)
    const repStoryRes = await fetch(`${BASE_URL}/v1/content/${testStory._id}/report`, {
      method: 'POST',
      headers: authHeadersReporter,
      body: JSON.stringify({
        reasonCode: 'VIOLENCE_OR_THREATS',
        description: 'Threatening violence',
      }),
    });
    const repStoryData = await repStoryRes.json();
    assert(repStoryRes.status === 200, 'Report Story returns 200 OK');

    const storyCase = await ModerationCase.findOne({ subjectId: testStory._id });
    assert(storyCase !== null, 'Story moderation case persisted');
    assert(storyCase.priority === 'CRITICAL', 'Threat category escalated priority to CRITICAL');

    // 1.4 Report Comment
    const repCommRes = await fetch(`${BASE_URL}/v1/comments/${testComment._id}/report`, {
      method: 'POST',
      headers: authHeadersReporter,
      body: JSON.stringify({ reasonCode: 'HATE_OR_DISCRIMINATION' }),
    });
    assert(repCommRes.status === 200, 'Report Comment returns 200 OK');

    // -------------------------------------------------------------
    // 2. Duplicate Report Protection
    // -------------------------------------------------------------
    console.log('\n--- 2. Duplicate Report Protection Tests ---');

    const dupRepRes = await fetch(`${BASE_URL}/v1/content/${testPost._id}/report`, {
      method: 'POST',
      headers: authHeadersReporter,
      body: JSON.stringify({
        reasonCode: 'HARASSMENT_OR_BULLYING',
        description: 'Repeated identical report',
      }),
    });
    const dupRepData = await dupRepRes.json();
    assert(dupRepRes.status === 200, 'Duplicate report returns 200 OK');
    assert(dupRepData.data.duplicate === true, 'Duplicate report flagged idempotent (duplicate: true)');
    assert(dupRepData.data.reportId === createdReportId, 'Duplicate returns existing report ID');

    // -------------------------------------------------------------
    // 3. Immediate Reporter Suppression Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Immediate Reporter Suppression Tests ---');

    // 3.1 Verify Suppression Record Persisted
    const suppressionDoc = await ReporterSuppression.findOne({
      reporterId: userReporter._id,
      subjectId: testPost._id,
    });
    assert(suppressionDoc !== null, 'ReporterSuppression record created immediately');

    // 3.2 Single Evaluation Policy: Content Suppressed for Reporter
    const repAccess = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userReporter._id,
      contentDoc: testPost,
    });
    assert(repAccess.allowed === false, 'Reported post suppressed from reporter single view');
    assert(repAccess.reasonCode === 'SUPPRESSED', 'Reason code is SUPPRESSED');

    // 3.3 Single Evaluation Policy: Unrelated Viewer Still Allowed
    const otherAccess = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userModerator._id,
      contentDoc: testPost,
    });
    assert(otherAccess.allowed === true, 'Reported post still accessible to other viewers before decision');

    // 3.4 Batch Evaluation Policy: Excluded for Reporter
    const batchAccess = await socialPolicyService.batchEvaluateContentAccess({
      viewerId: userReporter._id,
      contentDocs: [testPost],
    });
    assert(batchAccess[0].allowed === false, 'Batch evaluation excludes suppressed post for reporter');
    assert(batchAccess[0].reasonCode === 'SUPPRESSED', 'Batch evaluation reason is SUPPRESSED');

    // -------------------------------------------------------------
    // 4. Evidence Snapshot Preservation Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Evidence Snapshot Preservation Tests ---');

    const snapshot = await ModerationEvidenceSnapshot.findOne({ subjectId: testPost._id });
    assert(snapshot !== null, 'Evidence snapshot created at report time');
    assert(snapshot.contentSnapshot.caption === 'Suspicious post with offensive language', 'Original caption preserved');
    assert(snapshot.contentSnapshot.mediaAssetIds.length === 1, 'Media asset IDs recorded in snapshot');
    assert(typeof snapshot.checksum === 'string', 'Evidence SHA-256 checksum generated');

    // Mutate original content (author tries to cover tracks)
    testPost.caption = 'Innocent edited text';
    await testPost.save();

    const snapshotAfterEdit = await ModerationEvidenceSnapshot.findOne({ subjectId: testPost._id });
    assert(snapshotAfterEdit.contentSnapshot.caption === 'Suspicious post with offensive language', 'Evidence snapshot immune to subsequent author edits');

    // -------------------------------------------------------------
    // 5. Moderation Queue, Assignment & Decision Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Moderation Queue & Decision Tests ---');

    // 5.1 List Cases
    const casesRes = await fetch(`${BASE_URL}/v1/admin/moderation/cases?limit=100`, { headers: authHeadersModerator });
    const casesData = await casesRes.json();
    assert(casesRes.status === 200, 'GET /v1/admin/moderation/cases returns 200 OK');
    assert(Array.isArray(casesData.data) && casesData.data.length >= 2, 'Moderation cases list returned');
    assert(casesData.data[0].priority === 'CRITICAL', 'Cases sorted by priority (CRITICAL first)');

    const targetCaseDoc = await ModerationCase.findOne({ subjectId: testPost._id });
    const targetCaseId = targetCaseDoc._id.toString();

    // 5.2 Case Detail & Evidence Access
    const detailRes = await fetch(`${BASE_URL}/v1/admin/moderation/cases/${targetCaseId}`, { headers: authHeadersModerator });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200, 'GET /v1/admin/moderation/cases/:id returns 200 OK');
    assert(detailData.data.evidenceSnapshots.length >= 1, 'Evidence snapshots loaded in case detail');

    // Verify audit log for evidence access
    const auditAccess = await ModerationAuditLog.findOne({ caseId: targetCaseId, action: 'EVIDENCE_ACCESSED' });
    assert(auditAccess !== null, 'Evidence access audited in ModerationAuditLog');

    // 5.3 Assign Case to Moderator
    const assignRes = await fetch(`${BASE_URL}/v1/admin/moderation/cases/${targetCaseId}/assign`, {
      method: 'POST',
      headers: authHeadersModerator,
    });
    const assignData = await assignRes.json();
    assert(assignRes.status === 200, 'POST /v1/admin/moderation/cases/:id/assign returns 200 OK');
    assert(assignData.data.status === 'IN_REVIEW', 'Case status updated to IN_REVIEW');

    // 5.4 Apply Moderation Decision: HIDE
    const decisionRes = await fetch(`${BASE_URL}/v1/admin/moderation/cases/${targetCaseId}/decision`, {
      method: 'POST',
      headers: authHeadersModerator,
      body: JSON.stringify({
        decision: 'HIDE',
        decisionReasonCode: 'HARASSMENT_CONFIRMED',
        internalNotes: 'Confirmed harassment violation, hiding content.',
      }),
    });
    const decisionData = await decisionRes.json();
    assert(decisionRes.status === 200, 'POST /v1/admin/moderation/cases/:id/decision returns 200 OK');
    assert(decisionData.data.decision === 'HIDE', 'Decision HIDE applied');
    assert(decisionData.data.status === 'RESOLVED', 'Case resolved');

    // Verify Content mutation: Hidden & Rejected
    const hiddenPost = await Content.findById(testPost._id);
    assert(hiddenPost.status === 'HIDDEN', 'Content status transitioned to HIDDEN');
    assert(hiddenPost.moderationStatus === 'REJECTED', 'Content moderationStatus transitioned to REJECTED');

    // Verify Hidden Content now denied to ALL ordinary viewers
    const postAccessAfterHide = await socialPolicyService.evaluateSocialContentAccess({
      viewerId: userModerator._id,
      contentDoc: hiddenPost,
    });
    assert(postAccessAfterHide.allowed === false, 'Hidden content inaccessible to ordinary viewers');

    // 5.5 Apply Moderation Decision: RESTORE
    const restoreRes = await fetch(`${BASE_URL}/v1/admin/moderation/cases/${targetCaseId}/decision`, {
      method: 'POST',
      headers: authHeadersModerator,
      body: JSON.stringify({
        decision: 'RESTORE',
        decisionReasonCode: 'FALSE_POSITIVE_APPEAL',
        internalNotes: 'Re-evaluated, restoring content.',
      }),
    });
    assert(restoreRes.status === 200, 'RESTORE decision applied successfully');
    const restoredPost = await Content.findById(testPost._id);
    assert(restoredPost.status === 'PUBLISHED', 'Content status restored to PUBLISHED');
    assert(restoredPost.moderationStatus === 'APPROVED', 'Content moderationStatus restored to APPROVED');

    // -------------------------------------------------------------
    // 6. Report and Block Integration Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. Report and Block Integration Tests ---');

    const userVictim = await User.create({ email: `mod_victim_${timestamp}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const tokenVictim = jwt.sign({ id: userVictim._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const authHeadersVictim = { Authorization: `Bearer ${tokenVictim}`, 'Content-Type': 'application/json' };

    const repBlockRes = await fetch(`${BASE_URL}/v1/users/${userAuthor._id}/report`, {
      method: 'POST',
      headers: authHeadersVictim,
      body: JSON.stringify({
        reasonCode: 'HARASSMENT_OR_BULLYING',
        description: 'Report and block author',
        blockUser: true,
      }),
    });
    assert(repBlockRes.status === 200, 'Report and block user returns 200 OK');

    const blockRecord = await Block.findOne({ blocker: userVictim._id, blocked: userAuthor._id });
    assert(blockRecord !== null, 'Block record created atomically with report');

    console.log('\n===========================================================');
    console.log(`SOCIAL SAFETY & MODERATION TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await new Promise((r) => server.close(r));
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runSocialSafetyModerationTests();
}

module.exports = runSocialSafetyModerationTests;
