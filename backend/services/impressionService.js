const User = require('../models/User');
const RecommendationBatch = require('../models/RecommendationBatch');
const ProfileImpression = require('../models/ProfileImpression');
const OutboxEvent = require('../models/OutboxEvent');
const datingConfig = require('../config/datingConfig');

class ImpressionServiceError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.name = 'ImpressionServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Record confirmed profile impressions from mobile discovery view
 */
async function recordConfirmedImpressions(viewerId, payload = {}) {
  if (!viewerId) {
    throw new ImpressionServiceError('AUTHENTICATION_REQUIRED', 'Authentication is required', 401);
  }

  const user = await User.findById(viewerId);
  if (!user || user.accountStatus === 'DELETED' || user.accountStatus === 'BANNED' || user.accountStatus === 'SUSPENDED') {
    throw new ImpressionServiceError('ACCOUNT_NOT_ACTIVE', 'User account is not active or is suspended', 403);
  }

  const { batchId, impressions } = payload;

  if (!batchId || typeof batchId !== 'string') {
    throw new ImpressionServiceError('INVALID_IMPRESSION_REQUEST', 'batchId is required', 400);
  }

  if (!Array.isArray(impressions) || impressions.length === 0) {
    throw new ImpressionServiceError('INVALID_IMPRESSION_REQUEST', 'impressions must be a non-empty array', 400);
  }

  const maxBatchSize = datingConfig.discovery.maxImpressionsPerBatch || 20;
  if (impressions.length > maxBatchSize) {
    throw new ImpressionServiceError(
      'IMPRESSION_BATCH_TOO_LARGE',
      `Cannot submit more than ${maxBatchSize} impressions in a single request`,
      400
    );
  }

  // 1. Locate and validate RecommendationBatch
  const batch = await RecommendationBatch.findOne({ batchId });
  if (!batch) {
    throw new ImpressionServiceError('RECOMMENDATION_BATCH_NOT_FOUND', 'Recommendation batch was not found', 404);
  }

  if (batch.viewer.toString() !== viewerId.toString()) {
    throw new ImpressionServiceError('RECOMMENDATION_OWNERSHIP_INVALID', 'Recommendation batch does not belong to user', 403);
  }

  // Check batch expiry with 24-hour grace period for offline/delayed sync
  const now = Date.now();
  const gracePeriodMs = (datingConfig.discovery.impressionGracePeriodHours || 24) * 60 * 60 * 1000;
  const expiryWithGrace = new Date(batch.expiresAt).getTime() + gracePeriodMs;

  if (now > expiryWithGrace) {
    throw new ImpressionServiceError('RECOMMENDATION_BATCH_EXPIRED', 'Recommendation batch has expired beyond grace period', 410);
  }

  const batchCandidates = (batch.candidates && batch.candidates.length > 0 ? batch.candidates : batch.candidateIds || []).map(
    (c) => c.toString()
  );

  let acceptedCount = 0;
  let duplicateCount = 0;
  let rejectedCount = 0;

  const nowTimestamp = new Date();

  // 2. Process each submitted impression
  for (let i = 0; i < impressions.length; i++) {
    const item = impressions[i];
    const { recommendationId, visibleAt, visibleDurationMs, position } = item;

    if (!recommendationId || typeof recommendationId !== 'string') {
      rejectedCount++;
      continue;
    }

    // Extract candidate ID from opaque recommendation ID (`rec_${batchId}_${candidateId}`)
    const lastUnderscoreIndex = recommendationId.lastIndexOf('_');
    const candidateId = lastUnderscoreIndex !== -1 ? recommendationId.substring(lastUnderscoreIndex + 1) : null;

    if (!candidateId || !batchCandidates.includes(candidateId)) {
      rejectedCount++;
      continue;
    }

    // Prevent self-impression
    if (candidateId === viewerId.toString()) {
      rejectedCount++;
      continue;
    }

    // Validate visible timestamp
    let clientVisibleAt = nowTimestamp;
    let isDelayed = false;

    if (visibleAt) {
      const parsedTime = new Date(visibleAt).getTime();
      if (!isNaN(parsedTime)) {
        if (parsedTime > now + 60000) {
          // Future timestamp beyond 60s tolerance is rejected
          rejectedCount++;
          continue;
        }
        if (now - parsedTime > 60000) {
          isDelayed = true;
        }
        clientVisibleAt = new Date(parsedTime);
      }
    }

    const pos = typeof position === 'number' && position >= 0 ? position : i;
    const duration = typeof visibleDurationMs === 'number' && visibleDurationMs >= 0 ? visibleDurationMs : 0;

    try {
      const impressionDoc = await ProfileImpression.create({
        viewer: viewerId,
        candidate: candidateId,
        recommendationId,
        recommendationBatchId: batchId,
        position: pos,
        surface: batch.surface || 'DISCOVERY_FEED',
        configVersion: batch.rankingConfigVersion || 'v1.0-mvp',
        visibleAt: clientVisibleAt,
        visibleDurationMs: duration,
        isDelayedSubmission: isDelayed,
      });

      acceptedCount++;

      // Create outbox event for analytics/telemetry pipeline
      try {
        await OutboxEvent.create({
          eventType: 'profile.impression',
          aggregateType: 'IMPRESSION',
          aggregateId: impressionDoc._id.toString(),
          payload: {
            impressionId: impressionDoc._id.toString(),
            recommendationId,
            batchId,
            viewerId: viewerId.toString(),
            candidateId: candidateId.toString(),
            surface: batch.surface || 'DISCOVERY_FEED',
            position: pos,
            recordedAt: nowTimestamp,
          },
          deduplicationKey: `imp_${viewerId}_${candidateId}_${batchId}`,
        });
      } catch (outboxErr) {
        console.warn('[IMPRESSION SERVICE] Outbox event recording warning:', outboxErr.message);
      }
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate impression for this viewer + candidate + batch
        duplicateCount++;
      } else {
        console.error('[IMPRESSION SERVICE] Failed to record impression item:', err.message);
        rejectedCount++;
      }
    }
  }

  return {
    accepted: acceptedCount,
    duplicates: duplicateCount,
    rejected: rejectedCount,
  };
}

module.exports = {
  recordConfirmedImpressions,
  ImpressionServiceError,
};
