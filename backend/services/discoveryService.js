const crypto = require('crypto');
const User = require('../models/User');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const RecommendationBatch = require('../models/RecommendationBatch');
const { evaluateCandidates, HardExclusionReasons } = require('./eligibilityPolicy');
const { rankAndSortCandidates } = require('./rankingService');
const { formatDistanceLabel } = require('./locationService');
const datingConfig = require('../config/datingConfig');

class DiscoveryServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'DiscoveryServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Sign and encode an opaque pagination cursor
 */
function createOpaqueCursor(payload) {
  const secret = process.env.JWT_SECRET || 'rubaru_discovery_secret_key_2026';
  const dataString = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');
  return `${dataString}.${signature}`;
}

/**
 * Verify and decode an opaque pagination cursor
 */
function verifyAndDecodeCursor(cursorString, currentViewerId) {
  if (!cursorString || typeof cursorString !== 'string') {
    throw new DiscoveryServiceError('INVALID_CURSOR', 'Cursor is malformed or missing', 400);
  }

  const parts = cursorString.split('.');
  if (parts.length !== 2) {
    throw new DiscoveryServiceError('INVALID_CURSOR', 'Cursor format is invalid', 400);
  }

  const [dataString, signature] = parts;
  const secret = process.env.JWT_SECRET || 'rubaru_discovery_secret_key_2026';
  const expectedSig = crypto.createHmac('sha256', secret).update(dataString).digest('base64url');

  if (signature !== expectedSig) {
    throw new DiscoveryServiceError('INVALID_CURSOR', 'Cursor signature verification failed', 400);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(dataString, 'base64url').toString('utf8'));
  } catch (err) {
    throw new DiscoveryServiceError('INVALID_CURSOR', 'Cursor content could not be decoded', 400);
  }

  if (payload.viewerId !== currentViewerId.toString()) {
    throw new DiscoveryServiceError('CURSOR_USER_MISMATCH', 'Cursor does not belong to the authenticated user', 403);
  }

  if (payload.exp && Date.now() > payload.exp) {
    throw new DiscoveryServiceError('EXPIRED_CURSOR', 'Discovery pagination cursor has expired', 410);
  }

  return payload;
}

/**
 * Validate Viewer Readiness before running candidate discovery
 */
