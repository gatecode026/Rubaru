/**
 * Shared Dating Types, Enums & Query Keys for Rubaru Frontend
 */

export const DatingQueryKeys = {
  PREFERENCES: ['dating', 'preferences'],
  DISCOVERY: (filters) => ['dating', 'discovery', filters || {}],
  INCOMING_LIKES: (sort) => ['dating', 'incoming_likes', sort || 'PRIORITY'],
  MATCHES: (status) => ['dating', 'matches', status || 'ACTIVE'],
  MATCH_DETAIL: (matchId) => ['dating', 'match', matchId],
  PROFILE: ['profiles', 'me'],
};

export const InteractionTypes = Object.freeze({
  LIKE: 'LIKE',
  PASS: 'PASS',
  ROSE: 'ROSE',
  PRIORITY_LIKE: 'PRIORITY_LIKE',
  REMOVE: 'REMOVE',
});

export const ReportCategories = Object.freeze({
  HARASSMENT: 'HARASSMENT',
  FAKE_PROFILE: 'FAKE_PROFILE',
  INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
  SCAM_OR_SPAM: 'SCAM_OR_SPAM',
  UNDERAGE: 'UNDERAGE',
  OTHER: 'OTHER',
});

export const DatingIntentions = Object.freeze({
  LONG_TERM: 'LONG_TERM',
  SHORT_TERM: 'SHORT_TERM',
  LONG_TERM_OPEN_TO_SHORT: 'LONG_TERM_OPEN_TO_SHORT',
  CASUAL: 'CASUAL',
  FRIENDSHIP: 'FRIENDSHIP',
  NOT_SURE: 'NOT_SURE',
});
