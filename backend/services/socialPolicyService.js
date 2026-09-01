const User = require('../models/User');
const Profile = require('../models/Profile');
const Block = require('../models/Block');
const FollowRelationship = require('../models/FollowRelationship');
const ReporterSuppression = require('../models/ReporterSuppression');

/**
 * Authorization Contexts
 */
const AuthorizationContexts = {
  PROFILE_VIEW: 'PROFILE_VIEW',
  CONTENT_DETAIL: 'CONTENT_DETAIL',
  PROFILE_CONTENT_LIST: 'PROFILE_CONTENT_LIST',
  MEDIA_DELIVERY: 'MEDIA_DELIVERY',
  OWNER_MANAGEMENT: 'OWNER_MANAGEMENT',
  MODERATOR_REVIEW: 'MODERATOR_REVIEW',
  FUTURE_FEED_CANDIDATE: 'FUTURE_FEED_CANDIDATE',
  FUTURE_INTERACTION: 'FUTURE_INTERACTION',
};

/**
 * Centralized Social Content Visibility & Access Policy Service
 */
class SocialPolicyService {
  /**
   * Determine if viewer can access target user's social profile details
   */
  async canViewSocialProfile(viewerId, targetId, context = AuthorizationContexts.PROFILE_VIEW) {
    if (!targetId) {
      return { allowed: false, reason: 'INVALID_PARAMETERS', reasonCode: 'ACCOUNT_UNAVAILABLE' };
    }

    const viewerStr = viewerId ? viewerId.toString() : '';
    const targetStr = targetId.toString();

    // 1. Self-Access
    if (viewerStr && viewerStr === targetStr) {
      return { allowed: true, reason: 'SELF', reasonCode: 'OWNER', safeProjectionLevel: 'OWNER' };
    }

    // 2. Check Target Account Active State
    const targetUser = await User.findById(targetId);
    if (!targetUser || !targetUser.isActive || targetUser.accountStatus !== 'ACTIVE') {
      return { allowed: false, reason: 'INACTIVE', reasonCode: 'ACCOUNT_UNAVAILABLE', safeProjectionLevel: 'NONE' };
    }

    // 3. Bilateral Block Check
    if (viewerId) {
      const isBlocked = await Block.exists({
        $or: [
          { blocker: viewerId, blocked: targetId },
          { blocker: targetId, blocked: viewerId },
        ],
      });

      if (isBlocked) {
        return { allowed: false, reason: 'BLOCKED', reasonCode: 'BLOCKED', safeProjectionLevel: 'NONE' };
      }
    }

    // 4. Check Target Privacy Setting
    const targetProfile = await Profile.findOne({ user: targetId });
    const visibility = targetProfile ? targetProfile.socialAccountVisibility : 'PUBLIC';

    if (visibility === 'PUBLIC') {
      return { allowed: true, reason: 'PUBLIC_ACCOUNT', reasonCode: 'PUBLIC', safeProjectionLevel: 'PUBLIC' };
    }

    // 5. If Private Account, verify Accepted Follow Relationship
    if (!viewerId) {
      return { allowed: false, reason: 'AUTH_REQUIRED', reasonCode: 'AUTH_REQUIRED', safeProjectionLevel: 'NONE' };
    }

    const relationship = await FollowRelationship.findOne({
      followerId: viewerId,
      followingId: targetId,
      status: 'ACCEPTED',
    });

    if (relationship) {
      return { allowed: true, reason: 'ACCEPTED_FOLLOWER', reasonCode: 'ACCEPTED_FOLLOWER', safeProjectionLevel: 'FOLLOWER' };
    }

    return { allowed: false, reason: 'PRIVATE_ACCOUNT', reasonCode: 'PRIVATE_ACCOUNT', safeProjectionLevel: 'NONE' };
  }

  /**
   * Determine if viewer can list target user's followers
   */
  async canViewFollowerList(viewerId, targetId) {
    return this.canViewSocialProfile(viewerId, targetId, AuthorizationContexts.PROFILE_CONTENT_LIST);
  }

