// Shared Enums and Constants for Rubaru Dating Engine

const InteractionTypes = Object.freeze({
  LIKE: 'LIKE',
  PASS: 'PASS',
  ROSE: 'ROSE',
  PRIORITY_LIKE: 'PRIORITY_LIKE',
  REMOVE: 'REMOVE',
});

const InteractionStatuses = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  EXPIRED: 'EXPIRED',
  INVALIDATED: 'INVALIDATED',
});

const MatchStatuses = Object.freeze({
  ACTIVE: 'ACTIVE',
  UNMATCHED: 'UNMATCHED',
  BLOCKED: 'BLOCKED',
  CLOSED_BY_MODERATION: 'CLOSED_BY_MODERATION',
  USER_DELETED: 'USER_DELETED',
});

const OutboxStatuses = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
});

const DatingIntentions = Object.freeze({
  LONG_TERM: 'LONG_TERM',
  SHORT_TERM: 'SHORT_TERM',
  LONG_TERM_OPEN_TO_SHORT: 'LONG_TERM_OPEN_TO_SHORT',
  CASUAL: 'CASUAL',
  FRIENDSHIP: 'FRIENDSHIP',
  NOT_SURE: 'NOT_SURE',
});

const Genders = Object.freeze({
  FEMALE: 'Female',
  MALE: 'Male',
  NON_BINARY: 'Non-Binary',
  OTHER: 'Other',
});

const TargetElementTypes = Object.freeze({
  PHOTO: 'PHOTO',
  PROMPT: 'PROMPT',
  BIO: 'BIO',
  PROFILE: 'PROFILE',
});

const ReportSubjectTypes = Object.freeze({
  USER: 'USER',
  POST: 'POST',
  REEL: 'REEL',
  STORY: 'STORY',
  COMMENT: 'COMMENT',
  MESSAGE: 'MESSAGE',
  GROUP: 'GROUP',
});

const ReportCategories = Object.freeze({
  NUDITY_OR_SEXUAL_CONTENT: 'NUDITY_OR_SEXUAL_CONTENT',
  HARASSMENT_OR_BULLYING: 'HARASSMENT_OR_BULLYING',
  HATE_OR_DISCRIMINATION: 'HATE_OR_DISCRIMINATION',
  VIOLENCE_OR_THREATS: 'VIOLENCE_OR_THREATS',
  SELF_HARM_OR_SUICIDE: 'SELF_HARM_OR_SUICIDE',
  SCAM_OR_FRAUD: 'SCAM_OR_FRAUD',
  SPAM: 'SPAM',
  IMPERSONATION: 'IMPERSONATION',
  UNDERAGE_CONCERN: 'UNDERAGE_CONCERN',
  UNWANTED_CONTACT: 'UNWANTED_CONTACT',
  PRIVATE_INFORMATION: 'PRIVATE_INFORMATION',
  INTELLECTUAL_PROPERTY: 'INTELLECTUAL_PROPERTY',
  DANGEROUS_ACTIVITY: 'DANGEROUS_ACTIVITY',
  OTHER: 'OTHER',
  // Backward compatibility aliases
  HARASSMENT: 'HARASSMENT',
  FAKE_PROFILE: 'FAKE_PROFILE',
  INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
  SCAM_OR_SPAM: 'SCAM_OR_SPAM',
  UNDERAGE: 'UNDERAGE',
});

const ReportStatuses = Object.freeze({
  PENDING: 'PENDING',
  INVESTIGATING: 'INVESTIGATING',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
  ESCALATED: 'ESCALATED',
});

const ModerationPriorities = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const ModerationCaseStatuses = Object.freeze({
  OPEN: 'OPEN',
  TRIAGED: 'TRIAGED',
  IN_REVIEW: 'IN_REVIEW',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
  ESCALATED: 'ESCALATED',
  APPEALED: 'APPEALED',
});

const ModerationDecisions = Object.freeze({
  NO_ACTION: 'NO_ACTION',
  APPROVE: 'APPROVE',
  HIDE: 'HIDE',
  REMOVE: 'REMOVE',
  REJECT: 'REJECT',
  RESTORE: 'RESTORE',
  ESCALATE: 'ESCALATE',
  WARN_AUTHOR: 'WARN_AUTHOR',
  RESTRICT_SOCIAL_PUBLISHING: 'RESTRICT_SOCIAL_PUBLISHING',
});

const AccountStatuses = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
  DELETED: 'DELETED',
});

const SocialNotificationTypes = Object.freeze({
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
  // Legacy / Direct types
  LIKE: 'like',
  FOLLOW: 'follow',
  MESSAGE: 'message',
  CALL: 'call',
  GROUP_INVITE: 'group_invite',
});

const NotificationCategories = Object.freeze({
  FOLLOWS: 'follows',
  LIKES: 'likes',
  COMMENTS: 'comments',
  REPLIES: 'replies',
  SHARES: 'shares',
  CONTENT_UPDATES: 'contentUpdates',
  SAFETY_UPDATES: 'safetyUpdates',
  DIRECT_MESSAGES: 'messages',
  CALLS: 'calls',
});

const NotificationChannels = Object.freeze({
  IN_APP: 'IN_APP',
  SOCKET: 'SOCKET',
  PUSH: 'PUSH',
});

const ConversationTypes = Object.freeze({
  DIRECT_MATCH: 'DIRECT_MATCH',
  GROUP: 'GROUP',
});

const ConversationStatuses = Object.freeze({
  ACTIVE: 'ACTIVE',
  CLOSED_BY_UNMATCH: 'CLOSED_BY_UNMATCH',
  CLOSED_BY_BLOCK: 'CLOSED_BY_BLOCK',
  CLOSED_BY_SAFETY: 'CLOSED_BY_SAFETY',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
});

const MemberRoles = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
});

const MemberStates = Object.freeze({
  ACTIVE: 'ACTIVE',
  LEFT: 'LEFT',
  REMOVED: 'REMOVED',
  BLOCKED: 'BLOCKED',
});

const MemberNotificationPreferences = Object.freeze({
  ALL: 'ALL',
  MENTIONS_ONLY: 'MENTIONS_ONLY',
  MUTED: 'MUTED',
});

const MessageReactions = Object.freeze({
  LIKE: 'LIKE',
  LOVE: 'LOVE',
  LAUGH: 'LAUGH',
  SURPRISED: 'SURPRISED',
  SAD: 'SAD',
  ANGRY: 'ANGRY',
  FIRE: 'FIRE',
  ONE_HUNDRED: '100',
});

const PollStatuses = Object.freeze({
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  EXPIRED: 'EXPIRED',
});

module.exports = {
  InteractionTypes,
  InteractionStatuses,
  MatchStatuses,
  OutboxStatuses,
  DatingIntentions,
  Genders,
  TargetElementTypes,
  ReportSubjectTypes,
  ReportCategories,
  ReportStatuses,
  ModerationPriorities,
  ModerationCaseStatuses,
  ModerationDecisions,
  AccountStatuses,
  SocialNotificationTypes,
  NotificationCategories,
  NotificationChannels,
  ConversationTypes,
  ConversationStatuses,
  MemberRoles,
  MemberStates,
  MemberNotificationPreferences,
  MessageReactions,
  PollStatuses,
};