async function validateViewerReadiness(userId) {
  if (!userId) {
    throw new DiscoveryServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(userId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
    throw new DiscoveryServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active or is suspended', 403);
  }

  const [profile, preference, location] = await Promise.all([
    DatingProfile.findOne({ user: userId }),
    DatingPreference.findOne({ user: userId }),
    UserLocation.findOne({ user: userId }),
  ]);

  if (!profile) {
    throw new DiscoveryServiceError('PROFILE_INCOMPLETE', 'Dating profile setup is required for discovery', 400);
  }

  if (profile.isDiscoverable === false) {
    throw new DiscoveryServiceError('DISCOVERY_PAUSED', 'Discovery is currently paused for your profile', 400);
  }

  if (!preference) {
    throw new DiscoveryServiceError('PREFERENCES_INCOMPLETE', 'Dating preferences must be configured before discovery', 400);
  }

  if (!location || !location.location || !Array.isArray(location.location.coordinates)) {
    throw new DiscoveryServiceError('LOCATION_REQUIRED', 'Location is required to discover nearby candidates', 400);
  }

  const staleHours = datingConfig.location.staleLocationThresholdHours || 72;
  const staleThreshold = new Date(Date.now() - staleHours * 60 * 60 * 1000);
  if (new Date(location.lastUpdatedAt) < staleThreshold) {
    throw new DiscoveryServiceError('LOCATION_STALE', 'Location is stale. Please update your current location', 400);
  }

  return { user, profile, preference, location };
}

/**
 * Public Hydration: Convert internal candidate item into privacy-safe public dating card DTO
 */
function hydratePublicCandidateDto(batchId, candidateItem, hideDistance = false) {
  const { profile, recommendationReason, candidateId, eligibilityResult } = candidateItem;

  const distanceKm = eligibilityResult.metadata.distanceKm || null;
  const distanceLabel = formatDistanceLabel(distanceKm, hideDistance);

  return {
    recommendationId: `rec_${batchId}_${candidateId}`,
    profile: {
      userId: candidateId.toString(),
      displayName: profile.displayName || 'Rubaru User',
      age: profile.age,
      distanceLabel,
      bio: profile.bio || '',
      avatarUri: profile.avatarUri || 'https://i.pravatar.cc/150?img=60',
      photos: profile.photos || [],
      prompts: profile.prompts || [],
      interests: profile.interests || [],
      datingIntention: profile.datingIntention || 'NOT_SURE',
      relationshipType: profile.relationshipType || 'MONOGAMOUS',
      heightCm: profile.heightCm || null,
      work: profile.work || '',
      education: profile.education || '',
      completenessScore: profile.completenessScore || 0,
      isVerified: !!profile.isVerified,
    },
    availableActions: ['LIKE', 'PASS', 'ROSE'],
    reason: recommendationReason || 'Compatible match',
  };
}

/**
 * Primary Discovery Candidate Retrieval Pipeline
 */
async function getDiscoveryCandidates(userId, options = {}) {
  const { profile: viewerProfile, preference: viewerPref, location: viewerLoc } =
    await validateViewerReadiness(userId);

  const rawLimit = Number(options.limit) || datingConfig.discovery.defaultPageSize || 10;
  const limit = Math.min(datingConfig.discovery.maxPageSize || 20, Math.max(1, rawLimit));

  let batchId;
  let offset = 0;
  let rankedCandidates = [];

  // Case A: Resume from Opaque Cursor
  if (options.cursor) {
    const cursorPayload = verifyAndDecodeCursor(options.cursor, userId);
    
    // Check version consistency
    if (cursorPayload.preferenceVersion !== viewerPref.version) {
      throw new DiscoveryServiceError('PREFERENCES_CHANGED', 'Preferences have been updated. Refreshing discovery feed', 409);
    }
    if (cursorPayload.locationVersion !== viewerLoc.locationVersion) {
      throw new DiscoveryServiceError('LOCATION_CHANGED', 'Location has changed. Refreshing discovery feed', 409);
    }

    batchId = cursorPayload.batchId;
    offset = cursorPayload.offset || 0;

    const existingBatch = await RecommendationBatch.findOne({ batchId, viewer: userId });
    if (!existingBatch) {
      throw new DiscoveryServiceError('EXPIRED_CURSOR', 'Recommendation batch has expired. Please fetch a new batch', 410);
    }

    // Bulk load candidate profiles for this page slice
    const pageCandidateIds = existingBatch.candidates.slice(offset, offset + limit + 1);
    
    if (pageCandidateIds.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const batchEligibilityMap = await evaluateCandidates(userId, pageCandidateIds);
    const profiles = await DatingProfile.find({ user: { $in: pageCandidateIds } });
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    for (const candId of pageCandidateIds) {
      const elig = batchEligibilityMap.get(candId.toString());
      if (elig && elig.eligible) {
        const p = profileMap.get(candId.toString());
        if (p) {
          rankedCandidates.push({
            candidateId: candId.toString(),
            profile: p,
            eligibilityResult: elig,
            recommendationReason: 'Compatible match',
          });
        }
      }
    }
  } else {
    // Case B: Generate Fresh Recommendation Batch
    batchId = `batch_${userId}_${Date.now()}`;
    const [viewerLng, viewerLat] = viewerLoc.location.coordinates;
    const maxRadiusKm = (viewerPref.maxDistanceKm || datingConfig.distance.defaultKm) * 1.3; // 30% retrieval buffer
    const maxRadiusMeters = maxRadiusKm * 1000;

    // 1. Geospatial Candidate Pool Retrieval (Bounded)
    const geoPoolLimit = datingConfig.discovery.geoPoolLimit || 100;
    const nearbyLocs = await UserLocation.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [viewerLng, viewerLat] },
          distanceField: 'distanceMeters',
          maxDistance: maxRadiusMeters,
          spherical: true,
          query: {
            user: { $ne: viewerLoc.user },
            isLocationHidden: false,
          },
        },
      },
      { $limit: geoPoolLimit },
      { $project: { user: 1, distanceMeters: 1 } },
    ]);

    const candidateIds = nearbyLocs.map((loc) => loc.user.toString());

    if (candidateIds.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    // 2. Batch Eligibility Policy Evaluation
    const eligibilityMap = await evaluateCandidates(userId, candidateIds);

    // 3. Filter only eligible candidates and load profiles
    const eligibleCandidateIds = [];
    for (const [candId, eligRes] of eligibilityMap.entries()) {
      if (eligRes.eligible) {
        eligibleCandidateIds.push(candId);
      }
    }

    if (eligibleCandidateIds.length === 0) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const eligibleProfiles = await DatingProfile.find({ user: { $in: eligibleCandidateIds } });
    const profileMap = new Map(eligibleProfiles.map((p) => [p.user.toString(), p]));

    const candidateItems = [];
    for (const candId of eligibleCandidateIds) {
      const p = profileMap.get(candId);
      const elig = eligibilityMap.get(candId);
      if (p && elig) {
        candidateItems.push({
          candidateId: candId,
          profile: p,
          eligibilityResult: elig,
        });
      }
    }

    // 4. Rule-Based Ranking & Deterministic Sorting
    rankedCandidates = rankAndSortCandidates(
      { viewerProfile, viewerPref },
      candidateItems
    );

    // 5. Persist RecommendationBatch for Stable Pagination
    const ttlMinutes = datingConfig.discovery.batchTTLMinutes || 60;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    
    await RecommendationBatch.create({
      batchId,
      viewer: userId,
      candidates: rankedCandidates.map((c) => c.candidateId),
      preferenceVersion: viewerPref.version,
      locationVersion: viewerLoc.locationVersion,
      rankingVersion: datingConfig.discovery.rankingVersion || 'v1.0',
      expiresAt,
    });
  }

  // 6. Slice Page Items
  const pageSlice = rankedCandidates.slice(0, limit);
  const hasMore = rankedCandidates.length > limit;

  // 7. Hydrate Public DTOs (Zero Coordinates, Zero Private Preferences)
  const items = pageSlice.map((item) =>
    hydratePublicCandidateDto(batchId, item, !!viewerLoc.isLocationHidden)
  );

  // 8. Generate Next Opaque Cursor
  let nextCursor = null;
  if (hasMore) {
    const nextOffset = offset + limit;
    nextCursor = createOpaqueCursor({
      batchId,
      viewerId: userId.toString(),
      offset: nextOffset,
      preferenceVersion: viewerPref.version,
      locationVersion: viewerLoc.locationVersion,
      rankingVersion: datingConfig.discovery.rankingVersion || 'v1.0',
      exp: Date.now() + 60 * 60 * 1000,
    });
  }

  return {
    items,
    nextCursor,
    hasMore,
  };
}

module.exports = {
  getDiscoveryCandidates,
  validateViewerReadiness,
  createOpaqueCursor,
  verifyAndDecodeCursor,
  hydratePublicCandidateDto,
  DiscoveryServiceError,
};
