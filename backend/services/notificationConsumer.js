const OutboxEvent = require('../models/OutboxEvent');
const Content = require('../models/Content');
const Comment = require('../models/Comment');
const notificationService = require('./notificationService');
const { SocialNotificationTypes } = require('../models/enums');

class NotificationConsumer {
  /**
   * Process a single OutboxEvent document and generate appropriate notifications
   */
  async processEvent(outboxEvent) {
    if (!outboxEvent || !outboxEvent.eventType) return { processed: false, reason: 'INVALID_EVENT' };

    const { eventType, payload = {}, aggregateId, _id } = outboxEvent;
    const sourceEventId = _id ? _id.toString() : outboxEvent.deduplicationKey || `${Date.now()}`;
    const results = [];

    try {
      switch (eventType) {
        case 'follow.requested': {
          const followerId = payload.followerId || payload.actorId;
          const followingId = payload.followingId || payload.targetUserId || aggregateId;
          if (followingId && followerId) {
            const res = await notificationService.createNotification({
              recipientId: followingId,
              actorId: followerId,
              type: SocialNotificationTypes.FOLLOW_REQUEST_RECEIVED,
              subjectType: 'USER',
              subjectId: followerId,
              sourceEventId,
              deduplicationKey: `follow_req_${followingId}_${followerId}_${sourceEventId}`,
            });
            results.push(res);
          }
          break;
        }

        case 'follow.accepted': {
          const followerId = payload.followerId || payload.originalRequesterId || aggregateId;
          const followingId = payload.followingId || payload.actorId;
          if (followerId && followingId) {
            const res = await notificationService.createNotification({
              recipientId: followerId,
              actorId: followingId,
              type: SocialNotificationTypes.FOLLOW_REQUEST_ACCEPTED,
              subjectType: 'USER',
              subjectId: followingId,
              sourceEventId,
              deduplicationKey: `follow_acc_${followerId}_${followingId}_${sourceEventId}`,
            });
            results.push(res);
          }
          break;
        }

        case 'content.liked': {
          const actorId = payload.actorId || payload.userId;
          let authorId = payload.authorId;
          let contentType = payload.contentType;

          if (!authorId || !contentType) {
            const contentDoc = await Content.findById(payload.contentId);
            if (contentDoc) {
              authorId = authorId || (contentDoc.authorId || contentDoc.author)?.toString();
              contentType = contentType || contentDoc.contentType;
            } else if (aggregateId) {
              authorId = authorId || aggregateId;
            }
          }

          if (authorId && actorId) {
            const notifType = contentType === 'REEL' ? SocialNotificationTypes.REEL_LIKED : SocialNotificationTypes.POST_LIKED;
            const res = await notificationService.createNotification({
              recipientId: authorId,
              actorId,
              type: notifType,
              subjectType: contentType === 'REEL' ? 'REEL' : 'POST',
              subjectId: payload.contentId,
              contentId: payload.contentId,
              sourceEventId,
              deduplicationKey: `content_like_${payload.contentId}_${actorId}_${sourceEventId}`,
            });
            results.push(res);
          }
          break;
        }

        case 'comment.created': {
          const commentActorId = payload.authorId || payload.userId;
          let contentAuthorId = payload.contentAuthorId;
          let contentType = payload.contentType;
          let parentCommentAuthorId = payload.parentCommentAuthorId;

          if (!contentAuthorId || !contentType) {
            const contentDoc = await Content.findById(payload.contentId);
            if (contentDoc) {
              contentAuthorId = contentAuthorId || (contentDoc.authorId || contentDoc.author)?.toString();
              contentType = contentType || contentDoc.contentType;
            } else if (aggregateId) {
              contentAuthorId = contentAuthorId || aggregateId;
            }
          }

          if (payload.parentCommentId && !parentCommentAuthorId) {
            const parentCommentDoc = await Comment.findById(payload.parentCommentId);
            if (parentCommentDoc) {
              parentCommentAuthorId = (parentCommentDoc.authorId || parentCommentDoc.author)?.toString();
            }
          }

          // 1. Reply notification to parent comment author
          if (parentCommentAuthorId && parentCommentAuthorId.toString() !== commentActorId.toString()) {
            const replyRes = await notificationService.createNotification({
              recipientId: parentCommentAuthorId,
              actorId: commentActorId,
              type: SocialNotificationTypes.COMMENT_REPLIED,
              subjectType: 'COMMENT',
              subjectId: payload.commentId,
              contentId: payload.contentId,
              sourceEventId,
              deduplicationKey: `comment_reply_${payload.commentId}_${commentActorId}_${sourceEventId}`,
            });
            results.push(replyRes);
          }

          // 2. Comment notification to content author
          if (contentAuthorId && contentAuthorId.toString() !== commentActorId.toString() && (!parentCommentAuthorId || parentCommentAuthorId.toString() !== contentAuthorId.toString())) {
            const notifType = contentType === 'REEL' ? SocialNotificationTypes.REEL_COMMENTED : SocialNotificationTypes.POST_COMMENTED;
            const commentRes = await notificationService.createNotification({
              recipientId: contentAuthorId,
              actorId: commentActorId,
              type: notifType,
              subjectType: contentType === 'REEL' ? 'REEL' : 'POST',
              subjectId: payload.commentId,
              contentId: payload.contentId,
              sourceEventId,
              deduplicationKey: `comment_create_${payload.commentId}_${commentActorId}_${sourceEventId}`,
            });
            results.push(commentRes);
          }
          break;
        }

        case 'comment.liked': {
          const actorId = payload.actorId || payload.userId;
          let commentAuthorId = payload.commentAuthorId;
          if (!commentAuthorId && payload.commentId) {
            const commentDoc = await Comment.findById(payload.commentId);
            if (commentDoc) {
              commentAuthorId = (commentDoc.authorId || commentDoc.author)?.toString();
            }
          }

          if (commentAuthorId && actorId) {
            const res = await notificationService.createNotification({
              recipientId: commentAuthorId,
              actorId,
              type: SocialNotificationTypes.COMMENT_LIKED,
              subjectType: 'COMMENT',
              subjectId: payload.commentId,
              contentId: payload.contentId,
              sourceEventId,
              deduplicationKey: `comment_like_${payload.commentId}_${actorId}_${sourceEventId}`,
            });
            results.push(res);
          }
          break;
        }

        case 'content.shared': {
          const actorId = payload.actorId || payload.userId;
          let authorId = payload.authorId;
          if (!authorId && payload.contentId) {
            const contentDoc = await Content.findById(payload.contentId);
            if (contentDoc) {
              authorId = (contentDoc.authorId || contentDoc.author)?.toString();
            }
          }

          if (authorId && actorId) {
            const res = await notificationService.createNotification({
              recipientId: authorId,
              actorId,
              type: SocialNotificationTypes.CONTENT_SHARED_INTERNALLY,
              subjectType: 'POST',
              subjectId: payload.contentId,
              contentId: payload.contentId,
              sourceEventId,
              deduplicationKey: `content_share_${payload.contentId}_${actorId}_${sourceEventId}`,
            });
            results.push(res);
          }
          break;
        }

        case 'moderation.decision_applied': {
          const { subjectType, subjectId, subjectOwnerId, decision } = payload;
          if (subjectOwnerId) {
            let notifType = null;
            if (decision === 'HIDE' || decision === 'REMOVE') {
              notifType = SocialNotificationTypes.CONTENT_REMOVED;
            } else if (decision === 'RESTORE') {
              notifType = SocialNotificationTypes.CONTENT_RESTORED;
            } else if (decision === 'RESTRICT_SOCIAL_PUBLISHING') {
              notifType = SocialNotificationTypes.SOCIAL_PUBLISHING_RESTRICTED;
            }

            if (notifType) {
              const res = await notificationService.createNotification({
                recipientId: subjectOwnerId,
                actorId: null, // System notification
                type: notifType,
                subjectType: subjectType || 'POST',
                subjectId,
                contentId: subjectId,
                sourceEventId,
                deduplicationKey: `mod_decision_${subjectId}_${decision}_${sourceEventId}`,
              });
              results.push(res);
            }
          }
          break;
        }

        default:
          return { processed: false, reason: 'IGNORED_EVENT_TYPE' };
      }

      return {
        processed: true,
        eventType,
        createdCount: results.filter((r) => r.success && !r.duplicate).length,
        duplicateCount: results.filter((r) => r.duplicate).length,
        suppressedCount: results.filter((r) => r.suppressed).length,
        results,
      };
    } catch (err) {
      return { processed: false, error: err.message };
    }
  }

  /**
   * Process a batch of pending outbox events
   */
  async processPendingOutboxEvents(batchSize = 50) {
    const pendingEvents = await OutboxEvent.find({
      status: 'PENDING',
      availableAt: { $lte: new Date() },
    })
      .limit(batchSize)
      .sort({ createdAt: 1 });

    let processedCount = 0;
    for (const event of pendingEvents) {
      event.status = 'PROCESSING';
      event.attemptCount = (event.attemptCount || 0) + 1;
      await event.save();

      const result = await this.processEvent(event);
      if (result.processed || result.reason === 'IGNORED_EVENT_TYPE') {
        event.status = 'PUBLISHED';
        event.processedAt = new Date();
      } else {
        event.status = event.attemptCount >= 5 ? 'DEAD_LETTER' : 'PENDING';
        event.lastError = result.error || 'PROCESSING_FAILED';
      }
      await event.save();
      processedCount++;
    }

    return { processedCount, totalFound: pendingEvents.length };
  }
}

module.exports = new NotificationConsumer();
