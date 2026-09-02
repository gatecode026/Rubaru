require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Block = require('../models/Block');
const ProfileImpression = require('../models/ProfileImpression');

// Policy
const {
  HardExclusionReasons,
  SoftMismatchReasons,
  evaluatePairRules,
  evaluateCandidate,
  evaluateCandidates,
  areIntentionsCompatible,
} = require('../services/eligibilityPolicy');

async function runEligibilityTests() {
  console.log('===========================================================');
  console.log('       RUBARU CANDIDATE ELIGIBILITY POLICY TEST SUITE      ');
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

  try {
    // -------------------------------------------------------------
    // 1. Pure Policy Unit Tests: Self & Account Checks
    // -------------------------------------------------------------
    console.log('\n--- 1. Self & Account Status Unit Tests ---');

    // 1.1 Self evaluation
    const selfRes = evaluatePairRules({
      viewer: { _id: 'user_123', accountStatus: 'ACTIVE' },
      candidate: { _id: 'user_123', accountStatus: 'ACTIVE' },
    });
    assert(selfRes.eligible === false, 'Self evaluation is not eligible');
    assert(selfRes.hardExclusions.includes(HardExclusionReasons.SELF), 'Self evaluation returns SELF reason');

    // 1.2 Inactive Viewer
    const inactiveViewerRes = evaluatePairRules({
      viewer: { _id: 'viewer_1', accountStatus: 'DELETED' },
      candidate: { _id: 'cand_1', accountStatus: 'ACTIVE' },
    });
    assert(inactiveViewerRes.hardExclusions.includes(HardExclusionReasons.VIEWER_ACCOUNT_INACTIVE), 'Inactive viewer excluded');

    // 1.3 Inactive Candidate
    const inactiveCandRes = evaluatePairRules({
      viewer: { _id: 'viewer_1', accountStatus: 'ACTIVE' },
      candidate: { _id: 'cand_1', accountStatus: 'SUSPENDED' },
    });
    assert(inactiveCandRes.hardExclusions.includes(HardExclusionReasons.CANDIDATE_ACCOUNT_INACTIVE), 'Suspended candidate excluded');

    // -------------------------------------------------------------
    // 2. Pure Policy Unit Tests: Mutual Gender Compatibility
    // -------------------------------------------------------------
    console.log('\n--- 2. Mutual Gender Compatibility Tests ---');

    // 2.1 Compatible: Male looking for Female, Female looking for Male
    const genderCompatRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 24, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'], ageRange: { min: 22, max: 32, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
    });
    assert(genderCompatRes.eligible === true, 'Mutually compatible heterosexual pair is eligible');
    assert(genderCompatRes.hardExclusions.length === 0, 'No hard exclusions for compatible pair');

    // 2.2 Incompatible: Viewer wants Female, but Candidate (Female) only wants Female (Lesbian)
    const genderIncompatRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 24, isDiscoverable: true },
      candidatePref: { genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
    });
    assert(genderIncompatRes.eligible === false, 'Gender incompatibility in one direction causes hard exclusion');
    assert(genderIncompatRes.hardExclusions.includes(HardExclusionReasons.GENDER_NOT_MUTUALLY_COMPATIBLE), 'Returns GENDER_NOT_MUTUALLY_COMPATIBLE');

    // -------------------------------------------------------------
    // 3. Mutual Age & Dealbreaker Tests
    // -------------------------------------------------------------
    console.log('\n--- 3. Mutual Age & Dealbreaker Tests ---');

    // 3.1 Candidate outside Viewer Age Dealbreaker range (Candidate age 35, Viewer max 30)
    const ageDealbreakerRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 35, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'], ageRange: { min: 20, max: 35, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
    });
    assert(ageDealbreakerRes.eligible === false, 'Candidate exceeding age dealbreaker is hard excluded');
    assert(ageDealbreakerRes.hardExclusions.includes(HardExclusionReasons.VIEWER_AGE_DEALBREAKER), 'Returns VIEWER_AGE_DEALBREAKER');

    // 3.2 Candidate outside Flexible Age range (Candidate age 32, Viewer max 30, isDealbreaker: false)
    const ageFlexibleRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: false }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 32, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'], ageRange: { min: 20, max: 35, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
    });
    assert(ageFlexibleRes.eligible === true, 'Candidate exceeding flexible age range remains eligible');
    assert(ageFlexibleRes.softMismatches.includes(SoftMismatchReasons.VIEWER_AGE_FLEXIBLE_MISMATCH), 'Records VIEWER_AGE_FLEXIBLE_MISMATCH soft mismatch');

    // -------------------------------------------------------------
    // 4. Safety & Interaction Exclusions Tests
    // -------------------------------------------------------------
    console.log('\n--- 4. Safety, Match & Interaction Tests ---');

    // 4.1 Bilateral Block (Viewer blocked Candidate OR Candidate blocked Viewer)
    const blockedRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 24, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
      isBlocked: true,
    });
    assert(blockedRes.eligible === false, 'Blocked pair is not eligible');
    assert(blockedRes.hardExclusions.includes(HardExclusionReasons.BLOCKED), 'Returns BLOCKED reason');

    // 4.2 Existing Match
    const matchedRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 24, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
      isMatched: true,
    });
    assert(matchedRes.eligible === false, 'Already matched pair is excluded from discovery');
    assert(matchedRes.hardExclusions.includes(HardExclusionReasons.ALREADY_MATCHED), 'Returns ALREADY_MATCHED');

    // 4.3 Active Pass Suppression (30 days)
    const passRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 24, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
      activeInteraction: { type: 'PASS', suppressedUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
    });
    assert(passRes.eligible === false, 'Active pass suppression excludes candidate');
    assert(passRes.hardExclusions.includes(HardExclusionReasons.PASS_SUPPRESSION_ACTIVE), 'Returns PASS_SUPPRESSION_ACTIVE');

    // 4.4 Recent Impression (shown in last 60 mins)
    const recentImpRes = evaluatePairRules({
      viewer: { _id: 'v1', accountStatus: 'ACTIVE' },
      viewerProfile: { gender: 'Male', age: 26, isDiscoverable: true },
      viewerPref: { genderPreference: ['Female'] },
      viewerLoc: { location: { coordinates: [75.78, 26.91] } },
      candidate: { _id: 'c1', accountStatus: 'ACTIVE' },
      candidateProfile: { gender: 'Female', age: 24, isDiscoverable: true },
      candidatePref: { genderPreference: ['Male'] },
      candidateLoc: { location: { coordinates: [75.79, 26.92] } },
      isRecentlyShown: true,
    });
    assert(recentImpRes.eligible === false, 'Recently shown candidate is excluded from immediate resurfacing');
    assert(recentImpRes.hardExclusions.includes(HardExclusionReasons.RECENTLY_SHOWN), 'Returns RECENTLY_SHOWN');

    // -------------------------------------------------------------
    // 5. Database Integration & Batch Efficiency Tests
    // -------------------------------------------------------------
    console.log('\n--- 5. Database & Batch Evaluation Tests ---');

    // Create DB users for batch evaluation
    const userViewer = await User.create({ email: `v_batch_${Date.now()}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const userCand1 = await User.create({ email: `c1_batch_${Date.now()}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });
    const userCand2 = await User.create({ email: `c2_batch_${Date.now()}@rubaru.app`, password: 'pw', isActive: true, accountStatus: 'ACTIVE' });

    // Profiles
    const dob = new Date('1998-05-15');
    await DatingProfile.create({ user: userViewer._id, displayName: 'Viewer', dateOfBirth: dob, gender: 'Male', age: 25, isDiscoverable: true });
    await DatingProfile.create({ user: userCand1._id, displayName: 'Cand 1', dateOfBirth: dob, gender: 'Female', age: 23, isDiscoverable: true });
    await DatingProfile.create({ user: userCand2._id, displayName: 'Cand 2', dateOfBirth: dob, gender: 'Male', age: 24, isDiscoverable: true }); // Incompatible gender

    // Preferences
    await DatingPreference.create({ user: userViewer._id, genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] });
    await DatingPreference.create({ user: userCand1._id, genderPreference: ['Male'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] });
    await DatingPreference.create({ user: userCand2._id, genderPreference: ['Female'], ageRange: { min: 20, max: 30, isDealbreaker: true }, maxDistanceKm: 50, intentions: ['LONG_TERM'] });

    // Locations
    await UserLocation.create({ user: userViewer._id, location: { type: 'Point', coordinates: [75.78, 26.91] } });
    await UserLocation.create({ user: userCand1._id, location: { type: 'Point', coordinates: [75.79, 26.92] } });
    await UserLocation.create({ user: userCand2._id, location: { type: 'Point', coordinates: [75.80, 26.93] } });

    // Test Batch Evaluation
    const batchResults = await evaluateCandidates(userViewer._id, [userCand1._id, userCand2._id]);
    assert(batchResults.size === 2, 'Batch evaluation returns results for all candidates');
    
    const cand1Res = batchResults.get(userCand1._id.toString());
    assert(cand1Res.eligible === true, 'Candidate 1 (compatible female) is eligible in batch evaluation');

    const cand2Res = batchResults.get(userCand2._id.toString());
    assert(cand2Res.eligible === false, 'Candidate 2 (incompatible male) is excluded in batch evaluation');
    assert(cand2Res.hardExclusions.includes(HardExclusionReasons.GENDER_NOT_MUTUALLY_COMPATIBLE), 'Candidate 2 excluded for GENDER_NOT_MUTUALLY_COMPATIBLE');

    // Single evaluation equivalence check
    const singleCand1Res = await evaluateCandidate(userViewer._id, userCand1._id);
    assert(singleCand1Res.eligible === cand1Res.eligible, 'Single-pair and batch evaluations produce identical eligibility results');

    console.log('\n===========================================================');
    console.log(`ELIGIBILITY TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===========================================================\n');
  } finally {
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runEligibilityTests();
}

module.exports = runEligibilityTests;