  /**
   * Determine if viewer can list target user's following list
   */
  async canViewFollowingList(viewerId, targetId) {
    return this.canViewSocialProfile(viewerId, targetId, AuthorizationContexts.PROFILE_CONTENT_LIST);
  }

  /**
   * Determine if viewer can interact with target user (Follow, Request, etc.)
   */
  async canInteractWithSocialUser(viewerId, targetId) {
    if (!viewerId || !targetId) {
      return { allowed: false, reason: 'INVALID_PARAMETERS', reasonCode: 'ACCOUNT_UNAVAILABLE' };
    }

    const viewerStr = viewerId.toString();
    const targetStr = targetId.toString();

    if (viewerStr === targetStr) {
      return { allowed: false, reason: 'SELF_INTERACTION_DISALLOWED', reasonCode: 'OWNER' };
    }

    const [viewerUser, targetUser] = await Promise.all([
      User.findById(viewerId),
      User.findById(targetId),
    ]);

    if (!viewerUser || !viewerUser.isActive || viewerUser.accountStatus !== 'ACTIVE') {
      return { allowed: false, reason: 'VIEWER_INACTIVE', reasonCode: 'ACCOUNT_UNAVAILABLE' };
    }

    if (!targetUser || !targetUser.isActive || targetUser.accountStatus !== 'ACTIVE') {
      return { allowed: false, reason: 'TARGET_INACTIVE', reasonCode: 'ACCOUNT_UNAVAILABLE' };
    }

    const isBlocked = await Block.exists({
      $or: [
        { blocker: viewerId, blocked: targetId },
        { blocker: targetId, blocked: viewerId },
      ],
    });

    if (isBlocked) {
      return { allowed: false, reason: 'BLOCKED', reasonCode: 'BLOCKED' };
    }

    return { allowed: true, reason: 'ELIGIBLE', reasonCode: 'PUBLIC' };
  }

