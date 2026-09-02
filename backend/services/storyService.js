const mongoose = require('mongoose');
const Content = require('../models/Content');
const MediaAsset = require('../models/MediaAsset');
const Profile = require('../models/Profile');
const FollowRelationship = require('../models/FollowRelationship');
const Block = require('../models/Block');
const User = require('../models/User');
const StoryView = require('../models/StoryView');
const OutboxEvent = require('../models/OutboxEvent');
const socialPolicyService = require('./socialPolicyService');
const { AuthorizationContexts } = require('./socialPolicyService');
const { serializeContentForViewer } = require('../utils/contentSerializers');

const STORY_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

class StoryService {
  /**
   * Create a new Story
   */
  async createStory(authorId, payload = {}) {
    if (!authorId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const { mediaAssetId, caption = '', audience = 'PUBLIC', idempotencyKey } = payload;

    if (!mediaAssetId) {
      const err = new Error('mediaAssetId is required to create a Story.');
      err.code = 'MISSING_MEDIA_ASSET';
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

    // 2. Validate and Bind Media Asset
    const mediaAsset = await MediaAsset.findOne({
      _id: mediaAssetId,
      ownerId: authorId,
      deletedAt: null,
    });

    if (!mediaAsset) {
      const err = new Error('Media asset not found or not owned by author.');
      err.code = 'MEDIA_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (mediaAsset.processingStatus !== 'READY') {
      const err = new Error(`Media is not ready for publication (status: ${mediaAsset.processingStatus}).`);
      err.code = 'MEDIA_NOT_READY';
      err.statusCode = 400;
      throw err;
    }

    if (mediaAsset.moderationStatus === 'REJECTED') {
      const err = new Error('Media asset failed moderation checks.');
      err.code = 'MEDIA_MODERATION_REJECTED';
      err.statusCode = 403;
      throw err;
    }

    // 3. Idempotency Check
    if (idempotencyKey) {
      const existing = await Content.findOne({ authorId, idempotencyKey });
      if (existing) {
        return serializeContentForViewer(existing);
      }
    }

    // 4. Determine Sequence Position
    const now = new Date();
    const activeStoriesCount = await Content.countDocuments({
      authorId,
      contentType: 'STORY',
      status: 'PUBLISHED',
      expiresAt: { $gt: now },
    });

    const sequencePosition = activeStoriesCount;
    const publishedAt = now;
    const expiresAt = new Date(publishedAt.getTime() + STORY_DURATION_MS);

    // 5. Construct Safe Media Items Payload
    const mediaItem = {
      mediaAssetId: mediaAsset._id,
      position: 0,
      mediaType: mediaAsset.mediaType,
      variants: mediaAsset.variants,
      thumbnail: mediaAsset.thumbnail,
      width: mediaAsset.width || 1080,
      height: mediaAsset.height || 1920,
      aspectRatio: (mediaAsset.width && mediaAsset.height) ? (mediaAsset.width / mediaAsset.height) : 0.5625,
      durationMs: mediaAsset.durationMs || 0,
    };

    // 6. Create Story Document
    const storyDoc = await Content.create({
      authorId,
      contentType: 'STORY',
      caption: (caption || '').trim(),
      mediaItems: [mediaItem],
      audience: ['PUBLIC', 'FOLLOWERS'].includes(audience) ? audience : 'PUBLIC',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      sequenceGroupId: authorId.toString(),
      sequencePosition,
      viewsCount: 0,
      publishedAt,
      expiresAt,
      idempotencyKey,
    });

    // 7. Emit Durable Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'story.created',
        aggregateType: 'CONTENT',
        aggregateId: storyDoc._id.toString(),
        payload: {
          storyId: storyDoc._id.toString(),
          authorId: authorId.toString(),
          mediaAssetId: mediaAsset._id.toString(),
          publishedAt: publishedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        deduplicationKey: `story_create_${storyDoc._id}`,
      });
    } catch (outboxErr) {
      console.warn('[STORY OUTBOX EMIT WARNING]', outboxErr.message);
    }

    return serializeContentForViewer(storyDoc);
  }

  /**
   * Retrieve Story Tray for Authenticated Viewer
   */
  async getStoryTray(viewerId) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const now = new Date();

    // 1. Gather Candidate Authors (Followed ACCEPTED + Self, minus Blocked)
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
    candidateAuthorIdSet.add(viewerStr); // Viewer self

