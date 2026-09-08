const mongoose = require('mongoose');
const Content = require('../models/Content');
const MediaAsset = require('../models/MediaAsset');
const Profile = require('../models/Profile');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');
const User = require('../models/User');
const ContentLike = require('../models/ContentLike');
const Save = require('../models/Save');
const FeedBatch = require('../models/FeedBatch');
const ReelPlaybackEvent = require('../models/ReelPlaybackEvent');
const OutboxEvent = require('../models/OutboxEvent');
const socialPolicyService = require('./socialPolicyService');
const { AuthorizationContexts } = require('./socialPolicyService');
const { serializeContentForViewer } = require('../utils/contentSerializers');

const ORDERING_VERSION = 'connected_reels_chronological_v1';
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 30;
const MAX_REEL_DURATION_MS = 90 * 1000; // 90 seconds
const MAX_PLAYBACK_BATCH_SIZE = 50;

class ReelService {
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
      const err = new Error('Malformed or corrupted reel cursor.');
      err.code = 'INVALID_CURSOR';
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Generate opaque base64 cursor
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
   * Create a new Reel
   */
  async createReel(authorId, payload = {}) {
    if (!authorId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    let videoMediaAssetId = payload.videoMediaAssetId || payload.mediaAssetId;
    const {
      coverMediaAssetId,
      caption = '',
      audience = 'PUBLIC',
      idempotencyKey,
    } = payload;

    if (!videoMediaAssetId && payload.videoUri) {
      const objKey = `reels/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.mp4`;
      const thumbUrl = payload.thumbnailUrl || (payload.videoUri.startsWith('http') ? `${payload.videoUri}/ik-thumbnail.jpg` : payload.videoUri);
      const createdAsset = await MediaAsset.create({
        ownerId: authorId,
        uploadSessionId: new mongoose.Types.ObjectId(),
        purpose: 'REEL_VIDEO',
        mediaType: 'VIDEO',
        originalObjectKey: objKey,
        originalMimeType: 'video/mp4',
        verifiedMimeType: 'video/mp4',
        processingStatus: 'READY',
        moderationStatus: 'APPROVED',
        fileSize: 1024 * 1024,
        width: 1080,
        height: 1920,
        aspectRatio: 0.5625,
        durationMs: payload.durationMs || 15000,
        thumbnail: {
          url: thumbUrl,
          width: 480,
          height: 854,
        },
        variants: [
          {
            name: 'source',
            objectKey: objKey,
            mimeType: 'video/mp4',
            url: payload.videoUri,
            width: 1080,
            height: 1920,
            fileSize: 1024 * 1024,
            bitrateKbps: 2500,
            processingState: 'READY',
          },
        ],
      });
      videoMediaAssetId = createdAsset._id;
    }

    if (!videoMediaAssetId) {
      const err = new Error('videoMediaAssetId is required.');
      err.code = 'MISSING_VIDEO_ASSET';
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify Author Account
    const authorUser = await User.findById(authorId).select('_id isActive accountStatus').lean();
    if (!authorUser || !authorUser.isActive || authorUser.accountStatus !== 'ACTIVE') {
      const err = new Error('Account is inactive or restricted.');
      err.code = 'ACCOUNT_INACTIVE';
      err.statusCode = 403;
      throw err;
    }

    // 2. Validate Video Media Asset
    const videoAsset = await MediaAsset.findOne({
      _id: videoMediaAssetId,
      ownerId: authorId,
      deletedAt: null,
    });

    if (!videoAsset) {
      const err = new Error('Video asset not found or not owned by author.');
      err.code = 'VIDEO_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (videoAsset.mediaType !== 'VIDEO') {
      const err = new Error('Reels require a video media asset.');
      err.code = 'INVALID_MEDIA_TYPE';
      err.statusCode = 400;
      throw err;
    }

    if (videoAsset.processingStatus !== 'READY') {
      const err = new Error(`Video is not ready (processingStatus: ${videoAsset.processingStatus}).`);
      err.code = 'VIDEO_NOT_READY';
      err.statusCode = 400;
      throw err;
    }

    if (videoAsset.moderationStatus === 'REJECTED') {
      const err = new Error('Video asset failed moderation checks.');
      err.code = 'VIDEO_MODERATION_REJECTED';
      err.statusCode = 403;
      throw err;
    }

    const durationMs = videoAsset.durationMs || 15000;
    if (durationMs > MAX_REEL_DURATION_MS) {
      const err = new Error('Reel duration exceeds the 90-second maximum limit.');
      err.code = 'EXCESSIVE_DURATION';
      err.statusCode = 400;
      throw err;
    }

    // 3. Optional Cover Media Asset
    let coverAsset = null;
    if (coverMediaAssetId) {
      coverAsset = await MediaAsset.findOne({
        _id: coverMediaAssetId,
        ownerId: authorId,
        processingStatus: 'READY',
        deletedAt: null,
      });
    }

    // 4. Idempotency Check
    if (idempotencyKey) {
      const existing = await Content.findOne({ authorId, idempotencyKey });
      if (existing) {
        return serializeContentForViewer(existing);
      }
    }

    // 5. Construct Media Item with Safe Delivery Variants
    const mediaItem = {
      mediaAssetId: videoAsset._id,
      position: 0,
      mediaType: 'VIDEO',
      variants: videoAsset.variants,
      thumbnail: coverAsset?.thumbnail?.url ? coverAsset.thumbnail : videoAsset.thumbnail,
      width: videoAsset.width || 1080,
      height: videoAsset.height || 1920,
      aspectRatio: (videoAsset.width && videoAsset.height) ? (videoAsset.width / videoAsset.height) : 0.5625,
      durationMs,
    };

    // 6. Create Authoritative Reel Content Record
    const publishedAt = new Date();
    const reelDoc = await Content.create({
      authorId,
      contentType: 'REEL',
      caption: (caption || '').trim(),
      mediaItems: [mediaItem],
      videoMediaAssetId: videoAsset._id,
      coverMediaAssetId: coverAsset?._id || null,
      durationMs,
      width: mediaItem.width,
      height: mediaItem.height,
      aspectRatio: mediaItem.aspectRatio,
      hasAudio: true,
      audioType: 'ORIGINAL',
      audience: ['PUBLIC', 'FOLLOWERS'].includes(audience) ? audience : 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      playCount: 0,
      viewsCount: 0,
      publishedAt,
      idempotencyKey,
    });

    // 7. Emit Durable Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'reel.published',
        aggregateType: 'CONTENT',
        aggregateId: reelDoc._id.toString(),
        payload: {
          reelId: reelDoc._id.toString(),
          authorId: authorId.toString(),
          videoMediaAssetId: videoAsset._id.toString(),
          durationMs,
          publishedAt: publishedAt.toISOString(),
        },
        deduplicationKey: `reel_pub_${reelDoc._id}`,
      });
    } catch (outboxErr) {
      console.warn('[REEL OUTBOX EMIT WARNING]', outboxErr.message);
    }