  /**
   * Authoritative Policy Evaluation for Single Content Access
   */
  async evaluateSocialContentAccess({ viewerId, contentDoc, context = AuthorizationContexts.CONTENT_DETAIL }) {
    if (!contentDoc) {
      return {
        allowed: false,
        reasonCode: 'CONTENT_UNAVAILABLE',
        safeProjectionLevel: 'NONE',
        safeErrorStatus: 404,
        safeErrorCode: 'CONTENT_NOT_FOUND',
      };
    }

    const authorStr = contentDoc.authorId ? contentDoc.authorId.toString() : '';
    const viewerStr = viewerId ? viewerId.toString() : '';
    const isOwner = Boolean(viewerStr && viewerStr === authorStr);

    // 1. Author Account State Check
    const authorUser = await User.findById(contentDoc.authorId);
    if (!authorUser || !authorUser.isActive || authorUser.accountStatus !== 'ACTIVE') {
      return {
        allowed: false,
        reasonCode: 'ACCOUNT_UNAVAILABLE',
        authorId: authorStr,
        safeProjectionLevel: 'NONE',
        safeErrorStatus: 404,
        safeErrorCode: 'USER_UNAVAILABLE',
      };
    }

    // 2. Owner Access Evaluation
    if (isOwner) {
      if (contentDoc.status === 'DELETED') {
        return {
          allowed: false,
          reasonCode: 'CONTENT_UNAVAILABLE',
          authorId: authorStr,
          safeProjectionLevel: 'NONE',
          safeErrorStatus: 404,
          safeErrorCode: 'CONTENT_NOT_FOUND',
        };
      }
      return {
        allowed: true,
        reasonCode: 'OWNER',
        authorId: authorStr,
        safeProjectionLevel: 'OWNER',
        safeErrorStatus: 200,
      };
    }

    // 3. Lifecycle Status Check for Non-Owners (Only PUBLISHED is accessible)
    if (contentDoc.status !== 'PUBLISHED') {
      return {
        allowed: false,
        reasonCode: 'CONTENT_UNAVAILABLE',
        authorId: authorStr,
        safeProjectionLevel: 'NONE',
        safeErrorStatus: 404,
        safeErrorCode: 'CONTENT_NOT_FOUND',
      };
    }

    // 4. Moderation Status Check (APPROVED or NOT_STARTED / RESTORED allowed)
    if (['REJECTED', 'HIDDEN', 'ESCALATED', 'PENDING'].includes(contentDoc.moderationStatus)) {
      return {
        allowed: false,
        reasonCode: 'MODERATION_RESTRICTED',
        authorId: authorStr,
        safeProjectionLevel: 'NONE',
        safeErrorStatus: 404,
        safeErrorCode: 'CONTENT_NOT_FOUND',
      };
    }

    // 5. Bilateral Block Check
    if (viewerId) {
      const isBlocked = await Block.exists({
        $or: [
          { blocker: viewerId, blocked: contentDoc.authorId },
          { blocker: contentDoc.authorId, blocked: viewerId },
        ],
      });
      if (isBlocked) {
        return {
          allowed: false,
          reasonCode: 'BLOCKED',
          authorId: authorStr,
          safeProjectionLevel: 'NONE',
          safeErrorStatus: 404,
          safeErrorCode: 'CONTENT_NOT_FOUND',
        };
      }

      // Reporter immediate suppression check
      const isSuppressed = await ReporterSuppression.exists({
        reporterId: viewerId,
        $or: [
          { subjectId: contentDoc._id },
          { subjectId: contentDoc.authorId },
        ],
      });
      if (isSuppressed) {
        return {
          allowed: false,
          reasonCode: 'SUPPRESSED',
          authorId: authorStr,
          safeProjectionLevel: 'NONE',
          safeErrorStatus: 404,
          safeErrorCode: 'CONTENT_NOT_FOUND',
        };
      }
    }

    // 6. Check Account Privacy & Content Audience Matrix
    const authorProfile = await Profile.findOne({ user: contentDoc.authorId });
    const isPrivate = authorProfile?.socialAccountVisibility === 'PRIVATE';
    const isFollowersAudience = contentDoc.audience === 'FOLLOWERS';

    if (isPrivate || isFollowersAudience) {
      if (!viewerId) {
        return {
          allowed: false,
          reasonCode: 'AUTH_REQUIRED',
          authorId: authorStr,
          safeProjectionLevel: 'NONE',
          safeErrorStatus: 401,
          safeErrorCode: 'AUTHENTICATION_REQUIRED',
        };
      }

      const isAcceptedFollower = await FollowRelationship.exists({
        followerId: viewerId,
        followingId: contentDoc.authorId,
        status: 'ACCEPTED',
      });

      if (!isAcceptedFollower) {
        return {
          allowed: false,
          reasonCode: isPrivate ? 'PRIVATE_ACCOUNT' : 'AUDIENCE_DENIED',
          authorId: authorStr,
          safeProjectionLevel: 'NONE',
          safeErrorStatus: 403,
          safeErrorCode: isPrivate ? 'PRIVATE_ACCOUNT_ACCESS_DENIED' : 'FOLLOWERS_ONLY_ACCESS_DENIED',
        };
      }

      return {
        allowed: true,
        reasonCode: 'ACCEPTED_FOLLOWER',
        authorId: authorStr,
        safeProjectionLevel: 'FOLLOWER',
        safeErrorStatus: 200,
      };
    }

    // 7. Public Content
    return {
      allowed: true,
      reasonCode: 'PUBLIC',
      authorId: authorStr,
      safeProjectionLevel: 'PUBLIC',
      safeErrorStatus: 200,
    };
  }

