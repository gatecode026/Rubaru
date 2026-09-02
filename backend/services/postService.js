const Content = require('../models/Content');
const Profile = require('../models/Profile');
const OutboxEvent = require('../models/OutboxEvent');
const mediaBindingService = require('./mediaBindingService');
const socialPolicyService = require('./socialPolicyService');

const { serializeContentForViewer } = require('../utils/contentSerializers');

class PostService {
  /**
   * Create an image, video, or carousel post
   */
  async createPost(authorId, data) {
    if (process.env.SOCIAL_POSTS_ENABLED === 'false') {
      const err = new Error('Social post creation is currently disabled.');
      err.code = 'FEATURE_DISABLED';
      err.statusCode = 403;
      throw err;
    }

    const {
      caption = '',
      mediaItems = [],
      audience,
      locationLabel = '',
      idempotencyKey,
    } = data;

    // 1. Validate Caption
    const sanitizedCaption = typeof caption === 'string' ? caption.trim() : '';
    if (sanitizedCaption.length > 2200) {
      const err = new Error('Caption exceeds maximum allowed length of 2200 characters.');
      err.code = 'CAPTION_TOO_LONG';
      err.statusCode = 400;
      throw err;
    }

    // 2. Enforce Owner-Scoped Idempotency
    if (idempotencyKey) {
      const existing = await Content.findOne({
        authorId,
        idempotencyKey,
        status: { $ne: 'DELETED' },
      });
      if (existing) {
        const authorProfile = await Profile.findOne({ user: authorId });
        return serializeContentForViewer(existing, authorProfile, 'OWNER');
      }
    }

    // 3. Validate and Bind Media Items
    const boundMediaItems = await mediaBindingService.validateAndBindMediaItems(authorId, mediaItems);

    // 4. Resolve Audience based on Author Privacy Setting
    const authorProfile = await Profile.findOne({ user: authorId });
    const isPrivate = authorProfile?.socialAccountVisibility === 'PRIVATE';

    let resolvedAudience = audience || (isPrivate ? 'FOLLOWERS' : 'PUBLIC');
    if (!['PUBLIC', 'FOLLOWERS'].includes(resolvedAudience)) {
      resolvedAudience = isPrivate ? 'FOLLOWERS' : 'PUBLIC';
    }

    // 5. Create Content document
    const now = new Date();
    const post = await Content.create({
      authorId,
      contentType: 'POST',
      caption: sanitizedCaption,
      mediaItems: boundMediaItems,
      audience: resolvedAudience,
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      locationLabel: (locationLabel || '').trim().slice(0, 100),
      publishedAt: now,
      idempotencyKey,
    });

    // 6. Record Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'post.created',
        aggregateType: 'USER',
        aggregateId: authorId.toString(),
        payload: {
          postId: post._id.toString(),
          authorId: authorId.toString(),
          contentType: 'POST',
          mediaCount: boundMediaItems.length,
          audience: resolvedAudience,
          publishedAt: now,
        },
        deduplicationKey: `post_create_${post._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[POST SERVICE] Outbox warning:', outboxErr.message);
    }

    return serializeContentForViewer(post, authorProfile, 'OWNER');
  }

  /**
   * Get single post by ID with centralized visibility evaluation
   */
  async getPostById(viewerId, postId) {
    const post = await Content.findById(postId);
    if (!post || post.status === 'DELETED') {
      const err = new Error('Post not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Centralized access policy evaluation
    const evalResult = await socialPolicyService.evaluateSocialContentAccess({
      viewerId,
      contentDoc: post,
      context: 'CONTENT_DETAIL',
    });

    if (!evalResult.allowed) {
      const err = new Error('You do not have permission to view this post.');
      err.code = evalResult.safeErrorCode || 'CONTENT_ACCESS_DENIED';
      err.statusCode = evalResult.safeErrorStatus || 404;
      throw err;
    }

    const authorProfile = await Profile.findOne({ user: post.authorId });
    return serializeContentForViewer(post, authorProfile, evalResult.safeProjectionLevel);
  }

  /**
   * Get paginated posts of a specific user with batch authorization
   */
  async getUserPosts(viewerId, targetUserId, { cursor, limit = 20, status = 'PUBLISHED' } = {}) {
    const authorProfile = await Profile.findOne({ user: targetUserId });
    if (!authorProfile) {
      const err = new Error('User not found.');
      err.code = 'USER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const isOwner = Boolean(viewerId && viewerId.toString() === targetUserId.toString());

    // Profile-level access check
    if (!isOwner) {
      const profileAuth = await socialPolicyService.canViewSocialProfile(viewerId, targetUserId);
      if (!profileAuth.allowed) {
        const err = new Error('You do not have permission to view this user posts.');
        err.code = profileAuth.reasonCode === 'PRIVATE_ACCOUNT' ? 'PRIVATE_ACCOUNT_ACCESS_DENIED' : 'USER_UNAVAILABLE';
        err.statusCode = profileAuth.reasonCode === 'PRIVATE_ACCOUNT' ? 403 : 404;
        throw err;
      }
    }

    const query = {
      authorId: targetUserId,
      contentType: 'POST',
      status: isOwner && status ? status : 'PUBLISHED',
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.publishedAt = { $lt: cursorDate };
      }
    }

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const posts = await Content.find(query)
      .sort({ publishedAt: -1, _id: -1 })
      .limit(maxLimit + 1);

    const hasMore = posts.length > maxLimit;
    const pageItems = hasMore ? posts.slice(0, maxLimit) : posts;

    // Batch evaluate access
    const evaluatedBatch = await socialPolicyService.batchEvaluateContentAccess({
      viewerId,
      contentDocs: pageItems,
      context: 'PROFILE_CONTENT_LIST',
    });

    const items = evaluatedBatch
      .filter((ev) => ev.allowed)
      .map((ev) => serializeContentForViewer(ev.contentDoc, authorProfile, ev.safeProjectionLevel));

    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(lastItem.publishedAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * Edit post caption, audience, or location
   */
  async editPost(authorId, postId, data) {
    const post = await Content.findById(postId);
    if (!post || post.status === 'DELETED') {
      const err = new Error('Post not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Owner check
    if (post.authorId.toString() !== authorId.toString()) {
      const err = new Error('You do not have permission to edit this post.');
      err.code = 'CONTENT_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    const { caption, audience, locationLabel, accessibilityDescriptions } = data;

    if (caption !== undefined) {
      const sanitized = typeof caption === 'string' ? caption.trim() : '';
      if (sanitized.length > 2200) {
        const err = new Error('Caption exceeds maximum allowed length of 2200 characters.');
        err.code = 'CAPTION_TOO_LONG';
        err.statusCode = 400;
        throw err;
      }
      post.caption = sanitized;
    }

    if (audience && ['PUBLIC', 'FOLLOWERS'].includes(audience)) {
      post.audience = audience;
    }

    if (locationLabel !== undefined) {
      post.locationLabel = (locationLabel || '').trim().slice(0, 100);
    }

    if (Array.isArray(accessibilityDescriptions)) {
      accessibilityDescriptions.forEach((desc, idx) => {
        if (post.mediaItems[idx]) {
          post.mediaItems[idx].accessibilityDescription = (desc || '').trim().slice(0, 300);
        }
      });
    }

    const now = new Date();
    post.editedAt = now;
    await post.save();

    // Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'content.updated',
        aggregateType: 'USER',
        aggregateId: authorId.toString(),
        payload: {
          postId: post._id.toString(),
          authorId: authorId.toString(),
          editedAt: now,
        },
        deduplicationKey: `post_edit_${post._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[POST SERVICE] Outbox warning:', outboxErr.message);
    }

    const authorProfile = await Profile.findOne({ user: authorId });
    return this._formatPostProjection(post, authorProfile);
  }

