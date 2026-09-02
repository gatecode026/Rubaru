const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Block = require('../models/Block');
const ProfileImpression = require('../models/ProfileImpression');
const { calculateHaversineDistance, formatDistanceLabel } = require('./locationService');
const datingConfig = require('../config/datingConfig');

/**
 * Typed Internal Hard Exclusion Reasons
 */
const HardExclusionReasons = Object.freeze({
  SELF: 'SELF',
  VIEWER_ACCOUNT_INACTIVE: 'VIEWER_ACCOUNT_INACTIVE',
  CANDIDATE_ACCOUNT_INACTIVE: 'CANDIDATE_ACCOUNT_INACTIVE',
  VIEWER_UNDERAGE: 'VIEWER_UNDERAGE',
  CANDIDATE_UNDERAGE: 'CANDIDATE_UNDERAGE',
  VIEWER_PROFILE_INCOMPLETE: 'VIEWER_PROFILE_INCOMPLETE',
  CANDIDATE_PROFILE_INCOMPLETE: 'CANDIDATE_PROFILE_INCOMPLETE',
  VIEWER_DISCOVERY_DISABLED: 'VIEWER_DISCOVERY_DISABLED',
  CANDIDATE_DISCOVERY_DISABLED: 'CANDIDATE_DISCOVERY_DISABLED',
  VIEWER_LOCATION_MISSING: 'VIEWER_LOCATION_MISSING',
  CANDIDATE_LOCATION_MISSING: 'CANDIDATE_LOCATION_MISSING',
  VIEWER_LOCATION_STALE: 'VIEWER_LOCATION_STALE',
  CANDIDATE_LOCATION_STALE: 'CANDIDATE_LOCATION_STALE',
  GENDER_NOT_MUTUALLY_COMPATIBLE: 'GENDER_NOT_MUTUALLY_COMPATIBLE',
  VIEWER_AGE_DEALBREAKER: 'VIEWER_AGE_DEALBREAKER',
  CANDIDATE_AGE_DEALBREAKER: 'CANDIDATE_AGE_DEALBREAKER',
  VIEWER_DISTANCE_DEALBREAKER: 'VIEWER_DISTANCE_DEALBREAKER',
  CANDIDATE_DISTANCE_DEALBREAKER: 'CANDIDATE_DISTANCE_DEALBREAKER',
  DATING_INTENTION_INCOMPATIBLE: 'DATING_INTENTION_INCOMPATIBLE',
  BLOCKED: 'BLOCKED',
  SAFETY_RESTRICTED: 'SAFETY_RESTRICTED',
  ALREADY_MATCHED: 'ALREADY_MATCHED',
  PENDING_OUTGOING_LIKE: 'PENDING_OUTGOING_LIKE',
  PASS_SUPPRESSION_ACTIVE: 'PASS_SUPPRESSION_ACTIVE',
  REMOVED: 'REMOVED',
  RECENTLY_SHOWN: 'RECENTLY_SHOWN',
  REQUIRED_DATA_MISSING: 'REQUIRED_DATA_MISSING',
});

/**
 * Typed Internal Soft Mismatch Reasons
 */
const SoftMismatchReasons = Object.freeze({
  VIEWER_AGE_FLEXIBLE_MISMATCH: 'VIEWER_AGE_FLEXIBLE_MISMATCH',
  CANDIDATE_AGE_FLEXIBLE_MISMATCH: 'CANDIDATE_AGE_FLEXIBLE_MISMATCH',
  VIEWER_DISTANCE_FLEXIBLE_MISMATCH: 'VIEWER_DISTANCE_FLEXIBLE_MISMATCH',
  CANDIDATE_DISTANCE_FLEXIBLE_MISMATCH: 'CANDIDATE_DISTANCE_FLEXIBLE_MISMATCH',
  DATING_INTENTION_FLEXIBLE_MISMATCH: 'DATING_INTENTION_FLEXIBLE_MISMATCH',
});

/**
 * Check if intentions between viewer and candidate are mutually compatible
 */
