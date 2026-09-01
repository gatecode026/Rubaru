const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const Device = require('../models/Device');
const Block = require('../models/Block');
const Profile = require('../models/Profile');
const Content = require('../models/Content');
const ReporterSuppression = require('../models/ReporterSuppression');
const { SocialNotificationTypes, NotificationCategories } = require('../models/enums');
const pushAdapter = require('./pushAdapter');

let socketIOInstance = null;

class NotificationService {
  /**
   * Bind Socket.io instance for real-time delivery
   */
  setSocketIO(io) {
    socketIOInstance = io;
  }

  /**
   * Helper to emit Socket.io event to user's room
   */
  _emitSocket(userId, eventName, payload) {
    if (socketIOInstance && userId) {
      socketIOInstance.to(`user_${userId}`).to(`user:${userId}`).emit(eventName, payload);
    }
  }

  /**
   * Category mapper for notification types
   */
  _getCategoryForType(type) {
    switch (type) {
      case SocialNotificationTypes.FOLLOW_REQUEST_RECEIVED:
      case SocialNotificationTypes.FOLLOW_REQUEST_ACCEPTED:
      case SocialNotificationTypes.NEW_FOLLOWER:
      case SocialNotificationTypes.FOLLOW:
        return NotificationCategories.FOLLOWS;
      case SocialNotificationTypes.POST_LIKED:
      case SocialNotificationTypes.REEL_LIKED:
      case SocialNotificationTypes.COMMENT_LIKED:
      case SocialNotificationTypes.LIKE:
        return NotificationCategories.LIKES;
      case SocialNotificationTypes.POST_COMMENTED:
      case SocialNotificationTypes.REEL_COMMENTED:
        return NotificationCategories.COMMENTS;
      case SocialNotificationTypes.COMMENT_REPLIED:
        return NotificationCategories.REPLIES;
      case SocialNotificationTypes.CONTENT_SHARED_INTERNALLY:
        return NotificationCategories.SHARES;
      case SocialNotificationTypes.CONTENT_REMOVED:
      case SocialNotificationTypes.CONTENT_RESTORED:
      case SocialNotificationTypes.SOCIAL_PUBLISHING_RESTRICTED:
        return NotificationCategories.SAFETY_UPDATES;
      case SocialNotificationTypes.MESSAGE:
        return NotificationCategories.DIRECT_MESSAGES;
      case SocialNotificationTypes.CALL:
        return NotificationCategories.CALLS;
      default:
        return NotificationCategories.CONTENT_UPDATES;
    }
  }

  /**
   * Generate canonical Deep Link for notification
   */
  _generateDeepLink(type, { contentId, subjectId, actorId }) {
    switch (type) {
      case SocialNotificationTypes.FOLLOW_REQUEST_RECEIVED:
        return 'rubaru://follow-requests';
      case SocialNotificationTypes.FOLLOW_REQUEST_ACCEPTED:
      case SocialNotificationTypes.NEW_FOLLOWER:
      case SocialNotificationTypes.FOLLOW:
        return `rubaru://profile/${actorId || ''}`;
      case SocialNotificationTypes.POST_LIKED:
      case SocialNotificationTypes.POST_COMMENTED:
        return `rubaru://post/${contentId || subjectId || ''}`;
      case SocialNotificationTypes.COMMENT_REPLIED:
        return `rubaru://post/${contentId || ''}?commentId=${subjectId || ''}`;
      case SocialNotificationTypes.REEL_LIKED:
      case SocialNotificationTypes.REEL_COMMENTED:
        return `rubaru://reel/${contentId || subjectId || ''}`;
      case SocialNotificationTypes.CONTENT_REMOVED:
      case SocialNotificationTypes.CONTENT_RESTORED:
        return `rubaru://content-status/${contentId || subjectId || ''}`;
      case SocialNotificationTypes.SOCIAL_PUBLISHING_RESTRICTED:
        return 'rubaru://safety-help';
      case SocialNotificationTypes.MESSAGE:
        return `rubaru://chat/${subjectId || ''}`;
      default:
        return 'rubaru://notifications';
    }
  }

