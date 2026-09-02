// Centralized Dating Configuration for Rubaru Dating Engine

module.exports = {
  configVersion: 'v1.0-mvp',

  age: {
    minPermitted: 18,
    maxPermitted: 120,
    minDiscovery: 18,
    maxDiscovery: 99,
    defaultMin: 21,
    defaultMax: 35,
  },

  distance: {
    minKm: 1,
    maxKm: 500,
    defaultKm: 50,
  },

  location: {
    significantMovementMeters: 500, // Movement >= 500m considered significant
    minUpdateIntervalSeconds: 10,   // Rate limit throttle
    maxCoordinateAgeMinutes: 60,   // Coordinates older than 60 mins considered stale
    maxFutureTimestampToleranceSec: 60, // Allow up to 60s future clock skew
    maxAcceptedAccuracyMeters: 2000, // Accuracy > 2000m considered too poor
    suspiciousVelocityKmH: 900,     // Velocity > 900 km/h flagged for spoofing
    staleLocationThresholdHours: 72, // 3 days without update = stale location
  },

  limits: {
    dailyFreeLikes: 25,
    maxLikeCommentLength: 280,
    passSuppressionDays: 30,
    likeExpirationDays: 14,
    undoWindowMinutes: 5,
    batchSize: 10,
    maxInterests: 20,
    recentImpressionSuppressionMinutes: 60, // Exclude profiles shown in last 60 mins
    maxFlexibleDistanceExpansionRatio: 0.2, // Allow up to 20% distance expansion for soft mismatch
  },

  datingIntentionCompatibility: {
    LONG_TERM: ['LONG_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'NOT_SURE'],
    SHORT_TERM: ['SHORT_TERM', 'CASUAL', 'LONG_TERM_OPEN_TO_SHORT', 'NOT_SURE'],
    LONG_TERM_OPEN_TO_SHORT: ['LONG_TERM', 'SHORT_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'CASUAL', 'NOT_SURE'],
    CASUAL: ['SHORT_TERM', 'CASUAL', 'LONG_TERM_OPEN_TO_SHORT', 'FRIENDSHIP', 'NOT_SURE'],
    FRIENDSHIP: ['FRIENDSHIP', 'CASUAL', 'NOT_SURE'],
    NOT_SURE: ['LONG_TERM', 'SHORT_TERM', 'LONG_TERM_OPEN_TO_SHORT', 'CASUAL', 'FRIENDSHIP', 'NOT_SURE'],
  },

  supportedDealbreakers: ['gender', 'age', 'distance', 'intentions', 'interests'],
  supportedFlexibleKeys: ['age', 'distance', 'intentions', 'interests'], // Gender is always strict per Research 1

  discovery: {
    rankingVersion: 'v1.0',
    geoPoolLimit: 1000, // Max candidates fetched from geospatial index
    defaultPageSize: 10,
    maxPageSize: 20,
    batchTTLMinutes: 60,
    softMismatchPenalty: 8, // Points deducted per soft mismatch
    impressionGracePeriodHours: 24, // Allow up to 24h for offline impression submission
    maxImpressionsPerBatch: 20, // Max impression items in a single POST request
    minVisibleDurationMs: 500, // Minimum visible duration (500ms) for confirmed impression
  },

  rankingWeights: {
    mutualCompatibility: 30,
    sharedInterests: 15,
    intentionMatch: 15,
    distanceRelevance: 15,
    recentActivity: 10,
    profileCompleteness: 5,
    newUserBoost: 5,
  },
};
