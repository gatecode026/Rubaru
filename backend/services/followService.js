const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Block = require('../models/Block');
const Notification = require('../models/Notification');
const OutboxEvent = require('../models/OutboxEvent');
const FollowRelationship = require('../models/FollowRelationship');
const socialPolicyService = require('./socialPolicyService');

class FollowService {
  /**
   * Follow a user or request to follow if private
   */
  async followUser(followerId, targetId) {
    if (process.env.SOCIAL_FOLLOW_GRAPH_ENABLED === 'false') {
      const err = new Error('Follow graph operations are currently disabled.');
      err.code = 'FEATURE_DISABLED';
      err.statusCode = 403;
      throw err;
    }

    if (!followerId || !targetId) {
      const err = new Error('Invalid user IDs provided.');
      err.code = 'INVALID_PARAMETERS';
      err.statusCode = 400;
      throw err;
    }

    if (followerId.toString() === targetId.toString()) {
      const err = new Error('You cannot follow yourself.');
      err.code = 'SELF_FOLLOW_DISALLOWED';
      err.statusCode = 400;
      throw err;
    }

    // 1. Validate Interaction Eligibility (Active accounts & No Blocks)
    const eligibility = await socialPolicyService.canInteractWithSocialUser(followerId, targetId);
    if (!eligibility.allowed) {
      const err = new Error('User is unavailable or action cannot be completed.');
      err.code = eligibility.reason === 'BLOCKED' ? 'USER_UNAVAILABLE' : 'USER_INACTIVE';
      err.statusCode = 400;
      throw err;
    }

    // 2. Fetch Target Profile & Privacy Setting
    const [followerProfile, targetProfile] = await Promise.all([
      Profile.findOne({ user: followerId }),
      Profile.findOne({ user: targetId }),
    ]);

    if (!targetProfile || !followerProfile) {
      const err = new Error('Profile not found.');
      err.code = 'PROFILE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const isTargetPrivate = targetProfile.socialAccountVisibility === 'PRIVATE';

    // 3. Find Existing Relationship
    let relationship = await FollowRelationship.findOne({
      followerId,
      followingId: targetId,
    });

    const now = new Date();

    if (relationship) {
      if (relationship.status === 'ACCEPTED') {
        return {
          relationship: {
            status: 'ACCEPTED',
            isFollowing: true,
            requestPending: false,
          },
        };
      }

      if (relationship.status === 'PENDING') {
        return {
          relationship: {
            status: 'PENDING',
            isFollowing: false,
            requestPending: true,
          },
        };
      }

      // Check Cooldown if previously DECLINED (24 hours cooldown)
      if (relationship.status === 'DECLINED' && relationship.declinedAt) {
        const cooldownMs = 24 * 60 * 60 * 1000;
        if (now - relationship.declinedAt < cooldownMs) {
          const err = new Error('Follow request was recently declined. Please wait before retrying.');
          err.code = 'FOLLOW_REQUEST_COOLDOWN_ACTIVE';
          err.statusCode = 429;
          throw err;
        }
      }
    }

    // 4. Determine Target Status
    const targetStatus = isTargetPrivate ? 'PENDING' : 'ACCEPTED';

    if (!relationship) {
      relationship = new FollowRelationship({
        followerId,
        followingId: targetId,
        status: targetStatus,
        requestedAt: now,
        acceptedAt: targetStatus === 'ACCEPTED' ? now : null,
        lastTransitionAt: now,
      });
    } else {
      relationship.status = targetStatus;
      relationship.requestedAt = now;
      relationship.acceptedAt = targetStatus === 'ACCEPTED' ? now : null;
      relationship.declinedAt = null;
      relationship.removedAt = null;
      relationship.cancelledAt = null;
      relationship.lastTransitionAt = now;
    }

    await relationship.save();

    // 5. Update Projection Counters if ACCEPTED
    if (targetStatus === 'ACCEPTED') {
      await Promise.all([
        Profile.updateOne({ user: followerId }, { $inc: { followingCount: 1 } }),
        Profile.updateOne({ user: targetId }, { $inc: { followersCount: 1 } }),
      ]);

      // Emit Outbox Event
      try {
        await OutboxEvent.create({
          eventType: 'follow.accepted',
          aggregateType: 'USER',
          aggregateId: followerId.toString(),
          payload: {
            relationshipId: relationship._id.toString(),
            followerId: followerId.toString(),
            followingId: targetId.toString(),
            status: 'ACCEPTED',
            acceptedAt: now,
          },
          deduplicationKey: `follow_acc_${followerId}_${targetId}_${now.getTime()}`,
        });
      } catch (outboxErr) {
        console.warn('[FOLLOW SERVICE] Outbox recording warning:', outboxErr.message);
      }

      // In-App Notification
      try {
        await Notification.create({
          recipient: targetId,
          sender: followerId,
          type: 'follow',
          message: `${followerProfile.displayName || 'Someone'} started following you.`,
        });
      } catch (notifErr) {
        console.warn('[FOLLOW SERVICE] Notification error:', notifErr.message);
      }
    } else {
      // PENDING Private Request
      try {
        await OutboxEvent.create({
          eventType: 'follow.requested',
          aggregateType: 'USER',
          aggregateId: followerId.toString(),
          payload: {
            relationshipId: relationship._id.toString(),
            followerId: followerId.toString(),
            followingId: targetId.toString(),
            status: 'PENDING',
            requestedAt: now,
          },
          deduplicationKey: `follow_req_${followerId}_${targetId}_${now.getTime()}`,
        });
      } catch (outboxErr) {
        console.warn('[FOLLOW SERVICE] Outbox recording warning:', outboxErr.message);
      }

      try {
        await Notification.create({
          recipient: targetId,
          sender: followerId,
          type: 'follow',
          message: `${followerProfile.displayName || 'Someone'} requested to follow you.`,
        });
      } catch (notifErr) {
        console.warn('[FOLLOW SERVICE] Notification error:', notifErr.message);
      }
    }

    return {
      relationship: {
        status: targetStatus,
        isFollowing: targetStatus === 'ACCEPTED',
        requestPending: targetStatus === 'PENDING',
      },
    };
  }

  /**
   * Unfollow a user or cancel an outgoing pending follow request
   */
  async unfollowUser(followerId, targetId) {
    const relationship = await FollowRelationship.findOne({
      followerId,
      followingId: targetId,
    });

    if (!relationship || ['REMOVED', 'CANCELLED'].includes(relationship.status)) {
      return {
        relationship: {
          status: 'NONE',
          isFollowing: false,
          requestPending: false,
        },
      };
    }

    const previousStatus = relationship.status;
    const now = new Date();

    if (previousStatus === 'ACCEPTED') {
      relationship.status = 'REMOVED';
      relationship.removedAt = now;
      relationship.lastTransitionAt = now;
      await relationship.save();

      // Decrement counters safely (non-negative)
      await Promise.all([
        Profile.updateOne({ user: followerId, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
        Profile.updateOne({ user: targetId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }),
      ]);

      try {
        await OutboxEvent.create({
          eventType: 'follow.removed',
          aggregateType: 'USER',
          aggregateId: followerId.toString(),
          payload: {
            relationshipId: relationship._id.toString(),
            followerId: followerId.toString(),
            followingId: targetId.toString(),
            removedAt: now,
          },
          deduplicationKey: `follow_rem_${followerId}_${targetId}_${now.getTime()}`,
        });
      } catch (outboxErr) {
        console.warn('[FOLLOW SERVICE] Outbox error:', outboxErr.message);
      }
    } else if (previousStatus === 'PENDING') {
      relationship.status = 'CANCELLED';
      relationship.cancelledAt = now;
      relationship.lastTransitionAt = now;
      await relationship.save();

      try {
        await OutboxEvent.create({
          eventType: 'follow.cancelled',
          aggregateType: 'USER',
          aggregateId: followerId.toString(),
          payload: {
            relationshipId: relationship._id.toString(),
            followerId: followerId.toString(),
            followingId: targetId.toString(),
            cancelledAt: now,
          },
          deduplicationKey: `follow_can_${followerId}_${targetId}_${now.getTime()}`,
        });
      } catch (outboxErr) {
        console.warn('[FOLLOW SERVICE] Outbox error:', outboxErr.message);
      }
    }

    return {
      relationship: {
        status: 'NONE',
        isFollowing: false,
        requestPending: false,
      },
    };
  }

  /**
   * Get list of pending follow requests for the authenticated target user
   */
  async getPendingFollowRequests(targetId, { cursor, limit = 20 } = {}) {
    const query = {
      followingId: targetId,
      status: 'PENDING',
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.requestedAt = { $lt: cursorDate };
      }
    }

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const requests = await FollowRelationship.find(query)
      .sort({ requestedAt: -1 })
      .limit(maxLimit + 1)
      .populate('followerId', '_id email isActive accountStatus');

    const hasMore = requests.length > maxLimit;
    const pageItems = hasMore ? requests.slice(0, maxLimit) : requests;

    // Hydrate safe profiles
    const followerIds = pageItems.map((r) => r.followerId?._id).filter(Boolean);
    const profiles = await Profile.find({ user: { $in: followerIds } });
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    const items = pageItems.map((r) => {
      const u = r.followerId;
      const p = u ? profileMap.get(u._id.toString()) : null;
      return {
        requestId: r._id.toString(),
        followerId: u ? u._id.toString() : null,
        displayName: p ? p.displayName : 'Rubaru User',
        username: p ? p.username || '' : '',
        avatarUri: p ? p.avatarUri || '' : '',
        bio: p ? p.bio || '' : '',
        requestedAt: r.requestedAt,
      };
    });

    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(lastItem.requestedAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * Target user accepts a pending follow request
   */
  async acceptFollowRequest(targetId, requestId) {
    const relationship = await FollowRelationship.findById(requestId);
    if (!relationship) {
      const err = new Error('Follow request not found.');
      err.code = 'FOLLOW_REQUEST_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // IDOR Protection: only target can accept
    if (relationship.followingId.toString() !== targetId.toString()) {
      const err = new Error('You are not authorized to accept this follow request.');
      err.code = 'UNAUTHORIZED_REQUEST_ACTION';
      err.statusCode = 403;
      throw err;
    }

    if (relationship.status === 'ACCEPTED') {
      return { status: 'ACCEPTED', accepted: true };
    }

    if (relationship.status !== 'PENDING') {
      const err = new Error('Follow request is no longer pending.');
      err.code = 'REQUEST_NOT_PENDING';
      err.statusCode = 400;
      throw err;
    }

    // Bilateral Block check
    const isBlocked = await Block.exists({
      $or: [
        { blocker: targetId, blocked: relationship.followerId },
        { blocker: relationship.followerId, blocked: targetId },
      ],
    });

    if (isBlocked) {
      relationship.status = 'CANCELLED';
      await relationship.save();
      const err = new Error('Action cannot be completed.');
      err.code = 'USER_UNAVAILABLE';
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    relationship.status = 'ACCEPTED';
    relationship.acceptedAt = now;
    relationship.lastTransitionAt = now;
    await relationship.save();

    // Increment counters atomically
    await Promise.all([
      Profile.updateOne({ user: relationship.followerId }, { $inc: { followingCount: 1 } }),
      Profile.updateOne({ user: targetId }, { $inc: { followersCount: 1 } }),
    ]);

    // Outbox & Notification
    try {
      await OutboxEvent.create({
        eventType: 'follow.accepted',
        aggregateType: 'USER',
        aggregateId: targetId.toString(),
        payload: {
          relationshipId: relationship._id.toString(),
          followerId: relationship.followerId.toString(),
          followingId: targetId.toString(),
          acceptedAt: now,
        },
        deduplicationKey: `follow_acc_req_${relationship._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[FOLLOW SERVICE] Outbox warning:', outboxErr.message);
    }

    const targetProfile = await Profile.findOne({ user: targetId });
    try {
      await Notification.create({
        recipient: relationship.followerId,
        sender: targetId,
        type: 'follow',
        message: `${targetProfile ? targetProfile.displayName : 'A user'} accepted your follow request.`,
      });
    } catch (notifErr) {
      console.warn('[FOLLOW SERVICE] Notification warning:', notifErr.message);
    }

    return { status: 'ACCEPTED', accepted: true };
  }

  /**
   * Target user declines a pending follow request
   */
  async declineFollowRequest(targetId, requestId) {
    const relationship = await FollowRelationship.findById(requestId);
    if (!relationship) {
      const err = new Error('Follow request not found.');
      err.code = 'FOLLOW_REQUEST_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // IDOR Protection
    if (relationship.followingId.toString() !== targetId.toString()) {
      const err = new Error('You are not authorized to decline this follow request.');
      err.code = 'UNAUTHORIZED_REQUEST_ACTION';
      err.statusCode = 403;
      throw err;
    }

    if (relationship.status === 'DECLINED') {
      return { status: 'DECLINED', declined: true };
    }

    if (relationship.status !== 'PENDING') {
      const err = new Error('Follow request is no longer pending.');
      err.code = 'REQUEST_NOT_PENDING';
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    relationship.status = 'DECLINED';
    relationship.declinedAt = now;
    relationship.lastTransitionAt = now;
    await relationship.save();

    try {
      await OutboxEvent.create({
        eventType: 'follow.declined',
        aggregateType: 'USER',
        aggregateId: targetId.toString(),
        payload: {
          relationshipId: relationship._id.toString(),
          followerId: relationship.followerId.toString(),
          followingId: targetId.toString(),
          declinedAt: now,
        },
        deduplicationKey: `follow_dec_req_${relationship._id}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[FOLLOW SERVICE] Outbox warning:', outboxErr.message);
    }

    return { status: 'DECLINED', declined: true };
  }

  /**
   * Account owner removes an existing follower
   */
  async removeFollower(ownerId, followerId) {
    const relationship = await FollowRelationship.findOne({
      followerId,
      followingId: ownerId,
      status: 'ACCEPTED',
    });

    if (!relationship) {
      return { removed: true };
    }

    const now = new Date();
    relationship.status = 'REMOVED';
    relationship.removedAt = now;
    relationship.lastTransitionAt = now;
    await relationship.save();

    await Promise.all([
      Profile.updateOne({ user: followerId, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
      Profile.updateOne({ user: ownerId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }),
    ]);

    try {
      await OutboxEvent.create({
        eventType: 'follower.removed',
        aggregateType: 'USER',
        aggregateId: ownerId.toString(),
        payload: {
          relationshipId: relationship._id.toString(),
          followerId: followerId.toString(),
          followingId: ownerId.toString(),
          removedAt: now,
        },
        deduplicationKey: `follower_rem_${ownerId}_${followerId}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[FOLLOW SERVICE] Outbox warning:', outboxErr.message);
    }

    return { removed: true };
  }

  /**
   * List followers of target user
   */
  async getFollowersList(viewerId, targetId, { cursor, limit = 20 } = {}) {
    const authCheck = await socialPolicyService.canViewFollowerList(viewerId, targetId);
    if (!authCheck.allowed) {
      const err = new Error('You do not have permission to view this followers list.');
      err.code = authCheck.reason === 'PRIVATE_ACCOUNT' ? 'PRIVATE_ACCOUNT_ACCESS_DENIED' : 'USER_UNAVAILABLE';
      err.statusCode = authCheck.reason === 'PRIVATE_ACCOUNT' ? 403 : 404;
      throw err;
    }

    const query = {
      followingId: targetId,
      status: 'ACCEPTED',
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.acceptedAt = { $lt: cursorDate };
      }
    }

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const followers = await FollowRelationship.find(query)
      .sort({ acceptedAt: -1 })
      .limit(maxLimit + 1);

    const hasMore = followers.length > maxLimit;
    const pageItems = hasMore ? followers.slice(0, maxLimit) : followers;

    const followerUserIds = pageItems.map((r) => r.followerId);

    // Fetch profiles & exclude blocks
    const [profiles, blocks] = await Promise.all([
      Profile.find({ user: { $in: followerUserIds } }),
      Block.find({
        $or: [
          { blocker: viewerId, blocked: { $in: followerUserIds } },
          { blocker: { $in: followerUserIds }, blocked: viewerId },
        ],
      }),
    ]);

    const blockedSet = new Set(blocks.map((b) => (b.blocker.toString() === viewerId.toString() ? b.blocked.toString() : b.blocker.toString())));
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    // Query viewer relationships with these followers
    const viewerRelationships = await FollowRelationship.find({
      followerId: viewerId,
      followingId: { $in: followerUserIds },
    });
    const viewerRelMap = new Map(viewerRelationships.map((r) => [r.followingId.toString(), r.status]));

    const items = pageItems
      .filter((r) => !blockedSet.has(r.followerId.toString()))
      .map((r) => {
        const uId = r.followerId.toString();
        const p = profileMap.get(uId);
        const relStatus = viewerRelMap.get(uId) || 'NONE';
        return {
          userId: uId,
          displayName: p ? p.displayName : 'Rubaru User',
          username: p ? p.username || '' : '',
          avatarUri: p ? p.avatarUri || '' : '',
          bio: p ? p.bio || '' : '',
          isPrivate: p ? p.socialAccountVisibility === 'PRIVATE' : false,
          isFollowing: relStatus === 'ACCEPTED',
          requestPending: relStatus === 'PENDING',
          acceptedAt: r.acceptedAt,
        };
      });

    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(lastItem.acceptedAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * List following of target user
   */
  async getFollowingList(viewerId, targetId, { cursor, limit = 20 } = {}) {
    const authCheck = await socialPolicyService.canViewFollowingList(viewerId, targetId);
    if (!authCheck.allowed) {
      const err = new Error('You do not have permission to view this following list.');
      err.code = authCheck.reason === 'PRIVATE_ACCOUNT' ? 'PRIVATE_ACCOUNT_ACCESS_DENIED' : 'USER_UNAVAILABLE';
      err.statusCode = authCheck.reason === 'PRIVATE_ACCOUNT' ? 403 : 404;
      throw err;
    }

    const query = {
      followerId: targetId,
      status: 'ACCEPTED',
    };

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf8'));
      if (!isNaN(cursorDate.getTime())) {
        query.acceptedAt = { $lt: cursorDate };
      }
    }

    const maxLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

    const followings = await FollowRelationship.find(query)
      .sort({ acceptedAt: -1 })
      .limit(maxLimit + 1);

    const hasMore = followings.length > maxLimit;
    const pageItems = hasMore ? followings.slice(0, maxLimit) : followings;

    const followingUserIds = pageItems.map((r) => r.followingId);

    const [profiles, blocks] = await Promise.all([
      Profile.find({ user: { $in: followingUserIds } }),
      Block.find({
        $or: [
          { blocker: viewerId, blocked: { $in: followingUserIds } },
          { blocker: { $in: followingUserIds }, blocked: viewerId },
        ],
      }),
    ]);

    const blockedSet = new Set(blocks.map((b) => (b.blocker.toString() === viewerId.toString() ? b.blocked.toString() : b.blocker.toString())));
    const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

    const viewerRelationships = await FollowRelationship.find({
      followerId: viewerId,
      followingId: { $in: followingUserIds },
    });
    const viewerRelMap = new Map(viewerRelationships.map((r) => [r.followingId.toString(), r.status]));

    const items = pageItems
      .filter((r) => !blockedSet.has(r.followingId.toString()))
      .map((r) => {
        const uId = r.followingId.toString();
        const p = profileMap.get(uId);
        const relStatus = viewerRelMap.get(uId) || 'NONE';
        return {
          userId: uId,
          displayName: p ? p.displayName : 'Rubaru User',
          username: p ? p.username || '' : '',
          avatarUri: p ? p.avatarUri || '' : '',
          bio: p ? p.bio || '' : '',
          isPrivate: p ? p.socialAccountVisibility === 'PRIVATE' : false,
          isFollowing: relStatus === 'ACCEPTED',
          requestPending: relStatus === 'PENDING',
          acceptedAt: r.acceptedAt,
        };
      });

    let nextCursor = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = Buffer.from(lastItem.acceptedAt.toISOString()).toString('base64');
    }

    return { items, nextCursor, hasMore };
  }

  /**
   * Get relationship status between viewer and target
   */
  async getFollowStatus(viewerId, targetId) {
    if (viewerId.toString() === targetId.toString()) {
      return {
        status: 'SELF',
        isFollowing: false,
        followsYou: false,
        requestPending: false,
      };
    }

    const [viewerToTarget, targetToViewer] = await Promise.all([
      FollowRelationship.findOne({ followerId: viewerId, followingId: targetId }),
      FollowRelationship.findOne({ followerId: targetId, followingId: viewerId }),
    ]);

    return {
      status: viewerToTarget ? viewerToTarget.status : 'NONE',
      isFollowing: viewerToTarget?.status === 'ACCEPTED',
      followsYou: targetToViewer?.status === 'ACCEPTED',
      requestPending: viewerToTarget?.status === 'PENDING',
    };
  }

  /**
   * Update social account privacy (PUBLIC / PRIVATE)
   */
  async updateSocialPrivacy(userId, { socialAccountVisibility }) {
    if (!['PUBLIC', 'PRIVATE'].includes(socialAccountVisibility)) {
      const err = new Error("Invalid privacy setting. Must be 'PUBLIC' or 'PRIVATE'.");
      err.code = 'INVALID_PRIVACY_VALUE';
      err.statusCode = 400;
      throw err;
    }

    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      const err = new Error('Profile not found.');
      err.code = 'PROFILE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const previousSetting = profile.socialAccountVisibility;
    profile.socialAccountVisibility = socialAccountVisibility;
    await profile.save();

    try {
      await OutboxEvent.create({
        eventType: 'social.privacy_changed',
        aggregateType: 'USER',
        aggregateId: userId.toString(),
        payload: {
          userId: userId.toString(),
          previousSetting,
          newSetting: socialAccountVisibility,
          updatedAt: new Date(),
        },
        deduplicationKey: `privacy_chg_${userId}_${Date.now()}`,
      });
    } catch (outboxErr) {
      console.warn('[FOLLOW SERVICE] Outbox warning:', outboxErr.message);
    }

    return {
      socialAccountVisibility: profile.socialAccountVisibility,
    };
  }

  /**
   * Bilateral Block Enforcement Hook
   * Revokes all follow relationships and pending requests in both directions.
   */
  async handleBlockCreated(blockerId, blockedId) {
    const relationships = await FollowRelationship.find({
      $or: [
        { followerId: blockerId, followingId: blockedId },
        { followerId: blockedId, followingId: blockerId },
      ],
      status: { $in: ['ACCEPTED', 'PENDING'] },
    });

    const now = new Date();
    for (const rel of relationships) {
      const wasAccepted = rel.status === 'ACCEPTED';
      rel.status = wasAccepted ? 'REMOVED' : 'CANCELLED';
      if (wasAccepted) rel.removedAt = now;
      else rel.cancelledAt = now;
      rel.lastTransitionAt = now;
      await rel.save();

      if (wasAccepted) {
        // Adjust counters
        await Promise.all([
          Profile.updateOne({ user: rel.followerId, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }),
          Profile.updateOne({ user: rel.followingId, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }),
        ]);
      }
    }

    try {
      await OutboxEvent.create({
        eventType: 'social.relationships_revoked_by_block',
        aggregateType: 'SAFETY',
        aggregateId: blockerId.toString(),
        payload: {
          blockerId: blockerId.toString(),
          blockedId: blockedId.toString(),
          revokedCount: relationships.length,
          revokedAt: now,
        },
        deduplicationKey: `block_rev_soc_${blockerId}_${blockedId}_${now.getTime()}`,
      });
    } catch (outboxErr) {
      console.warn('[FOLLOW SERVICE] Outbox warning:', outboxErr.message);
    }

    return { revokedCount: relationships.length };
  }

  /**
   * Bounded Counter Reconciliation Tool
   */
  async reconcileFollowCounts(userId) {
    const [actualFollowers, actualFollowing] = await Promise.all([
      FollowRelationship.countDocuments({ followingId: userId, status: 'ACCEPTED' }),
      FollowRelationship.countDocuments({ followerId: userId, status: 'ACCEPTED' }),
    ]);

    await Profile.updateOne(
      { user: userId },
      {
        followersCount: actualFollowers,
        followingCount: actualFollowing,
      }
    );

    return {
      userId: userId.toString(),
      actualFollowers,
      actualFollowing,
    };
  }
}

const followService = new FollowService();

module.exports = followService;
