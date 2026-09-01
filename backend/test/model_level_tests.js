require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models & Enums
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Block = require('../models/Block');
const Report = require('../models/Report');
const ProfileImpression = require('../models/ProfileImpression');
const RecommendationBatch = require('../models/RecommendationBatch');
const OutboxEvent = require('../models/OutboxEvent');
const UserEntitlement = require('../models/UserEntitlement');
const { InteractionTypes, InteractionStatuses, Genders } = require('../models/enums');

async function validateAsync(doc) {
  try {
    await doc.validate();
    return null;
  } catch (err) {
    return err;
  }
}

async function runModelTests() {
  console.log('===========================================================');
  console.log('       RUBARU DATING CORE MODEL-LEVEL TEST SUITE           ');
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

  // Create temporary mock test user IDs
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();

  try {
    // -------------------------------------------------------------
    // 1. DatingPreference Tests
    // -------------------------------------------------------------
    console.log('\n--- 1. DatingPreference Model Tests ---');
    
    // 1.1 Valid preference
    const validPref = new DatingPreference({
      user: userAId,
      version: 1,
      genderPreference: [Genders.FEMALE, Genders.MALE],
      ageRange: { min: 21, max: 30, isDealbreaker: true },
      maxDistanceKm: 45,
    });
    const validPrefErr = await validateAsync(validPref);
    assert(!validPrefErr, 'Valid DatingPreference passes validation');

    // 1.2 Invalid age range (min > max)
    const invalidAgePref = new DatingPreference({
      user: userAId,
      genderPreference: [Genders.FEMALE],
      ageRange: { min: 35, max: 25 },
    });
    const invalidAgeErr = await validateAsync(invalidAgePref);
    assert(
      invalidAgeErr && invalidAgeErr.message.includes('Minimum age cannot be greater than maximum age'),
      'Invalid age range (min > max) is rejected by schema validator'
    );

    // 1.3 Invalid distance (< 1 or > 500)
    const invalidDistPref = new DatingPreference({
      user: userAId,
      maxDistanceKm: 600,
    });
    const invalidDistErr = await validateAsync(invalidDistPref);
    assert(invalidDistErr && invalidDistErr.errors.maxDistanceKm, 'Distance > 500 km is rejected');

    // -------------------------------------------------------------
    // 2. UserLocation Tests
    // -------------------------------------------------------------
    console.log('\n--- 2. UserLocation Model Tests ---');

    // 2.1 Valid GeoJSON Point
    const validLoc = new UserLocation({
      user: userAId,
      location: {
        type: 'Point',
        coordinates: [75.7873, 26.9124], // Jaipur [lng, lat]
      },
      city: 'Jaipur',
    });
    const validLocErr = await validateAsync(validLoc);
    assert(!validLocErr, 'Valid GeoJSON Point passes validation');

    // 2.2 Invalid coordinates (latitude > 90)
    const invalidLatLoc = new UserLocation({
      user: userAId,
      location: {
        type: 'Point',
        coordinates: [75.7873, 126.9124], // Lat > 90
      },
    });
    const invalidLatErr = await validateAsync(invalidLatLoc);
    assert(
      invalidLatErr && invalidLatErr.errors['location.coordinates'],
      'Out-of-bounds coordinates (Lat > 90) rejected by validator'
    );

    // 2.3 2dsphere index exists in schema
    const indexes = UserLocation.schema.indexes();
    const has2dSphere = indexes.some((idx) => idx[0].location === '2dsphere');
    assert(has2dSphere, '2dsphere geospatial index is registered on UserLocation schema');

    // -------------------------------------------------------------
    // 3. ProfileImpression Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. ProfileImpression Model Tests ---');

    // 3.1 Valid impression
    const validImp = new ProfileImpression({
      viewer: userAId,
      candidate: userBId,
      recommendationId: 'rec_101',
      recommendationBatchId: 'batch_001',
      position: 0,
      visibleAt: new Date(),
    });
    const validImpErr = await validateAsync(validImp);
    assert(!validImpErr, 'Valid ProfileImpression passes validation');

    // 3.2 Self-impression rejection
    const selfImp = new ProfileImpression({
      viewer: userAId,
      candidate: userAId,
      recommendationId: 'rec_102',
      recommendationBatchId: 'batch_001',
      position: 1,
    });
    const selfImpErr = await validateAsync(selfImp);
    assert(
      selfImpErr && selfImpErr.message.includes('Viewer and candidate cannot be the same user'),
      'Self-impression (viewer === candidate) is rejected'
    );

    // -------------------------------------------------------------
    // 4. DatingInteraction Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. DatingInteraction Model Tests ---');

    // 4.1 Valid Like with comment
    const validLike = new DatingInteraction({
      actor: userAId,
      target: userBId,
      type: InteractionTypes.LIKE,
      status: InteractionStatuses.PENDING,
      comment: 'Loved your travel photos!',
      idempotencyKey: 'idemp_key_001',
    });
    const validLikeErr = await validateAsync(validLike);
    assert(!validLikeErr, 'Valid DatingInteraction (LIKE) passes validation');

    // 4.2 Self-interaction rejection
    const selfLike = new DatingInteraction({
      actor: userAId,
      target: userAId,
      type: InteractionTypes.LIKE,
      idempotencyKey: 'idemp_key_002',
    });
    const selfLikeErr = await validateAsync(selfLike);
    assert(
      selfLikeErr && selfLikeErr.message.includes('Actor and target cannot be the same user'),
      'Self-interaction (actor === target) is rejected'
    );

    // 4.3 Comment length validation (> 280 chars)
    const longCommentLike = new DatingInteraction({
      actor: userAId,
      target: userBId,
      type: InteractionTypes.LIKE,
      comment: 'A'.repeat(281),
      idempotencyKey: 'idemp_key_003',
    });
    const longCommentErr = await validateAsync(longCommentLike);
    assert(
      longCommentErr && longCommentErr.errors.comment,
      'Like comments exceeding 280 characters are rejected'
    );

    // -------------------------------------------------------------
    // 5. Match Model & Canonical Pair Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Match Model & Canonical Ordering Tests ---');

    const fakeChatId = new mongoose.Types.ObjectId();
    const fakeInteractionId = new mongoose.Types.ObjectId();

    // 5.1 Deterministic canonical ordering (user1 < user2)
    const match1 = new Match({
      user1: userBId, // Intentionally set B as user1
      user2: userAId, // Intentionally set A as user2
      initiatorInteraction: fakeInteractionId,
      conversation: fakeChatId,
    });
    await validateAsync(match1);

    const [expectedLower, expectedHigher] = [userAId.toString(), userBId.toString()].sort();
    assert(
      match1.user1.toString() === expectedLower && match1.user2.toString() === expectedHigher,
      'Match model deterministically sorts user1 and user2 canonically'
    );
    assert(
      match1.canonicalPair === `${expectedLower}:${expectedHigher}`,
      `Canonical pair correctly formatted: ${match1.canonicalPair}`
    );

    // 5.2 Self-match rejection
    const selfMatch = new Match({
      user1: userAId,
      user2: userAId,
      initiatorInteraction: fakeInteractionId,
      conversation: fakeChatId,
    });
    const selfMatchErr = await validateAsync(selfMatch);
    assert(
      selfMatchErr && selfMatchErr.message.includes('Self-matches are strictly prohibited'),
      'Self-matches are strictly prohibited and rejected'
    );

    // -------------------------------------------------------------
    // 6. RecommendationBatch & OutboxEvent Tests
    // -------------------------------------------------------------
    console.log('\n--- 6. RecommendationBatch & OutboxEvent Tests ---');

    // 6.1 RecommendationBatch
    const batch = new RecommendationBatch({
      viewer: userAId,
      batchId: 'batch_test_123',
      preferenceVersion: 1,
      rankingConfigVersion: 'v1.0-mvp',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
    assert(!(await validateAsync(batch)), 'Valid RecommendationBatch passes validation');

    // 6.2 OutboxEvent
    const outbox = new OutboxEvent({
      eventType: 'match.created',
      aggregateType: 'MATCH',
      aggregateId: 'match_123',
      payload: { userA: userAId, userB: userBId },
      deduplicationKey: 'dedup_match_123',
    });
    assert(!(await validateAsync(outbox)), 'Valid OutboxEvent passes validation');

    // -------------------------------------------------------------
    // 7. Block & Report Model Tests
    // -------------------------------------------------------------
    console.log('\n--- 7. Block & Report Model Tests ---');

    // 7.1 Self-block rejection
    const selfBlock = new Block({
      blocker: userAId,
      blocked: userAId,
    });
    const selfBlockErr = await validateAsync(selfBlock);
    assert(
      selfBlockErr && selfBlockErr.message.includes('Users cannot block themselves'),
      'Self-blocking is rejected'
    );

    // 7.2 Self-report rejection
    const selfReport = new Report({
      reporter: userAId,
      reportedUser: userAId,
      category: 'HARASSMENT',
      description: 'Test description',
    });
    const selfReportErr = await validateAsync(selfReport);
    assert(
      selfReportErr && selfReportErr.message.includes('Users cannot report themselves'),
      'Self-reporting is rejected'
    );

    console.log('\n===========================================================');
    console.log(`MODEL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runModelTests();
}

module.exports = runModelTests;