    for (const f of follows) {
      const followingStr = f.followingId.toString();
      if (!blockedUserIds.has(followingStr)) {
        candidateAuthorIdSet.add(followingStr);
      }
    }

    const candidateAuthorIds = Array.from(candidateAuthorIdSet).map((id) => new mongoose.Types.ObjectId(id));

    if (candidateAuthorIds.length === 0) {
      return { groups: [] };
    }

    // 2. Query All Active, Non-Expired Published Stories
    const rawStories = await Content.find({
      authorId: { $in: candidateAuthorIds },
      contentType: 'STORY',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      expiresAt: { $gt: now },
    })
      .sort({ publishedAt: 1, sequencePosition: 1 })
      .lean();

    if (!rawStories || rawStories.length === 0) {
      return { groups: [] };
    }

    // 3. Central Batch Authorization Check
    const evaluated = await socialPolicyService.batchEvaluateContentAccess({
      viewerId,
      contentDocs: rawStories,
      context: AuthorizationContexts.FUTURE_FEED_CANDIDATE,
    });

    const authorizedStories = evaluated.filter((e) => e.allowed).map((e) => e.contentDoc);
    if (authorizedStories.length === 0) {
      return { groups: [] };
    }

    // 4. Group Stories by Author & Collect Story IDs
    const storyIds = authorizedStories.map((s) => s._id);
    const authorIds = Array.from(new Set(authorizedStories.map((s) => s.authorId.toString())));

