const mongoose = require('mongoose');
const Content = require('../models/Content');
const Profile = require('../models/Profile');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');
const ContentLike = require('../models/ContentLike');
const Save = require('../models/Save');
const User = require('../models/User');
const FeedBatch = require('../models/FeedBatch');
const ContentImpression = require('../models/ContentImpression');
const OutboxEvent = require('../models/OutboxEvent');
const socialPolicyService = require('./socialPolicyService');
const { AuthorizationContexts } = require('./socialPolicyService');
const { serializeContentForViewer } = require('../utils/contentSerializers');

const ORDERING_VERSION = 'connected_feed_chronological_v1';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_IMPRESSION_BATCH_SIZE = 50;

class FeedService {
  constructor() {
    this.ORDERING_VERSION = ORDERING_VERSION;
  }

  /**
   * Parse and validate opaque base64 cursor
   */
  parseCursor(cursorStr) {
    if (!cursorStr) return null;
    try {
      const decoded = Buffer.from(cursorStr, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (!parsed.p || !parsed.i || !parsed.v) {
        const err = new Error('Invalid cursor structure.');
        err.code = 'INVALID_CURSOR';
        err.statusCode = 400;
        throw err;
      }
      if (parsed.v !== ORDERING_VERSION) {
        const err = new Error('Incompatible cursor ordering version.');
        err.code = 'INCOMPATIBLE_CURSOR_VERSION';
        err.statusCode = 400;
        throw err;
      }
      const publishedAtDate = new Date(parsed.p);
      if (isNaN(publishedAtDate.getTime())) {
        const err = new Error('Invalid cursor timestamp.');
        err.code = 'INVALID_CURSOR';
        err.statusCode = 400;
        throw err;
      }
      return {
        publishedAt: publishedAtDate,
        id: new mongoose.Types.ObjectId(parsed.i),
      };
    } catch (e) {
      if (e.code) throw e;
      const err = new Error('Malformed or corrupted feed cursor.');
      err.code = 'INVALID_CURSOR';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Generate opaque base64 cursor from item
   */
  encodeCursor(lastDoc) {
    if (!lastDoc || !lastDoc.publishedAt || !lastDoc._id) return null;
    const payload = {
      p: new Date(lastDoc.publishedAt).toISOString(),
      i: lastDoc._id.toString(),
      v: ORDERING_VERSION,
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Retrieve Connected Home Feed for viewer with server-assigned FeedBatch
   */
  async getConnectedFeed(viewerId, options = {}) {
    if (!viewerId) {
      const err = new Error('Authentication required for connected feed.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    // Check Feature Flag
    if (process.env.SOCIAL_CONNECTED_FEED_ENABLED === 'false') {
      const err = new Error('Connected feed is temporarily unavailable.');
      err.code = 'FEATURE_DISABLED';
      err.statusCode = 503;
      throw err;
    }

    const limit = Math.min(
      Math.max(parseInt(options.limit, 10) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE
    );

    const cursorData = this.parseCursor(options.cursor);

    // 1. Gather Candidate Authors: Followed users with ACCEPTED relationship + Viewer
    const [follows, blocks, viewerUser] = await Promise.all([
      FollowRelationship.find({
        followerId: viewerId,
        status: 'ACCEPTED',
      })
        .select('followingId')
        .lean(),
      Block.find({
        $or: [{ blocker: viewerId }, { blocked: viewerId }],
      })
        .select('blocker blocked')
        .lean(),
      User.findById(viewerId).select('_id isActive accountStatus').lean(),
    ]);

    if (!viewerUser || !viewerUser.isActive || viewerUser.accountStatus !== 'ACTIVE') {
      const err = new Error('User account is inactive or unavailable.');
      err.code = 'ACCOUNT_UNAVAILABLE';
      err.statusCode = 403;
      throw err;
    }

    // Extract blocked user IDs in either direction
    const viewerStr = viewerId.toString();
    const blockedUserIds = new Set(
      blocks.map((b) => (b.blocker.toString() === viewerStr ? b.blocked.toString() : b.blocker.toString()))
    );

    // Build candidate author set (Followed + Viewer, minus Blocked)
    const candidateAuthorIdSet = new Set();
    candidateAuthorIdSet.add(viewerStr); // Viewer's own posts

    for (const f of follows) {
      const followingStr = f.followingId.toString();
      if (!blockedUserIds.has(followingStr)) {
        candidateAuthorIdSet.add(followingStr);
      }
    }

    const candidateAuthorIds = Array.from(candidateAuthorIdSet).map((id) => new mongoose.Types.ObjectId(id));

    // If no candidate authors exist
    if (candidateAuthorIds.length === 0) {
      return {
        items: [],
        pageInfo: {
          nextCursor: null,
          hasMore: false,
        },
        feed: {
          batchId: null,
          surface: 'HOME_CONNECTED',
          source: 'CONNECTED',
          orderingVersion: ORDERING_VERSION,
          generatedAt: new Date().toISOString(),
          reason: 'NO_CONNECTED_CONTENT',
        },
      };
    }

    // 2. Query Candidate Posts (Bounded Over-fetching to avoid underfilled pages)
    const fetchLimit = Math.min(Math.ceil(limit * 1.5), 60);

    const queryFilter = {
      contentType: 'POST',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      authorId: { $in: candidateAuthorIds },
    };

    if (cursorData) {
      queryFilter.$or = [
        { publishedAt: { $lt: cursorData.publishedAt } },
        { publishedAt: cursorData.publishedAt, _id: { $lt: cursorData.id } },
      ];
    }

    const rawCandidates = await Content.find(queryFilter)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(fetchLimit)
      .lean();

    if (!rawCandidates || rawCandidates.length === 0) {
      return {
        items: [],
        pageInfo: {
          nextCursor: null,
          hasMore: false,
        },
        feed: {
          batchId: null,
          surface: 'HOME_CONNECTED',
          source: 'CONNECTED',
          orderingVersion: ORDERING_VERSION,
          generatedAt: new Date().toISOString(),
          reason: rawCandidates.length === 0 && !cursorData ? 'NO_CONNECTED_CONTENT' : undefined,
        },
      };
    }

    // 3. Central Batch Authorization
    const evaluatedResults = await socialPolicyService.batchEvaluateContentAccess({
      viewerId,
      contentDocs: rawCandidates,
      context: AuthorizationContexts.FUTURE_FEED_CANDIDATE,
    });

    const authorizedCandidates = evaluatedResults
      .filter((res) => res.allowed)
      .map((res) => res.contentDoc);

    const hasMore = authorizedCandidates.length > limit || rawCandidates.length >= fetchLimit;
    const pageItems = authorizedCandidates.slice(0, limit);

    // 4. Bulk Hydrate Projections & Interaction States (N+1 Prevention)
    const postIds = pageItems.map((p) => p._id);
    const authorIds = Array.from(new Set(pageItems.map((p) => p.authorId.toString())));

    const [profiles, userLikes, userSaves] = await Promise.all([
      Profile.find({ user: { $in: authorIds } })
        .select('user displayName username avatarUri isVerified')
        .lean(),
      ContentLike.find({
        userId: viewerId,
        contentId: { $in: postIds },
        status: 'ACTIVE',
      })
        .select('contentId')
        .lean(),
      Save.find({
        userId: viewerId,
        contentId: { $in: postIds },
        status: 'ACTIVE',
      })
        .select('contentId')
        .lean(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
    const likedSet = new Set(userLikes.map((l) => l.contentId.toString()));
    const savedSet = new Set(userSaves.map((s) => s.contentId.toString()));

    // 5. Serialize Safe DTOs with Position Assignment
    const serializedItems = pageItems.map((post, index) => {
      const authorIdStr = post.authorId.toString();
      const profile = profileMap.get(authorIdStr);

      const serialized = serializeContentForViewer(post, {
        authorProfile: profile,
        isLiked: likedSet.has(post._id.toString()),
        isSaved: savedSet.has(post._id.toString()),
      });
      serialized.feedPosition = index;
      return serialized;
    });

    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem) : null;

    // 6. Create Server-Controlled FeedBatch Identity
    const batchId = `fbatch_${new mongoose.Types.ObjectId().toString()}`;
    const issuedItems = pageItems.map((p, index) => ({
      contentId: p._id,
      authorId: p.authorId,
      position: index,
      source: 'CONNECTED',
    }));

    try {
      await FeedBatch.create({
        batchId,
        viewerId,
        surface: 'HOME_CONNECTED',
        source: 'CONNECTED',
        orderingVersion: ORDERING_VERSION,
        requestId: options.requestId || '',
        issuedItems,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });
    } catch (batchErr) {
      console.warn('[FEED BATCH CREATION WARNING]', batchErr.message);
    }

    return {
      items: serializedItems,
      pageInfo: {
        nextCursor,
        hasMore: Boolean(hasMore && nextCursor),
      },
      feed: {
        batchId: pageItems.length > 0 ? batchId : null,
        surface: 'HOME_CONNECTED',
        source: 'CONNECTED',
        orderingVersion: ORDERING_VERSION,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Ingest batched visibility impressions
   */
  async recordImpressions(viewerId, payload = {}) {
    if (!viewerId) {
      const err = new Error('Authentication required to record impressions.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const { batchId, events } = payload;
    if (!batchId || typeof batchId !== 'string') {
      const err = new Error('Missing or invalid batchId.');
      err.code = 'INVALID_BATCH_ID';
      err.statusCode = 400;
      throw err;
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      const err = new Error('Events array must contain at least 1 item.');
      err.code = 'EMPTY_EVENTS_ARRAY';
      err.statusCode = 400;
      throw err;
    }

    if (events.length > MAX_IMPRESSION_BATCH_SIZE) {
      const err = new Error(`Exceeded maximum events limit (${MAX_IMPRESSION_BATCH_SIZE}).`);
      err.code = 'EXCESSIVE_EVENT_COUNT';
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify FeedBatch
    const feedBatch = await FeedBatch.findOne({ batchId });
    if (!feedBatch) {
      const err = new Error('Feed batch not found or expired.');
      err.code = 'FEED_BATCH_NOT_FOUND';
      err.statusCode = 400;
      throw err;
    }

    if (feedBatch.viewerId.toString() !== viewerId.toString()) {
      const err = new Error('Feed batch ownership mismatch.');
      err.code = 'BATCH_OWNERSHIP_INVALID';
      err.statusCode = 403;
      throw err;
    }

    if (new Date(feedBatch.expiresAt) < new Date()) {
      const err = new Error('Feed batch has expired.');
      err.code = 'FEED_BATCH_EXPIRED';
      err.statusCode = 400;
      throw err;
    }

    // Build issued map: contentId -> issuedItem
    const issuedMap = new Map(
      feedBatch.issuedItems.map((item) => [item.contentId.toString(), item])
    );

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;
    const rejectionReasons = [];

    // 2. Validate and insert each impression idempotently
    for (let idx = 0; idx < events.length; idx++) {
      const event = events[idx];
      const {
        eventId,
        contentId,
        position,
        visiblePercentage = 100,
        qualifiedAt,
        dwellTimeMs = 0,
      } = event;

      // Event structure checks
      if (!eventId || typeof eventId !== 'string') {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'INVALID_EVENT_ID' });
        continue;
      }

      if (!contentId || typeof position !== 'number') {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'INVALID_EVENT_PAYLOAD' });
        continue;
      }

      // Check membership in issued batch
      const issuedItem = issuedMap.get(contentId.toString());
      if (!issuedItem || issuedItem.position !== position) {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'CONTENT_POSITION_MISMATCH' });
        continue;
      }

      // Visibility percentage threshold check (>= 50%)
      if (typeof visiblePercentage !== 'number' || visiblePercentage < 50 || visiblePercentage > 100) {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'INVALID_VISIBILITY_PERCENTAGE' });
        continue;
      }

      // Dwell time bounds check
      const clampedDwellTime = Math.min(Math.max(Number(dwellTimeMs) || 0, 0), 300000);
      if (dwellTimeMs < 0) {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'NEGATIVE_DWELL_TIME' });
        continue;
      }

      // Qualified timestamp sanity check
      const qualifiedDate = qualifiedAt ? new Date(qualifiedAt) : new Date();
      if (isNaN(qualifiedDate.getTime()) || qualifiedDate.getTime() > Date.now() + 60000) {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'FUTURE_TIMESTAMP_REJECTED' });
        continue;
      }

      try {
        await ContentImpression.create({
          eventId,
          viewerId,
          contentId: issuedItem.contentId,
          authorId: issuedItem.authorId,
          batchId,
          surface: feedBatch.surface,
          source: feedBatch.source,
          position: issuedItem.position,
          orderingVersion: feedBatch.orderingVersion,
          visiblePercentage,
          qualifiedAt: qualifiedDate,
          serverReceivedAt: new Date(),
          dwellTimeMs: clampedDwellTime,
          sessionId: event.sessionId || '',
          appState: event.appState || 'active',
          eventSchemaVersion: '1.0',
        });

        accepted++;

        // Publish durable analytics event to outbox
        try {
          await OutboxEvent.create({
            eventType: 'content.impression_recorded',
            aggregateType: 'CONTENT',
            aggregateId: issuedItem.contentId.toString(),
            payload: {
              eventId,
              viewerId: viewerId.toString(),
              contentId: issuedItem.contentId.toString(),
              authorId: issuedItem.authorId.toString(),
              batchId,
              surface: feedBatch.surface,
              source: feedBatch.source,
              position: issuedItem.position,
              orderingVersion: feedBatch.orderingVersion,
              qualifiedAt: qualifiedDate.toISOString(),
              dwellTimeMs: clampedDwellTime,
            },
            deduplicationKey: `imp_${eventId}`,
          });
        } catch (outboxErr) {
          // Outbox deduplication collision handled safely
        }
      } catch (insertErr) {
        if (insertErr.code === 11000) {
          // Duplicate eventId -> Idempotent success
          duplicates++;
        } else {
          rejected++;
          rejectionReasons.push({ index: idx, code: 'INSERTION_FAILED', message: insertErr.message });
        }
      }
    }

    return {
      accepted,
      duplicates,
      rejected,
      rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons : undefined,
    };
  }
}

const feedService = new FeedService();
module.exports = feedService;
