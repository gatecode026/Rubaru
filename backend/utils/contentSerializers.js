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
  const primaryUrl = item.originalUrl || item.thumbnail?.url || item.variants?.[0]?.url || item.url || '';
  return {
    mediaAssetId: item.mediaAssetId ? item.mediaAssetId.toString() : undefined,
    position: item.position !== undefined ? item.position : 0,
    mediaType: item.mediaType || 'IMAGE',
    originalUrl: primaryUrl,
    width: item.width || 1080,
    height: item.height || 1350,
    aspectRatio: item.aspectRatio || 0.8,
    thumbnail: {
      url: item.thumbnail?.url || primaryUrl,
      width: item.thumbnail?.width || 0,
      height: item.thumbnail?.height || 0,
    },
    variants: (item.variants && item.variants.length > 0)
      ? item.variants.map((v) => ({
          name: v.name || 'original',
          mimeType: v.mimeType || 'image/jpeg',
          width: v.width || 0,
          height: v.height || 0,
          url: v.url || primaryUrl,
          processingState: v.processingState,
        }))
      : [{
          name: 'original',
          mimeType: 'image/jpeg',
          width: 0,
          height: 0,
          url: primaryUrl,
        }],
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

  const viewerId =
    (authorProfile && typeof authorProfile === 'object' && authorProfile.viewerId) ||
    (extraOptions && typeof extraOptions === 'object' && extraOptions.viewerId) ||
    null;

  const isOwner = Boolean(
    viewerId && contentDoc.authorId && String(viewerId) === String(contentDoc.authorId)
  );

  const primaryImage =
    contentDoc.mediaItems?.[0]?.originalUrl ||
    contentDoc.mediaItems?.[0]?.variants?.[0]?.url ||
    contentDoc.mediaItems?.[0]?.thumbnail?.url ||
    '';

  const serialized = {
    postId: contentDoc._id.toString(),
    authorId: contentDoc.authorId ? contentDoc.authorId.toString() : '',
    author: serializeAuthorSummary(profile),
    isOwner,
    contentType: contentDoc.contentType,
    caption: contentDoc.caption || '',
    imageUri: primaryImage,
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
