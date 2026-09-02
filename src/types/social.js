/**
 * Canonical Social Types & Enums for Rubaru React Native
 */

export const ContentType = Object.freeze({
  POST: 'POST',
  REEL: 'REEL',
  STORY: 'STORY',
});

export const ContentStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PROCESSING: 'PROCESSING',
  MODERATION_PENDING: 'MODERATION_PENDING',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
});

export const ContentAudience = Object.freeze({
  PUBLIC: 'PUBLIC',
  FOLLOWERS: 'FOLLOWERS',
});

export const FollowStatus = Object.freeze({
  NONE: 'NONE',
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  BLOCKED: 'BLOCKED',
});

export const SocialNotificationTypes = Object.freeze({
  FOLLOW_REQUEST_RECEIVED: 'FOLLOW_REQUEST_RECEIVED',
  FOLLOW_REQUEST_ACCEPTED: 'FOLLOW_REQUEST_ACCEPTED',
  NEW_FOLLOWER: 'NEW_FOLLOWER',
  POST_LIKED: 'POST_LIKED',
  POST_COMMENTED: 'POST_COMMENTED',
  COMMENT_REPLIED: 'COMMENT_REPLIED',
  COMMENT_LIKED: 'COMMENT_LIKED',
  REEL_LIKED: 'REEL_LIKED',
  REEL_COMMENTED: 'REEL_COMMENTED',
  CONTENT_SHARED_INTERNALLY: 'CONTENT_SHARED_INTERNALLY',
  CONTENT_REMOVED: 'CONTENT_REMOVED',
  CONTENT_RESTORED: 'CONTENT_RESTORED',
  SOCIAL_PUBLISHING_RESTRICTED: 'SOCIAL_PUBLISHING_RESTRICTED',
});

export const NotificationCategories = Object.freeze({
  FOLLOWS: 'follows',
  LIKES: 'likes',
  COMMENTS: 'comments',
  REPLIES: 'replies',
  SHARES: 'shares',
  CONTENT_UPDATES: 'contentUpdates',
  SAFETY_UPDATES: 'safetyUpdates',
  MESSAGES: 'messages',
  CALLS: 'calls',
});

export const ReportReasonCategories = Object.freeze({
  HARASSMENT: 'HARASSMENT',
  HATE_SPEECH: 'HATE_SPEECH',
  NUDITY_SEXUAL_CONTENT: 'NUDITY_SEXUAL_CONTENT',
  VIOLENCE_DANGEROUS: 'VIOLENCE_DANGEROUS',
  SCAM_FRAUD: 'SCAM_FRAUD',
  UNDERAGE: 'UNDERAGE',
  IMPERSONATION: 'IMPERSONATION',
  SUICIDE_SELF_HARM: 'SUICIDE_SELF_HARM',
  SPAM: 'SPAM',
  OTHER: 'OTHER',
});

/**
 * Standard API error normalizer
 */
export function normalizeApiError(error) {
  if (!error) return { message: 'An unknown error occurred.', code: 'UNKNOWN_ERROR' };
  if (typeof error === 'string') return { message: error, code: 'GENERIC_ERROR' };
  
  const responseData = error.response?.data || error.data;
  if (responseData) {
    return {
      message: responseData.message || 'Server request failed.',
      code: responseData.code || 'SERVER_ERROR',
      statusCode: error.response?.status || 500,
      details: responseData.details || responseData.errors,
    };
  }
  
  if (error.message === 'Network request failed' || error.name === 'AbortError') {
    return {
      message: 'Network offline or request timed out. Please check your connection.',
      code: 'NETWORK_ERROR',
      isOffline: true,
    };
  }
  
  return {
    message: error.message || 'An unexpected error occurred.',
    code: error.code || 'CLIENT_ERROR',
  };
}