    // 5. Bulk Hydrate Profiles & Viewer Views
    const [profiles, userViews] = await Promise.all([
      Profile.find({ user: { $in: authorIds } })
        .select('user displayName username avatarUri isVerified isPrivate')
        .lean(),
      StoryView.find({
        viewerId,
        storyId: { $in: storyIds },
      })
        .select('storyId')
        .lean(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
    const viewedStoryIdSet = new Set(userViews.map((v) => v.storyId.toString()));

    // Group stories by author
    const groupsByAuthor = new Map();

    for (const story of authorizedStories) {
      const authorStr = story.authorId.toString();
      if (!groupsByAuthor.has(authorStr)) {
        groupsByAuthor.set(authorStr, []);
      }
      groupsByAuthor.get(authorStr).push(story);
    }

    const groups = [];

    // Prioritize self-group first, then sort other authors with unviewed stories first
    for (const [authorStr, authorStories] of groupsByAuthor.entries()) {
      const profile = profileMap.get(authorStr) || {
        displayName: 'User',
        avatarUri: '',
      };

      const hasUnviewed = authorStories.some((s) => !viewedStoryIdSet.has(s._id.toString()));
      const latestStory = authorStories[authorStories.length - 1];
      const previewThumbnail = latestStory.mediaItems?.[0]?.thumbnail?.url || latestStory.mediaItems?.[0]?.variants?.[0]?.url || '';

      const serializedStories = authorStories.map((s) => {
        const dto = serializeContentForViewer(s, { authorProfile: profile });
        dto.isViewed = viewedStoryIdSet.has(s._id.toString());
        return dto;
      });

      groups.push({
        authorId: authorStr,
        author: {
          userId: authorStr,
          displayName: profile.displayName,
          username: profile.username,
          avatarUri: profile.avatarUri,
          isVerified: Boolean(profile.isVerified),
          isSelf: authorStr === viewerStr,
        },
        hasUnviewed: authorStr === viewerStr ? false : hasUnviewed,
        storyCount: authorStories.length,
        latestPublishedAt: latestStory.publishedAt,
        previewThumbnail,
        stories: serializedStories,
      });
    }

    // Sort: Viewer self first, then unviewed groups, then latest published
    groups.sort((a, b) => {
      if (a.author.isSelf) return -1;
      if (b.author.isSelf) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return new Date(b.latestPublishedAt).getTime() - new Date(a.latestPublishedAt).getTime();
    });

    return { groups };
  }

  /**
   * Retrieve Single Story
   */
  async getStoryById(viewerId, storyId) {
    if (!storyId) {
      const err = new Error('storyId is required.');
      err.code = 'INVALID_STORY_ID';
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const story = await Content.findById(storyId).lean();

    if (!story || story.contentType !== 'STORY' || story.status === 'DELETED') {
      const err = new Error('Story not found or removed.');
      err.code = 'STORY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Synchronous Read-Time Expiry Check
    if (story.status !== 'PUBLISHED' || new Date(story.expiresAt) <= now) {
      const err = new Error('Story has expired.');
      err.code = 'STORY_EXPIRED';
      err.statusCode = 404;
      throw err;
    }

    // Central Authorization
    const access = await socialPolicyService.evaluateSocialContentAccess({
      viewerId,
      contentDoc: story,
      context: AuthorizationContexts.CONTENT_DETAIL,
    });

    if (!access.allowed) {
      const err = new Error(access.reason || 'Not authorized to view this Story.');
      err.code = access.reasonCode || 'FORBIDDEN';
      err.statusCode = access.safeErrorStatus || 403;
      throw err;
    }

    const [profile, viewRecord] = await Promise.all([
      Profile.findOne({ user: story.authorId }).select('user displayName username avatarUri isVerified').lean(),
      StoryView.findOne({ storyId, viewerId }).select('_id').lean(),
    ]);

    const dto = serializeContentForViewer(story, { authorProfile: profile });
    dto.isViewed = Boolean(viewRecord);
    return dto;
  }

  /**
   * Retrieve Story Sequence for a User
   */
  async getUserStories(viewerId, targetUserId) {
    if (!targetUserId) {
      const err = new Error('targetUserId is required.');
      err.code = 'INVALID_USER_ID';
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    const stories = await Content.find({
      authorId: targetUserId,
      contentType: 'STORY',
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      expiresAt: { $gt: now },
    })
      .sort({ sequencePosition: 1, publishedAt: 1 })
      .lean();

    if (!stories || stories.length === 0) {
      return { author: null, stories: [] };
    }

    const evaluated = await socialPolicyService.batchEvaluateContentAccess({
      viewerId,
      contentDocs: stories,
      context: AuthorizationContexts.CONTENT_DETAIL,
    });

    const authorized = evaluated.filter((e) => e.allowed).map((e) => e.contentDoc);
    if (authorized.length === 0) {
      return { author: null, stories: [] };
    }

    const storyIds = authorized.map((s) => s._id);
    const [profile, userViews] = await Promise.all([
      Profile.findOne({ user: targetUserId }).select('user displayName username avatarUri isVerified isPrivate').lean(),
      StoryView.find({ viewerId, storyId: { $in: storyIds } }).select('storyId').lean(),
    ]);

    const viewedSet = new Set(userViews.map((v) => v.storyId.toString()));
    const serializedStories = authorized.map((s) => {
      const dto = serializeContentForViewer(s, { authorProfile: profile });
      dto.isViewed = viewedSet.has(s._id.toString());
      return dto;
    });

    return {
      author: profile,
      stories: serializedStories,
    };
  }

  /**
   * Record Story View (Idempotent)
   */
  async recordStoryView(viewerId, storyId, payload = {}) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const now = new Date();
    const story = await Content.findById(storyId);

    if (!story || story.contentType !== 'STORY' || story.status !== 'PUBLISHED' || new Date(story.expiresAt) <= now) {
      const err = new Error('Story is unavailable or expired.');
      err.code = 'STORY_UNAVAILABLE';
      err.statusCode = 404;
      throw err;
    }

    // Central Authorization Re-check
    const access = await socialPolicyService.evaluateSocialContentAccess({
      viewerId,
      contentDoc: story,
      context: AuthorizationContexts.CONTENT_DETAIL,
    });

    if (!access.allowed) {
      const err = new Error('Not authorized to view Story.');
      err.code = access.reasonCode || 'FORBIDDEN';
      err.statusCode = access.safeErrorStatus || 403;
      throw err;
    }

    const eventId = payload.eventId || `view_${storyId}_${viewerId}_${Date.now()}`;

    // Upsert View Document
    let isNewView = false;
    try {
      await StoryView.create({
        eventId,
        storyId: story._id,
        storyAuthorId: story.authorId,
        viewerId,
        firstViewedAt: now,
        lastViewedAt: now,
      });

      isNewView = true;

      // Increment unique viewsCount on Story if viewer is not the author
      if (story.authorId.toString() !== viewerId.toString()) {
        await Content.updateOne({ _id: story._id }, { $inc: { viewsCount: 1 } });
      }

      // Publish Outbox Event
      try {
        await OutboxEvent.create({
          eventType: 'story.view_recorded',
          aggregateType: 'CONTENT',
          aggregateId: story._id.toString(),
          payload: {
            eventId,
            storyId: story._id.toString(),
            storyAuthorId: story.authorId.toString(),
            viewerId: viewerId.toString(),
            viewedAt: now.toISOString(),
          },
          deduplicationKey: `story_view_${story._id}_${viewerId}`,
        });
      } catch (outboxErr) {
        // Outbox deduplication collision handled safely
      }
    } catch (insertErr) {
      if (insertErr.code === 11000) {
        // Already viewed -> Update lastViewedAt
        await StoryView.updateOne(
          { storyId: story._id, viewerId },
          { $set: { lastViewedAt: now }, $inc: { viewCount: 1 } }
        );
      } else {
        throw insertErr;
      }
    }

    return {
      success: true,
      isNewView,
      status: isNewView ? 'RECORDED' : 'DUPLICATE',
    };
  }

  /**
   * Retrieve Story Viewers (Story Owner Only)
   */
  async getStoryViewers(viewerId, storyId, options = {}) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const story = await Content.findById(storyId).select('authorId contentType status').lean();
    if (!story || story.contentType !== 'STORY') {
      const err = new Error('Story not found.');
      err.code = 'STORY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Owner-Only Privacy Gate
    if (story.authorId.toString() !== viewerId.toString()) {
      const err = new Error('Viewer list is private to the Story owner.');
      err.code = 'VIEWER_LIST_PRIVATE';
      err.statusCode = 403;
      throw err;
    }

    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 20, 1), 50);

    const views = await StoryView.find({ storyId })
      .sort({ firstViewedAt: -1, _id: -1 })
      .limit(limit)
      .lean();

    const viewerUserIds = views.map((v) => v.viewerId);
    const profiles = await Profile.find({ user: { $in: viewerUserIds } })
      .select('user displayName username avatarUri isVerified')
      .lean();

    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    const viewersList = views.map((v) => {
      const p = profileMap.get(v.viewerId.toString()) || {};
      return {
        viewerId: v.viewerId,
        displayName: p.displayName || 'Rubaru User',
        username: p.username || '',
        avatarUri: p.avatarUri || '',
        isVerified: Boolean(p.isVerified),
        firstViewedAt: v.firstViewedAt,
      };
    });

    return {
      viewers: viewersList,
      totalViews: views.length,
    };
  }

  /**
   * Delete Story
   */
  async deleteStory(viewerId, storyId) {
    if (!viewerId) {
      const err = new Error('Authentication required.');
      err.code = 'AUTHENTICATION_REQUIRED';
      err.statusCode = 401;
      throw err;
    }

    const story = await Content.findById(storyId);
    if (!story || story.contentType !== 'STORY') {
      const err = new Error('Story not found.');
      err.code = 'STORY_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (story.authorId.toString() !== viewerId.toString()) {
      const err = new Error('Only the Story owner can delete this Story.');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    story.status = 'DELETED';
    story.deletedAt = new Date();
    await story.save();

    // Emit Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'story.deleted',
        aggregateType: 'CONTENT',
        aggregateId: story._id.toString(),
        payload: {
          storyId: story._id.toString(),
          authorId: viewerId.toString(),
          deletedAt: story.deletedAt.toISOString(),
        },
        deduplicationKey: `story_del_${story._id}`,
      });
    } catch (outboxErr) {
      console.warn('[STORY DELETE OUTBOX ERROR]', outboxErr.message);
    }

    return { success: true, message: 'Story deleted successfully.' };
  }

  /**
   * Batch Expiry Worker Method
   */
  async expireStoriesBatch(batchSize = 100) {
    const now = new Date();
    const expiredStories = await Content.find({
      contentType: 'STORY',
      status: 'PUBLISHED',
      expiresAt: { $lte: now },
    })
      .limit(batchSize)
      .select('_id authorId');

    if (!expiredStories || expiredStories.length === 0) {
      return { expiredCount: 0 };
    }

    const expiredIds = expiredStories.map((s) => s._id);
    await Content.updateMany(
      { _id: { $in: expiredIds } },
      { $set: { status: 'EXPIRED' } }
    );

    // Emit outbox events
    for (const story of expiredStories) {
      try {
        await OutboxEvent.create({
          eventType: 'story.expired',
          aggregateType: 'CONTENT',
          aggregateId: story._id.toString(),
          payload: {
            storyId: story._id.toString(),
            authorId: story.authorId.toString(),
            expiredAt: now.toISOString(),
          },
          deduplicationKey: `story_exp_${story._id}`,
        });
      } catch (err) {
        // Safe deduplication
      }
    }

    return { expiredCount: expiredStories.length };
  }
}

const storyService = new StoryService();
module.exports = storyService;
