const datingConfig = require('../config/datingConfig');

/**
 * Calculate rule-based ranking score and safe recommendation reason for an eligible candidate
 */
function scoreCandidate(viewerContext, candidateItem) {
  const { viewerProfile, viewerPref } = viewerContext;
  const { profile: candidateProfile, eligibilityResult } = candidateItem;

  const weights = datingConfig.rankingWeights || {
    mutualCompatibility: 30,
    sharedInterests: 15,
    intentionMatch: 15,
    distanceRelevance: 15,
    recentActivity: 10,
    profileCompleteness: 5,
    newUserBoost: 5,
  };

  let score = 0;
  let recommendationReason = 'Compatible match';

  // 1. Mutual Preference Compatibility (Base 30 pts)
  const softMismatchesCount = (eligibilityResult.softMismatches || []).length;
  const compatibilityScore = Math.max(0, weights.mutualCompatibility - softMismatchesCount * (datingConfig.discovery.softMismatchPenalty || 8));
  score += compatibilityScore;

  // 2. Shared Interests (Up to 15 pts)
  const vInterests = (viewerProfile && viewerProfile.interests) || [];
  const cInterests = (candidateProfile && candidateProfile.interests) || [];
  const commonInterests = vInterests.filter((i) => cInterests.includes(i));

  if (commonInterests.length > 0) {
    const interestRatio = Math.min(1, commonInterests.length / 3);
    score += weights.sharedInterests * interestRatio;
    recommendationReason = `Shared interests`;
  }

  // 3. Dating Intention Compatibility (Up to 15 pts)
  const vIntention = viewerProfile ? viewerProfile.datingIntention : null;
  const cIntention = candidateProfile ? candidateProfile.datingIntention : null;

  if (vIntention && cIntention && vIntention === cIntention) {
    score += weights.intentionMatch;
    if (commonInterests.length === 0) {
      recommendationReason = 'Similar dating intentions';
    }
  } else if (!eligibilityResult.softMismatches.includes('DATING_INTENTION_FLEXIBLE_MISMATCH')) {
    score += weights.intentionMatch * 0.7;
  }

  // 4. Distance Relevance (Up to 15 pts)
  const distanceKm = eligibilityResult.metadata.distanceKm || 10;
  const maxDistanceKm = (viewerPref && viewerPref.maxDistanceKm) || datingConfig.distance.defaultKm;
  const distanceRatio = Math.max(0, 1 - distanceKm / maxDistanceKm);
  score += weights.distanceRelevance * distanceRatio;

  if (distanceKm <= 5 && commonInterests.length === 0) {
    recommendationReason = 'Nearby';
  }

  // 5. Recent Activity (Up to 10 pts)
  const lastActive = candidateProfile && candidateProfile.lastActiveAt ? new Date(candidateProfile.lastActiveAt) : new Date();
  const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);

  if (hoursSinceActive <= 24) {
    score += weights.recentActivity;
  } else if (hoursSinceActive <= 72) {
    score += weights.recentActivity * 0.5;
  } else {
    score += weights.recentActivity * 0.2;
  }

  // 6. Profile Completeness (Up to 5 pts)
  const completeness = candidateProfile ? candidateProfile.completenessScore || 50 : 50;
  score += weights.profileCompleteness * (completeness / 100);

  // 7. New User Boost (Up to 5 pts)
  const createdAt = candidateProfile && candidateProfile.createdAt ? new Date(candidateProfile.createdAt) : new Date();
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCreation <= 7) {
    score += weights.newUserBoost;
    if (commonInterests.length === 0 && distanceKm > 5) {
      recommendationReason = 'New to Rubaru';
    }
  }

  // Final score clamping
  const finalScore = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

  return {
    score: finalScore,
    reason: recommendationReason,
  };
}

/**
 * Rank and deterministically sort eligible candidates
 */
function rankAndSortCandidates(viewerContext, candidateItems = []) {
  const scoredList = candidateItems.map((item) => {
    const { score, reason } = scoreCandidate(viewerContext, item);
    return {
      ...item,
      rankingScore: score,
      recommendationReason: reason,
    };
  });

  // Deterministic sorting: 1) Score DESC, 2) Completeness DESC, 3) Candidate User ID ASC (tie-breaker)
  scoredList.sort((a, b) => {
    if (b.rankingScore !== a.rankingScore) {
      return b.rankingScore - a.rankingScore;
    }
    const compA = a.profile ? a.profile.completenessScore || 0 : 0;
    const compB = b.profile ? b.profile.completenessScore || 0 : 0;
    if (compB !== compA) {
      return compB - compA;
    }
    return String(a.candidateId).localeCompare(String(b.candidateId));
  });

  return scoredList;
}

module.exports = {
  scoreCandidate,
  rankAndSortCandidates,
};