function areIntentionsCompatible(viewerIntentions = [], candidateIntentions = []) {
  if (!viewerIntentions.length || !candidateIntentions.length) return true;

  const matrix = datingConfig.datingIntentionCompatibility || {};
  for (const vIntent of viewerIntentions) {
    const compatibleList = matrix[vIntent] || [];
    for (const cIntent of candidateIntentions) {
      if (compatibleList.includes(cIntent)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Core Pure Policy Evaluator
 */
function evaluatePairRules(params) {
  const {
    viewer,
    viewerProfile,
    viewerPref,
    viewerLoc,
    candidate,
    candidateProfile,
    candidatePref,
    candidateLoc,
    isBlocked = false,
    isMatched = false,
    activeInteraction = null,
    isRecentlyShown = false,
  } = params;

  const hardExclusions = [];
  const softMismatches = [];
  let distanceKm = null;
  let distanceLabel = 'Nearby';

  // 1. Self Check
  const viewerIdStr = viewer ? (viewer._id ? viewer._id.toString() : String(viewer)) : '';
  const candidateIdStr = candidate ? (candidate._id ? candidate._id.toString() : String(candidate)) : '';

  if (viewerIdStr && candidateIdStr && viewerIdStr === candidateIdStr) {
    hardExclusions.push(HardExclusionReasons.SELF);
    return { eligible: false, hardExclusions, softMismatches, metadata: {} };
  }

  // 2. Account Status Check
  if (!viewer || viewer.accountStatus === 'DELETED' || viewer.accountStatus === 'BANNED') {
    hardExclusions.push(HardExclusionReasons.VIEWER_ACCOUNT_INACTIVE);
  }
  if (!candidate || candidate.accountStatus === 'DELETED' || candidate.accountStatus === 'BANNED' || candidate.accountStatus === 'SUSPENDED') {
    hardExclusions.push(HardExclusionReasons.CANDIDATE_ACCOUNT_INACTIVE);
  }

  // 3. Safety & Block Check (Bilateral)
  if (isBlocked) {
    hardExclusions.push(HardExclusionReasons.BLOCKED);
  }

  // 4. Existing Match Check
  if (isMatched) {
    hardExclusions.push(HardExclusionReasons.ALREADY_MATCHED);
  }

  // 5. Existing Interaction Check (Pending Likes, Passes, Removes)
  if (activeInteraction && activeInteraction.status !== 'WITHDRAWN') {
    if (activeInteraction.type === 'LIKE' || activeInteraction.type === 'ROSE' || activeInteraction.type === 'PRIORITY_LIKE') {
      if (activeInteraction.status === 'PENDING') {
        hardExclusions.push(HardExclusionReasons.PENDING_OUTGOING_LIKE);
      }
    } else if (activeInteraction.type === 'PASS') {
      const now = new Date();
      if (activeInteraction.suppressedUntil && new Date(activeInteraction.suppressedUntil) > now) {
        hardExclusions.push(HardExclusionReasons.PASS_SUPPRESSION_ACTIVE);
      }
    } else if (activeInteraction.type === 'REMOVE') {
      hardExclusions.push(HardExclusionReasons.REMOVED);
    }
  }

  // 6. Recent Impression Check
  if (isRecentlyShown) {
    hardExclusions.push(HardExclusionReasons.RECENTLY_SHOWN);
  }

  // 7. Profile & Discoverability Check
  if (!viewerProfile || viewerProfile.isDiscoverable === false) {
    hardExclusions.push(HardExclusionReasons.VIEWER_DISCOVERY_DISABLED);
  }
  if (!candidateProfile || candidateProfile.isDiscoverable === false) {
    hardExclusions.push(HardExclusionReasons.CANDIDATE_DISCOVERY_DISABLED);
  }

  // 8. Age Bounds & Minimum Platform Age (18+)
  const viewerAge = viewerProfile ? viewerProfile.age : null;
  const candidateAge = candidateProfile ? candidateProfile.age : null;

  if (viewerAge !== null && viewerAge < datingConfig.age.minPermitted) {
    hardExclusions.push(HardExclusionReasons.VIEWER_UNDERAGE);
  }
  if (candidateAge !== null && candidateAge < datingConfig.age.minPermitted) {
    hardExclusions.push(HardExclusionReasons.CANDIDATE_UNDERAGE);
  }

  // 9. Mutual Gender Compatibility Check (Strict Bilateral)
  if (viewerProfile && candidateProfile && viewerPref && candidatePref) {
    const vGenders = viewerPref.genderPreference || [];
    const cGenders = candidatePref.genderPreference || [];

    const viewerAcceptsCandidate = vGenders.includes(candidateProfile.gender);
    const candidateAcceptsViewer = cGenders.includes(viewerProfile.gender);

    if (!viewerAcceptsCandidate || !candidateAcceptsViewer) {
      hardExclusions.push(HardExclusionReasons.GENDER_NOT_MUTUALLY_COMPATIBLE);
    }
  } else {
    hardExclusions.push(HardExclusionReasons.REQUIRED_DATA_MISSING);
  }

  // 10. Mutual Age Compatibility Check
  if (viewerProfile && candidateProfile && viewerPref && candidatePref) {
    const vAgeRange = viewerPref.ageRange || { min: 18, max: 99, isDealbreaker: true };
    const cAgeRange = candidatePref.ageRange || { min: 18, max: 99, isDealbreaker: true };

    // Viewer evaluating Candidate age
    if (candidateAge < vAgeRange.min || candidateAge > vAgeRange.max) {
      if (vAgeRange.isDealbreaker) {
        hardExclusions.push(HardExclusionReasons.VIEWER_AGE_DEALBREAKER);
      } else {
        softMismatches.push(SoftMismatchReasons.VIEWER_AGE_FLEXIBLE_MISMATCH);
      }
    }

    // Candidate evaluating Viewer age
    if (viewerAge < cAgeRange.min || viewerAge > cAgeRange.max) {
      if (cAgeRange.isDealbreaker) {
        hardExclusions.push(HardExclusionReasons.CANDIDATE_AGE_DEALBREAKER);
      } else {
        softMismatches.push(SoftMismatchReasons.CANDIDATE_AGE_FLEXIBLE_MISMATCH);
      }
    }
  }

  // 11. Mutual Distance Compatibility Check
  if (viewerLoc && candidateLoc && viewerLoc.location && candidateLoc.location) {
    const [vLng, vLat] = viewerLoc.location.coordinates;
    const [cLng, cLat] = candidateLoc.location.coordinates;

    const distMeters = calculateHaversineDistance(vLat, vLng, cLat, cLng);
    distanceKm = Math.round((distMeters / 1000) * 10) / 10;
    distanceLabel = formatDistanceLabel(distanceKm, !!viewerLoc.isLocationHidden);

    if (viewerPref && candidatePref) {
      const vMaxDist = viewerPref.maxDistanceKm || datingConfig.distance.defaultKm;
      const cMaxDist = candidatePref.maxDistanceKm || datingConfig.distance.defaultKm;
      const maxExpansionRatio = datingConfig.limits.maxFlexibleDistanceExpansionRatio || 0.2;

      // Viewer evaluating Candidate distance
      if (distanceKm > vMaxDist) {
        if (viewerPref.distanceDealbreaker || distanceKm > vMaxDist * (1 + maxExpansionRatio)) {
          hardExclusions.push(HardExclusionReasons.VIEWER_DISTANCE_DEALBREAKER);
        } else {
          softMismatches.push(SoftMismatchReasons.VIEWER_DISTANCE_FLEXIBLE_MISMATCH);
        }
      }

      // Candidate evaluating Viewer distance
      if (distanceKm > cMaxDist) {
        if (candidatePref.distanceDealbreaker || distanceKm > cMaxDist * (1 + maxExpansionRatio)) {
          hardExclusions.push(HardExclusionReasons.CANDIDATE_DISTANCE_DEALBREAKER);
        } else {
          softMismatches.push(SoftMismatchReasons.CANDIDATE_DISTANCE_FLEXIBLE_MISMATCH);
        }
      }
    }
  } else {
    // Missing location data fails safely
    hardExclusions.push(HardExclusionReasons.VIEWER_LOCATION_MISSING);
  }

  // 12. Dating Intention Compatibility Check
  if (viewerPref && candidatePref) {
    const isCompatible = areIntentionsCompatible(viewerPref.intentions, candidatePref.intentions);
    if (!isCompatible) {
      if (viewerPref.intentionDealbreaker || candidatePref.intentionDealbreaker) {
        hardExclusions.push(HardExclusionReasons.DATING_INTENTION_INCOMPATIBLE);
      } else {
        softMismatches.push(SoftMismatchReasons.DATING_INTENTION_FLEXIBLE_MISMATCH);
      }
    }
  }

  const eligible = hardExclusions.length === 0;

  return {
    eligible,
    hardExclusions: [...new Set(hardExclusions)],
    softMismatches: [...new Set(softMismatches)],
    metadata: {
      distanceKm,
      distanceLabel,
      viewerPreferenceVersion: viewerPref ? viewerPref.version : 1,
    },
  };
}

/**
 * Single Candidate Evaluation (for write-time validation or inspection)
 */
async function evaluateCandidate(viewerId, candidateId, options = {}) {
  if (!viewerId || !candidateId) {
    return {
      eligible: false,
      hardExclusions: [HardExclusionReasons.REQUIRED_DATA_MISSING],
      softMismatches: [],
      metadata: {},
    };
  }

  if (viewerId.toString() === candidateId.toString()) {
    return {
      eligible: false,
      hardExclusions: [HardExclusionReasons.SELF],
      softMismatches: [],
      metadata: {},
    };
  }

  // Fetch Viewer Data
  const [viewer, viewerProfile, viewerPref, viewerLoc] = await Promise.all([
    User.findById(viewerId),
    DatingProfile.findOne({ user: viewerId }),
    DatingPreference.findOne({ user: viewerId }),
    UserLocation.findOne({ user: viewerId }),
  ]);

  // Fetch Candidate Data
  const [candidate, candidateProfile, candidatePref, candidateLoc] = await Promise.all([
    User.findById(candidateId),
    DatingProfile.findOne({ user: candidateId }),
    DatingPreference.findOne({ user: candidateId }),
    UserLocation.findOne({ user: candidateId }),
  ]);

  // Check Bilateral Block
  const blockCount = await Block.countDocuments({
    $or: [
      { blocker: viewerId, blocked: candidateId },
      { blocker: candidateId, blocked: viewerId },
    ],
  });

  // Check Existing Match (using deterministic canonicalPair min:max)
  const [u1, u2] = [viewerId.toString(), candidateId.toString()].sort();
  const canonicalPair = `${u1}:${u2}`;
  const matchDoc = await Match.findOne({ canonicalPair });

  // Check Outgoing Interaction (Likes, Passes, Removes)
  const activeInteraction = await DatingInteraction.findOne({
    actor: viewerId,
    target: candidateId,
    status: { $ne: 'WITHDRAWN' },
  }).sort({ createdAt: -1 });

  // Check Recent Impression
  const recentMinutes = datingConfig.limits.recentImpressionSuppressionMinutes || 60;
  const recentThreshold = new Date(Date.now() - recentMinutes * 60 * 1000);
  const recentImpression = await ProfileImpression.findOne({
    viewer: viewerId,
    candidate: candidateId,
    visibleAt: { $gte: recentThreshold },
  });

  return evaluatePairRules({
    viewer,
    viewerProfile,
    viewerPref,
    viewerLoc,
    candidate,
    candidateProfile,
    candidatePref,
    candidateLoc,
    isBlocked: blockCount > 0,
    isMatched: !!matchDoc,
    activeInteraction,
    isRecentlyShown: !!recentImpression,
  });
}

/**
 * Batch Evaluation for Candidates (Prevents N+1 database queries)
 */
async function evaluateCandidates(viewerId, candidateIds = [], options = {}) {
  if (!viewerId || !Array.isArray(candidateIds) || candidateIds.length === 0) {
    return new Map();
  }

  const resultsMap = new Map();
  const cleanCandidateIds = [...new Set(candidateIds.map((id) => id.toString()))].filter(
    (id) => id !== viewerId.toString()
  );

  // 1. Bulk Load Viewer Context (1 roundtrip)
  const [viewer, viewerProfile, viewerPref, viewerLoc] = await Promise.all([
    User.findById(viewerId),
    DatingProfile.findOne({ user: viewerId }),
    DatingPreference.findOne({ user: viewerId }),
    UserLocation.findOne({ user: viewerId }),
  ]);

  // 2. Bulk Load Candidate Contexts (1 roundtrip per collection)
  const [
    candidateUsers,
    candidateProfiles,
    candidatePrefs,
    candidateLocs,
    bilateralBlocks,
    matches,
    interactions,
    recentImpressions,
  ] = await Promise.all([
    User.find({ _id: { $in: cleanCandidateIds } }),
    DatingProfile.find({ user: { $in: cleanCandidateIds } }),
    DatingPreference.find({ user: { $in: cleanCandidateIds } }),
    UserLocation.find({ user: { $in: cleanCandidateIds } }),
    Block.find({
      $or: [
        { blocker: viewerId, blocked: { $in: cleanCandidateIds } },
        { blocker: { $in: cleanCandidateIds }, blocked: viewerId },
      ],
    }),
    Match.find({
      users: viewerId,
      $or: cleanCandidateIds.map((cid) => ({ users: cid })),
    }),
    DatingInteraction.find({
      actor: viewerId,
      target: { $in: cleanCandidateIds },
      status: { $ne: 'WITHDRAWN' },
    }),
    ProfileImpression.find({
      viewer: viewerId,
      candidate: { $in: cleanCandidateIds },
      visibleAt: {
        $gte: new Date(Date.now() - (datingConfig.limits.recentImpressionSuppressionMinutes || 60) * 60 * 1000),
      },
    }),
  ]);

  // Index bulk results into Maps for O(1) in-memory lookup
  const userMap = new Map(candidateUsers.map((u) => [u._id.toString(), u]));
  const profileMap = new Map(candidateProfiles.map((p) => [p.user.toString(), p]));
  const prefMap = new Map(candidatePrefs.map((p) => [p.user.toString(), p]));
  const locMap = new Map(candidateLocs.map((l) => [l.user.toString(), l]));

  const blockedSet = new Set();
  for (const b of bilateralBlocks) {
    blockedSet.add(b.blocker.toString() === viewerId.toString() ? b.blocked.toString() : b.blocker.toString());
  }

  const matchedSet = new Set();
  for (const m of matches) {
    for (const u of m.users) {
      if (u.toString() !== viewerId.toString()) {
        matchedSet.add(u.toString());
      }
    }
  }

  const interactionMap = new Map(interactions.map((i) => [i.target.toString(), i]));
  const recentImpressionSet = new Set(recentImpressions.map((imp) => imp.candidate.toString()));

  // 3. Evaluate each candidate in memory
  for (const candId of cleanCandidateIds) {
    const candidate = userMap.get(candId);
    const candidateProfile = profileMap.get(candId);
    const candidatePref = prefMap.get(candId);
    const candidateLoc = locMap.get(candId);

    const result = evaluatePairRules({
      viewer,
      viewerProfile,
      viewerPref,
      viewerLoc,
      candidate,
      candidateProfile,
      candidatePref,
      candidateLoc,
      isBlocked: blockedSet.has(candId),
      isMatched: matchedSet.has(candId),
      activeInteraction: interactionMap.get(candId) || null,
      isRecentlyShown: recentImpressionSet.has(candId),
    });

    resultsMap.set(candId, result);
  }

  return resultsMap;
}

module.exports = {
  HardExclusionReasons,
  SoftMismatchReasons,
  evaluatePairRules,
  evaluateCandidate,
  evaluateCandidates,
  areIntentionsCompatible,
};