  /**
   * Archive a post
   */
  async archivePost(authorId, postId) {
    const post = await Content.findById(postId);
    if (!post || post.status === 'DELETED') {
      const err = new Error('Post not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (post.authorId.toString() !== authorId.toString()) {
      const err = new Error('You do not have permission to archive this post.');
      err.code = 'CONTENT_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    if (post.status === 'ARCHIVED') {
      return { archived: true, postId: post._id.toString() };
    }

    const now = new Date();
    post.status = 'ARCHIVED';
    post.archivedAt = now;
    await post.save();

    try {
      await OutboxEvent.create({
        eventType: 'content.archived',
        aggregateType: 'USER',
        aggregateId: authorId.toString(),
        payload: {
          postId: post._id.toString(),
          authorId: authorId.toString(),
          archivedAt: now,
        },
        deduplicationKey: `post_arch_${post._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[POST SERVICE] Outbox warning:', outboxErr.message);
    }

    return { archived: true, postId: post._id.toString() };
  }

  /**
   * Unarchive a post
   */
  async unarchivePost(authorId, postId) {
    const post = await Content.findById(postId);
    if (!post || post.status === 'DELETED') {
      const err = new Error('Post not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (post.authorId.toString() !== authorId.toString()) {
      const err = new Error('You do not have permission to unarchive this post.');
      err.code = 'CONTENT_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    if (post.status === 'PUBLISHED') {
      return { unarchived: true, postId: post._id.toString() };
    }

    const now = new Date();
    post.status = 'PUBLISHED';
    post.archivedAt = null;
    await post.save();

    try {
      await OutboxEvent.create({
        eventType: 'content.unarchived',
        aggregateType: 'USER',
        aggregateId: authorId.toString(),
        payload: {
          postId: post._id.toString(),
          authorId: authorId.toString(),
          unarchivedAt: now,
        },
        deduplicationKey: `post_unarch_${post._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[POST SERVICE] Outbox warning:', outboxErr.message);
    }

    return { unarchived: true, postId: post._id.toString() };
  }

  /**
   * Soft delete a post
   */
  async deletePost(authorId, postId) {
    const post = await Content.findById(postId);
    if (!post) {
      const err = new Error('Post not found.');
      err.code = 'CONTENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (post.authorId.toString() !== authorId.toString()) {
      const err = new Error('You do not have permission to delete this post.');
      err.code = 'CONTENT_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    if (post.status === 'DELETED') {
      return { deleted: true, postId: post._id.toString() };
    }

    const now = new Date();
    post.status = 'DELETED';
    post.deletedAt = now;
    post.deletionReason = 'OWNER_DELETED';
    await post.save();

    try {
      await OutboxEvent.create({
        eventType: 'content.deleted',
        aggregateType: 'USER',
        aggregateId: authorId.toString(),
        payload: {
          postId: post._id.toString(),
          authorId: authorId.toString(),
          deletedAt: now,
        },
        deduplicationKey: `post_del_${post._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[POST SERVICE] Outbox warning:', outboxErr.message);
    }

    return { deleted: true, postId: post._id.toString() };
  }

  _formatPostProjection(post, authorProfile = null) {
    return {
      postId: post._id.toString(),
      authorId: post.authorId.toString(),
      author: {
        userId: post.authorId.toString(),
        displayName: authorProfile ? authorProfile.displayName : 'Rubaru User',
        username: authorProfile ? authorProfile.username || '' : '',
        avatarUri: authorProfile ? authorProfile.avatarUri || '' : '',
      },
      contentType: post.contentType,
      caption: post.caption,
      mediaItems: (post.mediaItems || []).map((m) => ({
        mediaAssetId: m.mediaAssetId.toString(),
        position: m.position,
        mediaType: m.mediaType,
        width: m.width,
        height: m.height,
        aspectRatio: m.aspectRatio,
        thumbnail: m.thumbnail,
        variants: m.variants,
        accessibilityDescription: m.accessibilityDescription,
      })),
      audience: post.audience,
      status: post.status,
      locationLabel: post.locationLabel,
      publishedAt: post.publishedAt,
      editedAt: post.editedAt,
      archivedAt: post.archivedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}

const postService = new PostService();

module.exports = postService;
