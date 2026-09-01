/**
 * Rubaru Content & Media Safe Projection Serializers
 * Prevents internal database IDs, storage keys, moderation scores, and sensitive profile fields from leaking.
 */

function serializeAuthorSummary(authorProfile, authorUser = null) {
  return {
    userId: authorProfile?.user ? authorProfile.user.toString() : (authorUser?._id ? authorUser._id.toString() : ''),
    displayName: authorProfile?.displayName || 'Rubaru User',
    username: authorProfile?.username || '',
    avatarUri: authorProfile?.avatarUri || '',
    isPrivate: authorProfile?.socialAccountVisibility === 'PRIVATE',
  };
}

function serializeMediaItem(item, safeProjectionLevel = 'PUBLIC') {
  return {
    mediaAssetId: item.mediaAssetId ? item.mediaAssetId.toString() : undefined,
    position: item.position,
    mediaType: item.mediaType,
    width: item.width,
    height: item.height,
    aspectRatio: item.aspectRatio,
    thumbnail: {
      url: item.thumbnail?.url || '',
      width: item.thumbnail?.width || 0,
      height: item.thumbnail?.height || 0,
    },
    variants: (item.variants || []).map((v) => ({
      name: v.name,
      mimeType: v.mimeType,
      width: v.width,
      height: v.height,
      url: v.url || '',
      processingState: v.processingState,
    })),
    accessibilityDescription: item.accessibilityDescription || '',
  };
}

function serializeContentForViewer(contentDoc, authorProfile = null, safeProjectionLevel = 'PUBLIC', extraOptions = {}) {
  if (!contentDoc) return null;

  let profile = authorProfile;
  let level = safeProjectionLevel;
  let isLiked = false;
  let isSaved = false;

  if (
    authorProfile &&
    typeof authorProfile === 'object' &&
    ('authorProfile' in authorProfile || 'isLiked' in authorProfile || 'isSaved' in authorProfile)
  ) {
    profile = authorProfile.authorProfile || null;
    level = authorProfile.safeProjectionLevel || 'PUBLIC';
    isLiked = Boolean(authorProfile.isLiked);
    isSaved = Boolean(authorProfile.isSaved);
  } else if (extraOptions && typeof extraOptions === 'object') {
    isLiked = Boolean(extraOptions.isLiked);
    isSaved = Boolean(extraOptions.isSaved);
  }

  const serialized = {
    postId: contentDoc._id.toString(),
    authorId: contentDoc.authorId ? contentDoc.authorId.toString() : '',
    author: serializeAuthorSummary(profile),
    contentType: contentDoc.contentType,
    caption: contentDoc.caption || '',
    mediaItems: (contentDoc.mediaItems || []).map((m) => serializeMediaItem(m, level)),
    audience: contentDoc.audience,
    status: contentDoc.status,
    locationLabel: contentDoc.locationLabel || '',
    likesCount: contentDoc.likesCount || 0,
    commentsCount: contentDoc.commentsCount || 0,
    sharesCount: contentDoc.sharesCount || 0,
    savesCount: contentDoc.savesCount || 0,
    viewsCount: contentDoc.viewsCount || 0,
    playCount: contentDoc.playCount || 0,
    durationMs: contentDoc.durationMs || (contentDoc.mediaItems?.[0]?.durationMs || 0),
    hasAudio: contentDoc.hasAudio !== undefined ? contentDoc.hasAudio : true,
    audioType: contentDoc.audioType || 'ORIGINAL',
    isLiked,
    isSaved,
    publishedAt: contentDoc.publishedAt,
    editedAt: contentDoc.editedAt,
    createdAt: contentDoc.createdAt,
  };

  // Owner / Moderator level extra safe fields
  if (level === 'OWNER' || level === 'MODERATOR') {
    serialized.moderationStatus = contentDoc.moderationStatus;
    serialized.archivedAt = contentDoc.archivedAt;
    serialized.idempotencyKey = contentDoc.idempotencyKey;
    if (contentDoc.deletedAt) {
      serialized.deletedAt = contentDoc.deletedAt;
    }
  }

  return serialized;
}

module.exports = {
  serializeAuthorSummary,
  serializeMediaItem,
  serializeContentForViewer,
};