  /**
   * Batch Evaluation Strategy for Content Lists (Feeds, User Posts)
   * Pre-fetches blocks, profiles, and follows in single queries to prevent N+1 queries.
   */
  async batchEvaluateContentAccess({ viewerId, contentDocs, context = AuthorizationContexts.PROFILE_CONTENT_LIST }) {
    if (!Array.isArray(contentDocs) || contentDocs.length === 0) {
      return [];
    }

    const viewerStr = viewerId ? viewerId.toString() : '';

    // Collect unique author IDs
    const authorIds = Array.from(new Set(contentDocs.map((c) => c.authorId?.toString()).filter(Boolean)));

    // Batch pre-fetch: Users, Profiles, Blocks, Follows, and Suppressions
    const [users, profiles, blocks, follows, suppressions] = await Promise.all([
      User.find({ _id: { $in: authorIds } }).select('_id isActive accountStatus'),
      Profile.find({ user: { $in: authorIds } }).select('user socialAccountVisibility displayName username avatarUri'),
      viewerId
        ? Block.find({
            $or: [
              { blocker: viewerId, blocked: { $in: authorIds } },
              { blocker: { $in: authorIds }, blocked: viewerId },
            ],
          })
        : [],
      viewerId
        ? FollowRelationship.find({
            followerId: viewerId,
            followingId: { $in: authorIds },
            status: 'ACCEPTED',
          })
        : [],
      viewerId
        ? ReporterSuppression.find({
            reporterId: viewerId,
          }).select('subjectId')
        : [],
    ]);

    const activeUserSet = new Set(users.filter((u) => u.isActive && u.accountStatus === 'ACTIVE').map((u) => u._id.toString()));
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));
    const blockedAuthorSet = new Set(
      blocks.map((b) => (b.blocker.toString() === viewerStr ? b.blocked.toString() : b.blocker.toString()))
    );
    const acceptedFollowSet = new Set(follows.map((f) => f.followingId.toString()));
    const suppressedIdSet = new Set((suppressions || []).map((s) => s.subjectId.toString()));

    // Synchronous evaluation per document
    return contentDocs.map((content) => {
      const authorId = content.authorId?.toString();
      const contentIdStr = content._id?.toString();
      const isOwner = Boolean(viewerStr && viewerStr === authorId);

      // Account active check
      if (!authorId || !activeUserSet.has(authorId)) {
        return {
          contentDoc: content,
          allowed: false,
          reasonCode: 'ACCOUNT_UNAVAILABLE',
          safeProjectionLevel: 'NONE',
        };
      }

      // Owner check
      if (isOwner) {
        if (content.status === 'DELETED') {
          return { contentDoc: content, allowed: false, reasonCode: 'CONTENT_UNAVAILABLE', safeProjectionLevel: 'NONE' };
        }
        return { contentDoc: content, allowed: true, reasonCode: 'OWNER', safeProjectionLevel: 'OWNER' };
      }

      // Suppression check
      if (suppressedIdSet.has(contentIdStr) || suppressedIdSet.has(authorId)) {
        return { contentDoc: content, allowed: false, reasonCode: 'SUPPRESSED', safeProjectionLevel: 'NONE' };
      }

      // Lifecycle check
      if (content.status !== 'PUBLISHED') {
        return { contentDoc: content, allowed: false, reasonCode: 'CONTENT_UNAVAILABLE', safeProjectionLevel: 'NONE' };
      }

      // Moderation check
      if (['REJECTED', 'HIDDEN', 'ESCALATED', 'PENDING'].includes(content.moderationStatus)) {
        return { contentDoc: content, allowed: false, reasonCode: 'MODERATION_RESTRICTED', safeProjectionLevel: 'NONE' };
      }

      // Block check
      if (blockedAuthorSet.has(authorId)) {
        return { contentDoc: content, allowed: false, reasonCode: 'BLOCKED', safeProjectionLevel: 'NONE' };
      }

      const p = profileMap.get(authorId);
      const isPrivate = p?.socialAccountVisibility === 'PRIVATE';
      const isFollowersAudience = content.audience === 'FOLLOWERS';

      if (isPrivate || isFollowersAudience) {
        if (!viewerId || !acceptedFollowSet.has(authorId)) {
          return {
            contentDoc: content,
            allowed: false,
            reasonCode: isPrivate ? 'PRIVATE_ACCOUNT' : 'AUDIENCE_DENIED',
            safeProjectionLevel: 'NONE',
          };
        }
        return { contentDoc: content, allowed: true, reasonCode: 'ACCEPTED_FOLLOWER', safeProjectionLevel: 'FOLLOWER' };
      }

      return { contentDoc: content, allowed: true, reasonCode: 'PUBLIC', safeProjectionLevel: 'PUBLIC' };
    });
  }
}

const socialPolicyService = new SocialPolicyService();

module.exports = socialPolicyService;
module.exports.AuthorizationContexts = AuthorizationContexts;
