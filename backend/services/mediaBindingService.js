const MediaAsset = require('../models/MediaAsset');

/**
 * Media Binding & Verification Service
 * Validates ownership, readiness, carousel limits, and safely hydrates media items.
 */
class MediaBindingService {
  /**
   * Validate and bind media items for content creation
   */
  async validateAndBindMediaItems(authorId, rawMediaItems) {
    if (!Array.isArray(rawMediaItems) || rawMediaItems.length === 0) {
      const err = new Error('A post must contain at least one media item.');
      err.code = 'EMPTY_MEDIA_ITEMS';
      err.statusCode = 400;
      throw err;
    }

    if (rawMediaItems.length > 10) {
      const err = new Error('A post cannot contain more than 10 media items in a carousel.');
      err.code = 'CAROUSEL_LIMIT_EXCEEDED';
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify positions & check duplicate mediaAssetIds
    const assetIds = [];
    const positions = new Set();

    for (let i = 0; i < rawMediaItems.length; i++) {
      const item = rawMediaItems[i];
      if (!item.mediaAssetId) {
        const err = new Error(`Media item at index ${i} is missing mediaAssetId.`);
        err.code = 'INVALID_MEDIA_ITEM';
        err.statusCode = 400;
        throw err;
      }

      const pos = item.position !== undefined ? item.position : i;
      if (positions.has(pos)) {
        const err = new Error(`Duplicate media carousel position: ${pos}`);
        err.code = 'DUPLICATE_MEDIA_POSITION';
        err.statusCode = 400;
        throw err;
      }
      positions.add(pos);
      assetIds.push(item.mediaAssetId);
    }

    // 2. Fetch all referenced MediaAsset documents in one batch query
    const assets = await MediaAsset.find({ _id: { $in: assetIds } });
    const assetMap = new Map(assets.map((a) => [a._id.toString(), a]));

    const boundItems = [];

    for (let i = 0; i < rawMediaItems.length; i++) {
      const rawItem = rawMediaItems[i];
      const asset = assetMap.get(rawItem.mediaAssetId.toString());

      // Existence check
      if (!asset) {
        const err = new Error(`Media asset ${rawItem.mediaAssetId} was not found.`);
        err.code = 'MEDIA_ASSET_NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }

      // Ownership check (IDOR Protection)
      if (asset.ownerId.toString() !== authorId.toString()) {
        const err = new Error(`You do not own media asset ${rawItem.mediaAssetId}.`);
        err.code = 'CROSS_USER_MEDIA_BINDING_FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }

      // Deletion check
      if (asset.deletedAt || asset.processingStatus === 'DELETED') {
        const err = new Error(`Media asset ${rawItem.mediaAssetId} has been deleted.`);
        err.code = 'MEDIA_ASSET_DELETED';
        err.statusCode = 400;
        throw err;
      }

      // Readiness check
      if (asset.processingStatus !== 'READY') {
        const err = new Error(`Media asset ${rawItem.mediaAssetId} is not ready (status: ${asset.processingStatus}).`);
        err.code = 'MEDIA_NOT_READY';
        err.statusCode = 400;
        throw err;
      }

      // Purpose check
      if (!['POST_MEDIA', 'PROFILE_PHOTO'].includes(asset.purpose)) {
        const err = new Error(`Media asset purpose '${asset.purpose}' is incompatible with posts.`);
        err.code = 'INCOMPATIBLE_MEDIA_PURPOSE';
        err.statusCode = 400;
        throw err;
      }

      const position = rawItem.position !== undefined ? rawItem.position : i;

      boundItems.push({
        mediaAssetId: asset._id,
        position,
        mediaType: asset.mediaType,
        variants: asset.variants || [],
        thumbnail: asset.thumbnail || {},
        width: asset.width || 1080,
        height: asset.height || 1350,
        aspectRatio: asset.aspectRatio || 0.8,
        durationMs: asset.durationMs || 0,
        accessibilityDescription: (rawItem.accessibilityDescription || '').trim().slice(0, 300),
      });
    }

    // Sort deterministically by position
    boundItems.sort((a, b) => a.position - b.position);

    return boundItems;
  }
}

const mediaBindingService = new MediaBindingService();

module.exports = mediaBindingService;