    return serializeContentForViewer(reelDoc);
  }

  /**
   * Retrieve Single Reel with Playback Context Token
   */
  async getReelById(viewerId, reelId) {
    if (!reelId) {
      const err = new Error('reelId is required.');
      err.code = 'INVALID_REEL_ID';
      err.statusCode = 400;
      throw err;
    }

    const reel = await Content.findById(reelId).lean();
    if (!reel || reel.contentType !== 'REEL' || reel.status === 'DELETED') {
      const err = new Error('Reel not found.');
      err.code = 'REEL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Central Authorization
    const access = await socialPolicyService.evaluateSocialContentAccess({
      viewerId,
      contentDoc: reel,
      context: AuthorizationContexts.CONTENT_DETAIL,
    });

    if (!access.allowed) {
      const err = new Error(access.reason || 'Not authorized to view this Reel.');
      err.code = access.reasonCode || 'FORBIDDEN';
      err.statusCode = access.safeErrorStatus || 403;
      throw err;
    }

    const [profile, userLike, userSave] = await Promise.all([
      Profile.findOne({ user: reel.authorId }).select('user displayName username avatarUri isVerified isPrivate').lean(),
      viewerId ? ContentLike.findOne({ userId: viewerId, contentId: reel._id, status: 'ACTIVE' }).select('_id').lean() : null,
      viewerId ? Save.findOne({ userId: viewerId, contentId: reel._id, status: 'ACTIVE' }).select('_id').lean() : null,
    ]);

    const dto = serializeContentForViewer(reel, {
      authorProfile: profile,
      isLiked: Boolean(userLike),
      isSaved: Boolean(userSave),
    });

    // Create Direct Playback Context Batch if viewer authenticated
    let playbackBatchId = null;
    if (viewerId) {
      playbackBatchId = `rbatch_direct_${new mongoose.Types.ObjectId().toString()}`;
      try {
        await FeedBatch.create({
          batchId: playbackBatchId,
          viewerId,
          surface: 'SHARED_REEL',
          source: 'CONNECTED',
          orderingVersion: ORDERING_VERSION,
          issuedItems: [
            {
              contentId: reel._id,
              authorId: reel.authorId,
              position: 0,
              source: 'CONNECTED',
            },
          ],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      } catch (bErr) {
        // Safe warning
      }
    }

    return {
      reel: dto,
      playbackContext: {
        batchId: playbackBatchId,
        surface: 'SHARED_REEL',
      },
    };
  }

  /**
   * Retrieve User Reels
   */
  async getUserReels(viewerId, targetUserId, options = {}) {
    if (!targetUserId) {
      const err = new Error('targetUserId is required.');
      err.code = 'INVALID_USER_ID';
      err.statusCode = 400;
      throw err;
    }

    const limit = Math.min(Math.max(parseInt(options.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const cursorData = this.parseCursor(options.cursor);

    const queryFilter = {
      authorId: targetUserId,
      contentType: 'REEL',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
    };

    if (cursorData) {
      queryFilter.$or = [
        { publishedAt: { $lt: cursorData.publishedAt } },
        { publishedAt: cursorData.publishedAt, _id: { $lt: cursorData.id } },
      ];
    }

    const rawReels = await Content.find(queryFilter)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    if (!rawReels || rawReels.length === 0) {
      return { items: [], pageInfo: { nextCursor: null, hasMore: false } };
    }

    const evaluated = await socialPolicyService.batchEvaluateContentAccess({
      viewerId,
      contentDocs: rawReels,
      context: AuthorizationContexts.PROFILE_CONTENT_LIST,
    });

    const authorized = evaluated.filter((e) => e.allowed).map((e) => e.contentDoc);
    const hasMore = authorized.length > limit;
    const pageItems = authorized.slice(0, limit);

    const postIds = pageItems.map((p) => p._id);
    const [profile, userLikes, userSaves] = await Promise.all([
      Profile.findOne({ user: targetUserId }).select('user displayName username avatarUri isVerified').lean(),
      viewerId ? ContentLike.find({ userId: viewerId, contentId: { $in: postIds }, status: 'ACTIVE' }).select('contentId').lean() : [],
      viewerId ? Save.find({ userId: viewerId, contentId: { $in: postIds }, status: 'ACTIVE' }).select('contentId').lean() : [],
    ]);

    const likedSet = new Set(userLikes.map((l) => l.contentId.toString()));
    const savedSet = new Set(userSaves.map((s) => s.contentId.toString()));

    const serializedItems = pageItems.map((reel) =>
      serializeContentForViewer(reel, {
        authorProfile: profile,
        isLiked: likedSet.has(reel._id.toString()),
        isSaved: savedSet.has(reel._id.toString()),
      })
    );

    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem) : null;

    return {
      items: serializedItems,
      pageInfo: {
        nextCursor,
        hasMore: Boolean(hasMore && nextCursor),
      },
    };
  }

  /**
   * Retrieve Connected Chronological Reels Feed
   */
  async getConnectedReelsFeed(viewerId, options = {}) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const limit = Math.min(Math.max(parseInt(options.limit, 10) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const cursorData = this.parseCursor(options.cursor);

    // 1. Candidate Authors (Accepted Follows + Self, minus Blocked)
    const [follows, blocks] = await Promise.all([
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
    ]);

    const viewerStr = viewerId.toString();
    const blockedUserIds = new Set(
      blocks.map((b) => (b.blocker.toString() === viewerStr ? b.blocked.toString() : b.blocker.toString()))
    );

    const candidateAuthorIdSet = new Set();
    candidateAuthorIdSet.add(viewerStr); // Viewer's own reels

    for (const f of follows) {
      const followingStr = f.followingId.toString();
      if (!blockedUserIds.has(followingStr)) {
        candidateAuthorIdSet.add(followingStr);
      }
    }

    const candidateAuthorIds = Array.from(candidateAuthorIdSet).map((id) => new mongoose.Types.ObjectId(id));

    if (candidateAuthorIds.length === 0) {
      return {
        items: [],
        pageInfo: { nextCursor: null, hasMore: false },
        feed: {
          batchId: null,
          surface: 'REELS_CONNECTED',
          source: 'CONNECTED',
          orderingVersion: ORDERING_VERSION,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // 2. Query Candidate Reels
    const fetchLimit = Math.min(Math.ceil(limit * 1.5), 45);
    const queryFilter = {
      contentType: 'REEL',
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

    let rawReels = await Content.find(queryFilter)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(fetchLimit)
      .lean();

    if (!rawReels || rawReels.length === 0) {
      // Fallback to all published reels so any user's profile reels play seamlessly
      const fallbackFilter = {
        contentType: 'REEL',
        status: 'PUBLISHED',
        moderationStatus: 'APPROVED',
      };
      if (blockedUserIds.size > 0) {
        fallbackFilter.authorId = { $nin: Array.from(blockedUserIds).map((id) => new mongoose.Types.ObjectId(id)) };
      }
      if (cursorData) {
        fallbackFilter.$or = [
          { publishedAt: { $lt: cursorData.publishedAt } },
          { publishedAt: cursorData.publishedAt, _id: { $lt: cursorData.id } },
        ];
      }
      rawReels = await Content.find(fallbackFilter)
        .sort({ publishedAt: -1, _id: -1 })
        .limit(fetchLimit)
        .lean();
    }

    if (!rawReels || rawReels.length === 0) {
      return {
        items: [],
        pageInfo: { nextCursor: null, hasMore: false },
        feed: {
          batchId: null,
          surface: 'REELS_CONNECTED',
          source: 'CONNECTED',
          orderingVersion: ORDERING_VERSION,
          generatedAt: new Date().toISOString(),
        },
      };
    }

    // 3. Central Batch Authorization
    const evaluated = await socialPolicyService.batchEvaluateContentAccess({
      viewerId,
      contentDocs: rawReels,
      context: AuthorizationContexts.FUTURE_FEED_CANDIDATE,
    });

    const authorized = evaluated.filter((e) => e.allowed).map((e) => e.contentDoc);
    const hasMore = authorized.length > limit || rawReels.length >= fetchLimit;
    const pageItems = authorized.slice(0, limit);

    // 4. Bulk Hydrate Profiles, Likes & Saves
    const reelIds = pageItems.map((r) => r._id);
    const authorIds = Array.from(new Set(pageItems.map((r) => r.authorId.toString())));

    const [profiles, userLikes, userSaves] = await Promise.all([
      Profile.find({ user: { $in: authorIds } })
        .select('user displayName username avatarUri isVerified')
        .lean(),
      ContentLike.find({
        userId: viewerId,
        contentId: { $in: reelIds },
        status: 'ACTIVE',
      })
        .select('contentId')
        .lean(),
      Save.find({
        userId: viewerId,
        contentId: { $in: reelIds },
        status: 'ACTIVE',
      })
        .select('contentId')
        .lean(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
    const likedSet = new Set(userLikes.map((l) => l.contentId.toString()));
    const savedSet = new Set(userSaves.map((s) => s.contentId.toString()));

    const serializedItems = pageItems.map((reel, index) => {
      const profile = profileMap.get(reel.authorId.toString());
      const dto = serializeContentForViewer(reel, {
        authorProfile: profile,
        isLiked: likedSet.has(reel._id.toString()),
        isSaved: savedSet.has(reel._id.toString()),
      });
      dto.reelPosition = index;
      return dto;
    });

    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor = hasMore && lastItem ? this.encodeCursor(lastItem) : null;

    // 5. Issue Server-Controlled FeedBatch
    const batchId = `rbatch_${new mongoose.Types.ObjectId().toString()}`;
    const issuedItems = pageItems.map((r, index) => ({
      contentId: r._id,
      authorId: r.authorId,
      position: index,
      source: 'CONNECTED',
    }));

    try {
      await FeedBatch.create({
        batchId,
        viewerId,
        surface: 'REELS_CONNECTED',
        source: 'CONNECTED',
        orderingVersion: ORDERING_VERSION,
        requestId: options.requestId || '',
        issuedItems,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    } catch (batchErr) {
      console.warn('[REELS BATCH WARNING]', batchErr.message);
    }

    return {
      items: serializedItems,
      pageInfo: {
        nextCursor,
        hasMore: Boolean(hasMore && nextCursor),
      },
      feed: {
        batchId: pageItems.length > 0 ? batchId : null,
        surface: 'REELS_CONNECTED',
        source: 'CONNECTED',
        orderingVersion: ORDERING_VERSION,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Ingest Batched Reel Playback Events
   */
  async recordPlaybackEvents(viewerId, payload = {}) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
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

    if (events.length > MAX_PLAYBACK_BATCH_SIZE) {
      const err = new Error(`Exceeded maximum events limit (${MAX_PLAYBACK_BATCH_SIZE}).`);
      err.code = 'EXCESSIVE_EVENT_COUNT';
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify FeedBatch
    const feedBatch = await FeedBatch.findOne({ batchId });
    if (!feedBatch) {
      const err = new Error('Reel playback batch not found or expired.');
      err.code = 'REEL_BATCH_NOT_FOUND';
      err.statusCode = 400;
      throw err;
    }

    if (feedBatch.viewerId.toString() !== viewerId.toString()) {
      const err = new Error('Batch ownership mismatch.');
      err.code = 'BATCH_OWNERSHIP_INVALID';
      err.statusCode = 403;
      throw err;
    }

    const issuedMap = new Map(feedBatch.issuedItems.map((i) => [i.contentId.toString(), i]));

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;
    const rejectionReasons = [];

    // 2. Validate & Insert Each Playback Event
    for (let idx = 0; idx < events.length; idx++) {
      const ev = events[idx];
      const {
        eventId,
        reelId,
        position = 0,
        playbackSessionId = '',
        eventType = 'PLAY_SUMMARY',
        watchedMs = 0,
        maxPositionMs = 0,
        replayed = false,
        skipped = false,
        muted = false,
        clientOccurredAt,
      } = ev;

      if (!eventId || typeof eventId !== 'string') {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'INVALID_EVENT_ID' });
        continue;
      }

      if (!reelId) {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'INVALID_REEL_ID' });
        continue;
      }

      const issuedItem = issuedMap.get(reelId.toString());
      if (!issuedItem || issuedItem.position !== position) {
        rejected++;
        rejectionReasons.push({ index: idx, code: 'REEL_POSITION_MISMATCH' });
        continue;
      }

      const clampedWatchedMs = Math.min(Math.max(Number(watchedMs) || 0, 0), 600000);
      const clampedMaxPos = Math.min(Math.max(Number(maxPositionMs) || 0, 0), 600000);

      // Resolve Reel duration to evaluate completion percentage
      const reelDoc = await Content.findById(reelId).select('durationMs playCount');
      const reelDurationMs = reelDoc?.durationMs || 15000;
      const completionPercentage = Math.min(
        Math.round((clampedMaxPos / Math.max(reelDurationMs, 1000)) * 100),
        100
      );
      const completed = completionPercentage >= 95;

      try {
        await ReelPlaybackEvent.create({
          eventId,
          viewerId,
          reelId: issuedItem.contentId,
          authorId: issuedItem.authorId,
          batchId,
          surface: feedBatch.surface,
          position: issuedItem.position,
          playbackSessionId,
          eventType,
          watchedMs: clampedWatchedMs,
          maxPositionMs: clampedMaxPos,
          durationMs: reelDurationMs,
          completionPercentage,
          completed,
          replayed: Boolean(replayed),
          skipped: Boolean(skipped),
          muted: Boolean(muted),
          clientOccurredAt: clientOccurredAt ? new Date(clientOccurredAt) : new Date(),
          serverReceivedAt: new Date(),
          eventSchemaVersion: '1.0',
        });

        accepted++;

        // Increment Reel playCount on first start / summary
        if (eventType === 'PLAY_STARTED' || completed) {
          await Content.updateOne({ _id: reelId }, { $inc: { playCount: 1 } });
        }

        // Publish Outbox Event
        try {
          await OutboxEvent.create({
            eventType: 'reel.playback_recorded',
            aggregateType: 'CONTENT',
            aggregateId: reelId.toString(),
            payload: {
              eventId,
              viewerId: viewerId.toString(),
              reelId: reelId.toString(),
              authorId: issuedItem.authorId.toString(),
              batchId,
              surface: feedBatch.surface,
              eventType,
              watchedMs: clampedWatchedMs,
              completionPercentage,
              completed,
            },
            deduplicationKey: `reel_play_${eventId}`,
          });
        } catch (outboxErr) {
          // Deduplication handled safely
        }
      } catch (insertErr) {
        if (insertErr.code === 11000) {
          duplicates++;
        } else {
          rejected++;
          rejectionReasons.push({ index: idx, code: 'INSERT_FAILED', message: insertErr.message });
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

  /**
   * Delete Reel
   */
  async deleteReel(viewerId, reelId) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const reel = await Content.findById(reelId);
    if (!reel || reel.contentType !== 'REEL') {
      const err = new Error('Reel not found.');
      err.code = 'REEL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (reel.authorId.toString() !== viewerId.toString()) {
      const err = new Error('Only the Reel author can delete this Reel.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    reel.status = 'DELETED';
    reel.deletedAt = new Date();
    await reel.save();

    // Emit Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'reel.deleted',
        aggregateType: 'CONTENT',
        aggregateId: reel._id.toString(),
        payload: {
          reelId: reel._id.toString(),
          authorId: viewerId.toString(),
          deletedAt: reel.deletedAt.toISOString(),
        },
        deduplicationKey: `reel_del_${reel._id}`,
      });
    } catch (outboxErr) {
      console.warn('[REEL DELETE OUTBOX WARNING]', outboxErr.message);
    }

    return { success: true, message: 'Reel deleted successfully.' };
  }

  /**
   * Archive Reel
   */
  async archiveReel(viewerId, reelId) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const reel = await Content.findById(reelId);
    if (!reel || reel.contentType !== 'REEL') {
      const err = new Error('Reel not found.');
      err.code = 'REEL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (reel.authorId.toString() !== viewerId.toString()) {
      const err = new Error('Only the Reel author can archive this Reel.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    reel.status = 'ARCHIVED';
    reel.archivedAt = new Date();
    await reel.save();

    return { success: true, message: 'Reel archived successfully.' };
  }

  /**
   * Unarchive Reel
   */
  async unarchiveReel(viewerId, reelId) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const reel = await Content.findById(reelId);
    if (!reel || reel.contentType !== 'REEL') {
      const err = new Error('Reel not found.');
      err.code = 'REEL_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (reel.authorId.toString() !== viewerId.toString()) {
      const err = new Error('Only the Reel author can unarchive this Reel.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    reel.status = 'PUBLISHED';
    reel.archivedAt = null;
    await reel.save();

    return { success: true, message: 'Reel restored to published state.' };
  }

  /**
   * Get User Published Reels
   */
  async getUserReels(viewerId, targetUserId, options = {}) {
    const effectiveUserId = (targetUserId === 'me' || !targetUserId) ? viewerId : targetUserId;
    if (!effectiveUserId) {
      const err = new Error('User ID is required.');
      err.code = 'USER_ID_REQUIRED';
      err.statusCode = 400;
      throw err;
    }

    const limit = Math.min(50, Math.max(1, parseInt(options.limit, 10) || 20));
    const query = {
      authorId: effectiveUserId,
      contentType: 'REEL',
      status: 'PUBLISHED',
      deletedAt: null,
    };

    const reels = await Content.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const serialized = await Promise.all(
      reels.map(async (r) => {
        const item = serializeContentForViewer(r, { viewerId });
        const firstMedia = r.mediaItems?.[0];
        const videoVariant = firstMedia?.variants?.find((v) => v.mimeType?.includes('video') || v.url?.endsWith('.mp4')) || firstMedia?.variants?.[0];
        const videoUrl = videoVariant?.url || '';
        const thumbUrl = firstMedia?.thumbnail?.url || videoUrl || '';
        return {
          ...item,
          id: r._id.toString(),
          videoUri: videoUrl,
          thumbnailUri: thumbUrl,
          viewsCount: r.viewsCount || r.playCount || 0,
          likesCount: r.likesCount || 0,
        };
      })
    );

    return {
      items: serialized,
      total: serialized.length,
      hasMore: false,
    };
  }
}

const reelService = new ReelService();
module.exports = reelService;
