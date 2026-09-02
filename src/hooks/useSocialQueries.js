/**
 * Centralized Query Keys Factory & Social Query Hooks
 */

export const socialQueryKeys = {
  all: ['social'],
  profile: (userId) => ['social', 'profile', userId || 'me'],
  followStatus: (userId) => ['social', 'followStatus', userId],
  followers: (userId) => ['social', 'followers', userId],
  following: (userId) => ['social', 'following', userId],
  followRequests: () => ['social', 'followRequests'],
  userPosts: (userId) => ['social', 'posts', 'user', userId || 'me'],
  postDetail: (postId) => ['social', 'post', postId],
  connectedFeed: (filters = {}) => ['social', 'feed', 'connected', filters],
  savedContent: () => ['social', 'saved'],
  comments: (contentId) => ['social', 'comments', contentId],
  storyTray: () => ['social', 'stories', 'tray'],
  storySequence: (userId) => ['social', 'stories', 'sequence', userId],
  storyViewers: (storyId) => ['social', 'stories', 'viewers', storyId],
  reelFeed: () => ['social', 'reels', 'feed'],
  userReels: (userId) => ['social', 'reels', 'user', userId || 'me'],
  notifications: (filters = {}) => ['social', 'notifications', filters],
  unreadCount: () => ['social', 'notifications', 'unreadCount'],
  notificationPreferences: () => ['social', 'notifications', 'preferences'],
};

export default socialQueryKeys;