  /**
   * Build safe default message preview
   */
  _buildMessagePreview(type, actorName = 'Someone') {
    switch (type) {
      case SocialNotificationTypes.FOLLOW_REQUEST_RECEIVED:
        return `${actorName} requested to follow you.`;
      case SocialNotificationTypes.FOLLOW_REQUEST_ACCEPTED:
        return `${actorName} accepted your follow request.`;
      case SocialNotificationTypes.NEW_FOLLOWER:
      case SocialNotificationTypes.FOLLOW:
        return `${actorName} started following you.`;
      case SocialNotificationTypes.POST_LIKED:
        return `${actorName} liked your post.`;
      case SocialNotificationTypes.REEL_LIKED:
        return `${actorName} liked your reel.`;
      case SocialNotificationTypes.POST_COMMENTED:
        return `${actorName} commented on your post.`;
      case SocialNotificationTypes.REEL_COMMENTED:
        return `${actorName} commented on your reel.`;
      case SocialNotificationTypes.COMMENT_REPLIED:
        return `${actorName} replied to your comment.`;
      case SocialNotificationTypes.COMMENT_LIKED:
        return `${actorName} liked your comment.`;
      case SocialNotificationTypes.CONTENT_SHARED_INTERNALLY:
        return `${actorName} shared your post.`;
      case SocialNotificationTypes.CONTENT_REMOVED:
        return 'Your content was removed for violating community guidelines.';
      case SocialNotificationTypes.CONTENT_RESTORED:
        return 'Your content has been reviewed and restored.';
      case SocialNotificationTypes.SOCIAL_PUBLISHING_RESTRICTED:
        return 'Social publishing has been temporarily restricted on your account.';
      case SocialNotificationTypes.MESSAGE:
        return `${actorName} sent you a message.`;
      case SocialNotificationTypes.CALL:
        return `Incoming call from ${actorName}.`;
      default:
        return 'You have a new notification on Rubaru.';
    }
  }

