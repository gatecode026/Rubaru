const DatingPreference = require('../models/DatingPreference');
const DatingProfile = require('../models/DatingProfile');
const User = require('../models/User');
const UserEntitlement = require('../models/UserEntitlement');
const OutboxEvent = require('../models/OutboxEvent');
const { Genders, DatingIntentions } = require('../models/enums');
const datingConfig = require('../config/datingConfig');
const { v4: uuidv4 } = require('uuid');

class PreferenceServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'PreferenceServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Format a DatingPreference document into a clean, privacy-safe Owner DTO
 */
function toOwnerDto(pref) {
  return {
    preferences: {
      preferredGenders: pref.genderPreference,
      minimumAge: pref.ageRange.min,
      maximumAge: pref.ageRange.max,
      maximumDistance: pref.maxDistanceKm,
      datingIntentions: pref.intentions,
      dealbreakers: {
        gender: true, // Gender preference is always strict/dealbreaker per Research 1
        age: !!pref.ageRange.isDealbreaker,
        distance: !!pref.distanceDealbreaker,
        intentions: !!pref.intentionDealbreaker,
      },
      dealbreakerInterests: pref.dealbreakerInterests || [],
      showOnlyVerified: !!pref.showOnlyVerified,
      version: pref.version,
      updatedAt: pref.updatedAt,
    },
    isComplete: Array.isArray(pref.genderPreference) && pref.genderPreference.length > 0,
  };
}

/**
 * Initialize default dating preference for a user
 */
async function initializeDefaults(userId) {
  return await DatingPreference.create({
    user: userId,
    version: 1,
    genderPreference: Object.values(Genders),
    ageRange: {
      min: datingConfig.age.defaultMin,
      max: datingConfig.age.defaultMax,
      isDealbreaker: true,
    },
    maxDistanceKm: datingConfig.distance.defaultKm,
    distanceDealbreaker: true,
    intentions: [DatingIntentions.NOT_SURE],
    intentionDealbreaker: false,
    dealbreakerInterests: [],
    showOnlyVerified: false,
  });
}

/**
 * Retrieve authenticated user's preferences
 */
