const UserLocation = require('../models/UserLocation');
const User = require('../models/User');
const OutboxEvent = require('../models/OutboxEvent');
const datingConfig = require('../config/datingConfig');
const { v4: uuidv4 } = require('uuid');

class LocationServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'LocationServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Haversine formula to compute great-circle distance between two points in meters
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Format server-calculated distance into a privacy-safe approximate label
 */
function formatDistanceLabel(distanceKm, hideDistance = false) {
  if (hideDistance || distanceKm === null || distanceKm === undefined) {
    return 'Nearby';
  }

  const d = Math.max(0, distanceKm);
  if (d < 1) {
    return 'Less than a kilometer away';
  } else if (d <= 5) {
    return `Around ${Math.round(d)} km away`;
  } else if (d <= 10) {
    return 'Within 10 km';
  } else if (d <= 25) {
    return 'Within 25 km';
  } else if (d <= 50) {
    return 'Within 50 km';
  } else {
    return `Around ${Math.round(d)} km away`;
  }
}

/**
 * Update authenticated user's protected location
 */
async function updateLocation(userId, data = {}) {
  if (!userId) {
    throw new LocationServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(userId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
    throw new LocationServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active', 403);
  }

  const { latitude, longitude, accuracyMeters, capturedAt, requestId, source } = data;

  // 1. Validate Latitude
  if (latitude === undefined || latitude === null || typeof latitude !== 'number' || isNaN(latitude) || !Number.isFinite(latitude)) {
    throw new LocationServiceError('INVALID_LATITUDE', 'latitude must be a valid finite number between -90 and 90', 400);
  }
  if (latitude < -90 || latitude > 90) {
    throw new LocationServiceError('INVALID_LATITUDE', 'latitude must be between -90 and 90', 400);
  }

  // 2. Validate Longitude
  if (longitude === undefined || longitude === null || typeof longitude !== 'number' || isNaN(longitude) || !Number.isFinite(longitude)) {
    throw new LocationServiceError('INVALID_LONGITUDE', 'longitude must be a valid finite number between -180 and 180', 400);
  }
  if (longitude < -180 || longitude > 180) {
    throw new LocationServiceError('INVALID_LONGITUDE', 'longitude must be between -180 and 180', 400);
  }

  // 3. Validate Accuracy
  if (accuracyMeters !== undefined && accuracyMeters !== null) {
    const acc = Number(accuracyMeters);
    if (isNaN(acc) || !Number.isFinite(acc) || acc < 0) {
      throw new LocationServiceError('INVALID_LOCATION_ACCURACY', 'accuracyMeters must be a positive number', 400);
    }
    if (acc > datingConfig.location.maxAcceptedAccuracyMeters) {
      throw new LocationServiceError(
        'INVALID_LOCATION_ACCURACY',
        `accuracyMeters (${acc}m) exceeds maximum accepted accuracy of ${datingConfig.location.maxAcceptedAccuracyMeters}m`,
        400
      );
    }
  }

  // 4. Validate Captured Timestamp
  const now = Date.now();
  if (capturedAt) {
    const capturedTime = new Date(capturedAt).getTime();
    if (isNaN(capturedTime)) {
      throw new LocationServiceError('LOCATION_TIMESTAMP_INVALID', 'capturedAt is an invalid timestamp', 400);
    }

    // Check future timestamp with tolerance
    const maxFutureMs = datingConfig.location.maxFutureTimestampToleranceSec * 1000;
    if (capturedTime > now + maxFutureMs) {
      throw new LocationServiceError('LOCATION_TIMESTAMP_INVALID', 'capturedAt timestamp cannot be in the future', 400);
    }

    // Check stale coordinate age
    const maxAgeMs = datingConfig.location.maxCoordinateAgeMinutes * 60 * 1000;
    if (now - capturedTime > maxAgeMs) {
      throw new LocationServiceError('LOCATION_UPDATE_TOO_OLD', 'Location update is too old and rejected as stale', 400);
    }
  }

  // 5. Load Existing Protected Location
  let userLoc = await UserLocation.findOne({ user: userId });
  let isSignificant = false;
  let suspiciousVelocity = false;

  if (userLoc) {
    // Idempotent retry check with same requestId
    if (requestId && userLoc.lastRequestId === requestId) {
      return {
        locationStatus: 'CURRENT',
        updatedAt: userLoc.lastUpdatedAt,
        isSignificantMovement: false,
        locationVersion: userLoc.locationVersion,
      };
    }

    const [prevLng, prevLat] = userLoc.location.coordinates;
    const distanceMeters = calculateHaversineDistance(prevLat, prevLng, latitude, longitude);

    if (distanceMeters >= datingConfig.location.significantMovementMeters) {
      isSignificant = true;
    }

    // Calculate velocity for impossible travel detection
    const timeDiffHours = Math.max(0.001, (now - new Date(userLoc.lastUpdatedAt).getTime()) / (1000 * 60 * 60));
    const velocityKmH = (distanceMeters / 1000) / timeDiffHours;

    if (velocityKmH > datingConfig.location.suspiciousVelocityKmH && distanceMeters > 50000) {
      suspiciousVelocity = true;
      console.warn(`[LOCATION SERVICE] Suspicious velocity flag triggered for user ${userId}. Velocity: ${Math.round(velocityKmH)} km/h`);
    }

    // Update location document
    userLoc.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
    userLoc.accuracy = accuracyMeters || null;
    userLoc.source = source || 'GPS';
    userLoc.lastUpdatedAt = new Date();
    userLoc.suspiciousVelocityFlag = suspiciousVelocity;
    if (requestId) userLoc.lastRequestId = requestId;

    if (isSignificant) {
      userLoc.locationVersion = (userLoc.locationVersion || 1) + 1;
    }

    await userLoc.save();
  } else {
    // First location creation
    isSignificant = true;
    userLoc = await UserLocation.create({
      user: userId,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      accuracy: accuracyMeters || null,
      source: source || 'GPS',
      lastUpdatedAt: new Date(),
      lastRequestId: requestId || '',
      locationVersion: 1,
    });
  }

  // 6. Write outbox event if significant movement occurred (for batch cache invalidation)
  if (isSignificant) {
    try {
      await OutboxEvent.create({
        eventType: 'location.updated',
        aggregateType: 'LOCATION',
        aggregateId: userLoc._id.toString(),
        payload: {
          userId: userId.toString(),
          locationVersion: userLoc.locationVersion,
        },
        deduplicationKey: `loc_upd_${userId}_${userLoc.locationVersion}_${now}`,
      });
    } catch (outboxErr) {
      console.warn('[LOCATION SERVICE] Failed to record location.updated outbox event:', outboxErr.message);
    }
  }

  // Return strictly privacy-safe response (NO LATITUDE OR LONGITUDE RETURNED)
  return {
    locationStatus: 'CURRENT',
    updatedAt: userLoc.lastUpdatedAt,
    isSignificantMovement: isSignificant,
    locationVersion: userLoc.locationVersion,
  };
}

/**
 * Internal Geospatial Query: Find nearby user IDs within maxDistanceKm using 2dsphere index
 * NEVER returns raw coordinates to callers.
 */
async function findNearbyUserIds(centerLng, centerLat, maxDistanceKm, limit = 1000) {
  const maxDistanceMeters = maxDistanceKm * 1000;

  const nearbyLocations = await UserLocation.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [centerLng, centerLat],
        },
        distanceField: 'distanceMeters',
        maxDistance: maxDistanceMeters,
        spherical: true,
        query: { isLocationHidden: false },
      },
    },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        user: 1,
        distanceMeters: 1,
      },
    },
  ]);

  return nearbyLocations.map((item) => ({
    userId: item.user.toString(),
    distanceMeters: Math.round(item.distanceMeters),
    distanceKm: Math.round((item.distanceMeters / 1000) * 10) / 10,
  }));
}

module.exports = {
  updateLocation,
  calculateHaversineDistance,
  formatDistanceLabel,
  findNearbyUserIds,
  LocationServiceError,
};