  /**
   * Create durable notification with suppression & delivery
   */
  async createNotification(params) {
    const {
      recipientId,
      actorId = null,
      type,
      subjectType = 'POST',
      subjectId = null,
      contentId = null,
      sourceEventId = null,
      deduplicationKey = null,
      customMessage = null,
      templateData = {},
      previewMediaId = null,
      previewThumbnailUri = '',
    } = params;

    if (!recipientId || !type) {
      return { success: false, suppressed: true, reason: 'MISSING_REQUIRED_FIELDS' };
    }

    // 1. Self-action suppression
    if (actorId && actorId.toString() === recipientId.toString()) {
      return { success: false, suppressed: true, reason: 'SELF_ACTION' };
    }

    // 2. Block suppression
    if (actorId) {
      const isBlocked = await Block.findOne({
        $or: [
          { blocker: actorId, blocked: recipientId },
          { blocker: recipientId, blocked: actorId },
        ],
      });
      if (isBlocked) {
        return { success: false, suppressed: true, reason: 'BLOCKED' };
      }
    }

    // 3. Reporter suppression check (if subject was reported by recipient)
    if (subjectId) {
      const isSuppressed = await ReporterSuppression.findOne({
        reporterId: recipientId,
        subjectId,
      });
      if (isSuppressed) {
        return { success: false, suppressed: true, reason: 'REPORTER_SUPPRESSED' };
      }
    }

    // 4. Recipient preference check
    const category = this._getCategoryForType(type);
    let userPref = await NotificationPreference.findOne({ user: recipientId });
    if (!userPref) {
      userPref = await NotificationPreference.create({ user: recipientId });
    }

    if (userPref.pauseAll && (!userPref.pauseUntil || new Date() < new Date(userPref.pauseUntil))) {
      // If pause all, allow only safety updates
      if (category !== NotificationCategories.SAFETY_UPDATES) {
        return { success: false, suppressed: true, reason: 'PREFERENCES_PAUSED' };
      }
    }

    const catPref = userPref[category] || { inApp: true, push: true };
    if (!catPref.inApp && category !== NotificationCategories.SAFETY_UPDATES) {
      return { success: false, suppressed: true, reason: 'IN_APP_PREFERENCE_DISABLED' };
    }

    // 5. Deduplication check
    const finalDedupKey = deduplicationKey || (sourceEventId ? `${type}_${recipientId}_${sourceEventId}` : null);
    if (finalDedupKey) {
      const existing = await Notification.findOne({ deduplicationKey: finalDedupKey });
      if (existing) {
        return {
          success: true,
          duplicate: true,
          notificationId: existing._id.toString(),
          notification: existing,
        };
      }
    }

    // 6. Hydrate actor info for preview text
    let actorName = 'Someone';
    let actorProfile = null;
    if (actorId) {
      actorProfile = await Profile.findOne({ user: actorId });
      if (actorProfile?.displayName) {
        actorName = actorProfile.displayName;
      }
    }

    const message = customMessage || this._buildMessagePreview(type, actorName);
    const deepLink = this._generateDeepLink(type, { contentId, subjectId, actorId });

    // 7. Create Durable Notification
    let notification;
    try {
      notification = await Notification.create({
        recipient: recipientId,
        sender: actorId,
        type,
        category,
        subjectType,
        subjectId,
        contentId,
        sourceEventId,
        deduplicationKey: finalDedupKey,
        titleKey: `notif.${type.toLowerCase()}.title`,
        bodyKey: `notif.${type.toLowerCase()}.body`,
        message,
        templateData: {
          actorName,
          ...templateData,
        },
        deepLink,
        previewMediaId,
        previewThumbnailUri,
        isRead: false,
        status: 'ACTIVE',
      });
    } catch (err) {
      if (err.code === 11000) {
        const existing = await Notification.findOne({ deduplicationKey: finalDedupKey });
        return {
          success: true,
          duplicate: true,
          notificationId: existing?._id.toString(),
          notification: existing,
        };
      }
      throw err;
    }

    // 8. Real-time Socket.io dispatch
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
      status: 'ACTIVE',
    });

    const socketPayload = {
      id: notification._id.toString(),
      type: notification.type,
      category: notification.category,
      message: notification.message,
      deepLink: notification.deepLink,
      isRead: false,
      createdAt: notification.createdAt,
      sender: actorProfile
        ? {
            userId: actorProfile.user,
            displayName: actorProfile.displayName,
            avatarUri: actorProfile.avatarUri,
          }
        : null,
      previewThumbnailUri: notification.previewThumbnailUri,
    };

    this._emitSocket(recipientId.toString(), 'notification:new', socketPayload);
    this._emitSocket(recipientId.toString(), 'notification:unread_count', { unreadCount });

    // 9. Push notification dispatch (if enabled)
    if (catPref.push) {
      pushAdapter.sendToUser(recipientId.toString(), {
        title: 'Rubaru',
        body: message,
        data: {
          deepLink,
          notificationId: notification._id.toString(),
          type: notification.type,
        },
        collapseKey: `rubaru_${category}`,
      }).catch(() => {});
    }

    return {
      success: true,
      notificationId: notification._id.toString(),
      notification,
    };
  }

  /**
   * Get paginated notifications list for recipient
   */
  async getNotifications(recipientId, options = {}) {
    const { cursor, limit = 20, category, type } = options;
    const boundedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);

    const query = {
      recipient: recipientId,
      status: 'ACTIVE',
    };

    if (category) query.category = category;
    if (type) query.type = type;

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString('utf8');
        const [cursorDate, cursorId] = decoded.split('_');
        if (cursorDate && cursorId) {
          query.$or = [
            { createdAt: { $lt: new Date(cursorDate) } },
            { createdAt: new Date(cursorDate), _id: { $lt: new mongoose.Types.ObjectId(cursorId) } },
          ];
        }
      } catch (err) {}
    }

    const rawNotifs = await Notification.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(boundedLimit + 1)
      .lean();

    const hasMore = rawNotifs.length > boundedLimit;
    const items = hasMore ? rawNotifs.slice(0, boundedLimit) : rawNotifs;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(`${new Date(lastItem.createdAt).toISOString()}_${lastItem._id.toString()}`).toString('base64');
    }

    // Hydrate senders and safe status
    const formattedItems = await Promise.all(
      items.map(async (n) => {
        let senderInfo = null;
        if (n.sender) {
          const p = await Profile.findOne({ user: n.sender });
          if (p) {
            senderInfo = {
              userId: p.user.toString(),
              displayName: p.displayName,
              avatarUri: p.avatarUri,
            };
          }
        }

        // Verify content still exists if subjectType is POST/REEL/STORY
        let isSubjectAvailable = true;
        if (n.contentId || (n.subjectId && ['POST', 'REEL', 'STORY'].includes(n.subjectType))) {
          const targetContentId = n.contentId || n.subjectId;
          const contentDoc = await Content.findById(targetContentId);
          if (!contentDoc || contentDoc.status === 'DELETED' || contentDoc.status === 'HIDDEN') {
            isSubjectAvailable = false;
          }
        }

        return {
          id: n._id.toString(),
          type: n.type,
          category: n.category,
          message: isSubjectAvailable ? n.message : 'This content is no longer available.',
          deepLink: isSubjectAvailable ? n.deepLink : 'rubaru://notifications',
          isRead: Boolean(n.isRead),
          isSubjectAvailable,
          createdAt: n.createdAt,
          sender: senderInfo,
          previewThumbnailUri: isSubjectAvailable ? n.previewThumbnailUri : '',
          relatedReel: n.relatedReel,
          relatedChat: n.relatedChat,
        };
      })
    );

    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
      status: 'ACTIVE',
    });

    return {
      items: formattedItems,
      nextCursor,
      hasMore,
      unreadCount,
    };
  }

  /**
   * Mark individual notification as read
   */
  async markAsRead(recipientId, notificationId) {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      const err = new Error('Invalid notification ID.');
      err.code = 'INVALID_NOTIFICATION_ID';
      err.statusCode = 400;
      throw err;
    }

    const notif = await Notification.findOne({
      _id: notificationId,
      recipient: recipientId,
    });

    if (!notif) {
      const err = new Error('Notification not found or access denied.');
      err.code = 'NOTIFICATION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (!notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      await notif.save();
    }

    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
      status: 'ACTIVE',
    });

    this._emitSocket(recipientId.toString(), 'notification:read', { notificationId });
    this._emitSocket(recipientId.toString(), 'notification:unread_count', { unreadCount });

    return {
      success: true,
      notificationId: notif._id.toString(),
      isRead: true,
      unreadCount,
    };
  }

  /**
   * Mark all notifications as read for recipient
   */
  async markAllAsRead(recipientId) {
    const now = new Date();
    await Notification.updateMany(
      { recipient: recipientId, isRead: false },
      { $set: { isRead: true, readAt: now } }
    );

    this._emitSocket(recipientId.toString(), 'notification:read_all', { readAt: now });
    this._emitSocket(recipientId.toString(), 'notification:unread_count', { unreadCount: 0 });

    return {
      success: true,
      unreadCount: 0,
      markedAt: now,
    };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(recipientId) {
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      isRead: false,
      status: 'ACTIVE',
    });
    return { unreadCount };
  }

  /**
   * Get user notification preferences
   */
  async getPreferences(userId) {
    let pref = await NotificationPreference.findOne({ user: userId });
    if (!pref) {
      pref = await NotificationPreference.create({ user: userId });
    }
    return pref;
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId, patchData = {}) {
    let pref = await NotificationPreference.findOne({ user: userId });
    if (!pref) {
      pref = await NotificationPreference.create({ user: userId });
    }

    const allowedCategories = ['pauseAll', 'pauseUntil', 'follows', 'likes', 'comments', 'replies', 'shares', 'contentUpdates', 'safetyUpdates', 'messages', 'calls'];
    for (const key of Object.keys(patchData)) {
      if (allowedCategories.includes(key)) {
        if (typeof patchData[key] === 'object' && patchData[key] !== null) {
          pref[key] = { ...(pref[key] ? pref[key].toObject?.() || pref[key] : {}), ...patchData[key] };
        } else {
          pref[key] = patchData[key];
        }
      }
    }

    pref.version = (pref.version || 1) + 1;
    await pref.save();
    return pref;
  }

  /**
   * Register or update push device token
   */
  async registerDevice(userId, deviceData) {
    const { pushToken, platform = 'android', deviceId, appVersion, locale, permissionState } = deviceData;
    if (!pushToken) {
      const err = new Error('pushToken is required.');
      err.code = 'INVALID_PUSH_TOKEN';
      err.statusCode = 400;
      throw err;
    }

    const device = await Device.findOneAndUpdate(
      { user: userId, pushToken },
      {
        $set: {
          platform,
          deviceId,
          appVersion: appVersion || '1.0.0',
          locale: locale || 'en',
          permissionState: permissionState || 'GRANTED',
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      deviceId: device._id.toString(),
      status: device.status,
    };
  }

  /**
   * Remove / revoke device token on logout
   */
  async deleteDevice(userId, deviceIdOrToken) {
    await Device.updateMany(
      {
        user: userId,
        $or: [{ _id: mongoose.Types.ObjectId.isValid(deviceIdOrToken) ? deviceIdOrToken : null }, { pushToken: deviceIdOrToken }],
      },
      { $set: { status: 'REVOKED' } }
    );
    return { success: true };
  }
}

module.exports = new NotificationService();