async function getPreferences(userId) {
  if (!userId) {
    throw new PreferenceServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(userId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED') {
    throw new PreferenceServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active', 403);
  }

  let pref = await DatingPreference.findOne({ user: userId });
  if (!pref) {
    pref = await initializeDefaults(userId);
  }

  return toOwnerDto(pref);
}

/**
 * Partially update authenticated user's preferences
 */
async function updatePreferences(userId, patchData = {}) {
  if (!userId) {
    throw new PreferenceServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(userId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
    throw new PreferenceServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active or is suspended', 403);
  }

  // Fetch or initialize current preference
  let pref = await DatingPreference.findOne({ user: userId });
  if (!pref) {
    pref = await initializeDefaults(userId);
  }

  // 1. Optimistic Concurrency Check (expectedVersion)
  if (patchData.expectedVersion !== undefined && patchData.expectedVersion !== null) {
    if (Number(patchData.expectedVersion) !== Number(pref.version)) {
      throw new PreferenceServiceError(
        'PREFERENCE_VERSION_CONFLICT',
        `Preference version conflict. Stored version is ${pref.version}, but client expected ${patchData.expectedVersion}`,
        409,
        { currentVersion: pref.version }
      );
    }
  }

  let hasChanged = false;

  // 2. Validate & Update Preferred Genders
  const rawGenders = patchData.preferredGenders || patchData.genderPreference;
  if (rawGenders !== undefined) {
    if (!Array.isArray(rawGenders) || rawGenders.length === 0) {
      throw new PreferenceServiceError(
        'INVALID_PREFERENCE_VALUE',
        'preferredGenders must be a non-empty array of valid gender values',
        400
      );
    }

    const validGenders = Object.values(Genders);
    const deduplicatedGenders = [...new Set(rawGenders)];

    for (const g of deduplicatedGenders) {
      if (!validGenders.includes(g)) {
        throw new PreferenceServiceError(
          'INVALID_PREFERENCE_VALUE',
          `Unknown gender preference: '${g}'. Allowed values: ${validGenders.join(', ')}`,
          400
        );
      }
    }

    if (JSON.stringify(pref.genderPreference) !== JSON.stringify(deduplicatedGenders)) {
      pref.genderPreference = deduplicatedGenders;
      hasChanged = true;
    }
  }

  // 3. Validate & Update Age Range
  let targetMinAge = pref.ageRange.min;
  let targetMaxAge = pref.ageRange.max;

  if (patchData.minimumAge !== undefined || patchData.minAge !== undefined) {
    const rawMin = patchData.minimumAge !== undefined ? patchData.minimumAge : patchData.minAge;
    const numMin = Number(rawMin);
    if (!Number.isInteger(numMin) || numMin < datingConfig.age.minDiscovery || numMin > datingConfig.age.maxDiscovery) {
      throw new PreferenceServiceError(
        'INVALID_AGE_RANGE',
        `minimumAge must be an integer between ${datingConfig.age.minDiscovery} and ${datingConfig.age.maxDiscovery}`,
        400
      );
    }
    targetMinAge = numMin;
  }

  if (patchData.maximumAge !== undefined || patchData.maxAge !== undefined) {
    const rawMax = patchData.maximumAge !== undefined ? patchData.maximumAge : patchData.maxAge;
    const numMax = Number(rawMax);
    if (!Number.isInteger(numMax) || numMax < datingConfig.age.minDiscovery || numMax > datingConfig.age.maxDiscovery) {
      throw new PreferenceServiceError(
        'INVALID_AGE_RANGE',
        `maximumAge must be an integer between ${datingConfig.age.minDiscovery} and ${datingConfig.age.maxDiscovery}`,
        400
      );
    }
    targetMaxAge = numMax;
  }

  if (targetMinAge > targetMaxAge) {
    throw new PreferenceServiceError(
      'INVALID_AGE_RANGE',
      `minimumAge (${targetMinAge}) cannot be greater than maximumAge (${targetMaxAge})`,
      400
    );
  }

  if (pref.ageRange.min !== targetMinAge || pref.ageRange.max !== targetMaxAge) {
    pref.ageRange.min = targetMinAge;
    pref.ageRange.max = targetMaxAge;
    hasChanged = true;
  }

  // 4. Validate & Update Maximum Distance
  if (patchData.maximumDistance !== undefined || patchData.maxDistanceKm !== undefined || patchData.distance !== undefined) {
    let rawDist = patchData.maximumDistance !== undefined ? patchData.maximumDistance : (patchData.maxDistanceKm !== undefined ? patchData.maxDistanceKm : patchData.distance);
    
    // Normalize string distances like "25 km" from frontend filters
    if (typeof rawDist === 'string') {
      const parsed = parseInt(rawDist.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed)) rawDist = parsed;
    }

    const numDist = Number(rawDist);
    if (isNaN(numDist) || !Number.isFinite(numDist) || numDist < datingConfig.distance.minKm || numDist > datingConfig.distance.maxKm) {
      throw new PreferenceServiceError(
        'INVALID_DISTANCE',
        `maximumDistance must be a number between ${datingConfig.distance.minKm} km and ${datingConfig.distance.maxKm} km`,
        400
      );
    }

    if (pref.maxDistanceKm !== numDist) {
      pref.maxDistanceKm = numDist;
      hasChanged = true;
    }
  }

  // 5. Validate & Update Dating Intentions
  const rawIntentions = patchData.datingIntentions || patchData.intentions;
  if (rawIntentions !== undefined) {
    if (!Array.isArray(rawIntentions)) {
      throw new PreferenceServiceError('INVALID_PREFERENCE_VALUE', 'datingIntentions must be an array', 400);
    }

    const validIntentions = Object.values(DatingIntentions);
    const deduplicatedIntentions = [...new Set(rawIntentions)];

    for (const intent of deduplicatedIntentions) {
      if (!validIntentions.includes(intent)) {
        throw new PreferenceServiceError(
          'INVALID_PREFERENCE_VALUE',
          `Unknown dating intention: '${intent}'. Allowed values: ${validIntentions.join(', ')}`,
          400
        );
      }
    }

    if (JSON.stringify(pref.intentions) !== JSON.stringify(deduplicatedIntentions)) {
      pref.intentions = deduplicatedIntentions;
      hasChanged = true;
    }
  }

  // 6. Validate & Update Dealbreaker Flags
  if (patchData.dealbreakers && typeof patchData.dealbreakers === 'object') {
    const { age, distance, intentions } = patchData.dealbreakers;

    if (age !== undefined && pref.ageRange.isDealbreaker !== !!age) {
      pref.ageRange.isDealbreaker = !!age;
      hasChanged = true;
    }

    if (distance !== undefined && pref.distanceDealbreaker !== !!distance) {
      pref.distanceDealbreaker = !!distance;
      hasChanged = true;
    }

    if (intentions !== undefined && pref.intentionDealbreaker !== !!intentions) {
      pref.intentionDealbreaker = !!intentions;
      hasChanged = true;
    }
  }

  // 7. Validate & Update Dealbreaker Interests
  if (patchData.dealbreakerInterests !== undefined) {
    if (!Array.isArray(patchData.dealbreakerInterests)) {
      throw new PreferenceServiceError('INVALID_PREFERENCE_VALUE', 'dealbreakerInterests must be an array', 400);
    }
    if (patchData.dealbreakerInterests.length > datingConfig.limits.maxInterests) {
      throw new PreferenceServiceError(
        'INVALID_PREFERENCE_VALUE',
        `Cannot specify more than ${datingConfig.limits.maxInterests} dealbreaker interests`,
        400
      );
    }

    const deduplicatedInterests = [...new Set(patchData.dealbreakerInterests.map((s) => String(s).trim()))];
    if (JSON.stringify(pref.dealbreakerInterests) !== JSON.stringify(deduplicatedInterests)) {
      pref.dealbreakerInterests = deduplicatedInterests;
      hasChanged = true;
    }
  }

  // 8. Validate Verified Only Filter (Premium / Config Gate)
  if (patchData.showOnlyVerified !== undefined) {
    const verifiedFlag = !!patchData.showOnlyVerified;
    if (pref.showOnlyVerified !== verifiedFlag) {
      pref.showOnlyVerified = verifiedFlag;
      hasChanged = true;
    }
  }

  // 9. If meaningful change occurred, increment version and persist
  if (hasChanged) {
    pref.version = Number(pref.version || 1) + 1;
    await pref.save();

    // Log Outbox Event for background recommendation batch cache invalidation
    try {
      await OutboxEvent.create({
        eventType: 'preferences.updated',
        aggregateType: 'PREFERENCE',
        aggregateId: pref._id.toString(),
        payload: {
          userId: userId.toString(),
          preferenceVersion: pref.version,
        },
        deduplicationKey: `pref_upd_${userId}_${pref.version}_${Date.now()}`,
      });
    } catch (outboxErr) {
      console.warn('[PREFERENCE SERVICE] Warning: Failed to record preferences.updated outbox event:', outboxErr.message);
    }
  }

  return toOwnerDto(pref);
}

module.exports = {
  getPreferences,
  updatePreferences,
  PreferenceServiceError,
  toOwnerDto,
};
