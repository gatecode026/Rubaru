const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const UploadSession = require('../models/UploadSession');
const MediaAsset = require('../models/MediaAsset');
const OutboxEvent = require('../models/OutboxEvent');
const storageProvider = require('./storage/storageProvider');
const mediaProcessor = require('./mediaProcessor');
const mediaConfig = require('../config/mediaConfig');

/**
 * Rubaru Secure Media Service
 * Manages media ownership, upload sessions, verification, status, and lifecycle.
 */
class MediaService {
  /**
   * Create an authenticated, scoped upload session
   */
  async createUploadSession(userId, data) {
    if (!mediaConfig.featureFlags.socialMediaUploadEnabled) {
      const err = new Error('Social media uploads are currently disabled.');
      err.code = 'FEATURE_DISABLED';
      err.statusCode = 403;
      throw err;
    }

    const {
      purpose,
      mediaType,
      mimeType,
      fileSize,
      checksum = '',
      idempotencyKey,
    } = data;

    // 1. Validate Required Fields
    if (!purpose || !mediaType || !mimeType || !fileSize || !idempotencyKey) {
      const err = new Error('Missing required upload session parameters.');
      err.code = 'INVALID_UPLOAD_PARAMETERS';
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate Purpose & Media Type
    if (!mediaConfig.allowedPurposes.includes(purpose)) {
      const err = new Error(`Unsupported media purpose: ${purpose}`);
      err.code = 'INVALID_MEDIA_PURPOSE';
      err.statusCode = 400;
      throw err;
    }

    if (!mediaConfig.allowedMediaTypes.includes(mediaType)) {
      const err = new Error(`Unsupported media type: ${mediaType}`);
      err.code = 'INVALID_MEDIA_TYPE';
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate MIME Type Allowlist
    const normalizedMime = mimeType.toLowerCase().trim();
    if (!mediaConfig.allowedMimeTypes[mediaType].includes(normalizedMime)) {
      const err = new Error(`MIME type '${normalizedMime}' is not permitted for ${mediaType}.`);
      err.code = 'UNSUPPORTED_MIME_TYPE';
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate File Size Limits
    let maxSizeAllowed = mediaConfig.limits.maxImageBytes;
    if (mediaType === 'VIDEO') maxSizeAllowed = mediaConfig.limits.maxVideoBytes;
    if (mediaType === 'AUDIO') maxSizeAllowed = mediaConfig.limits.maxAudioBytes;

    if (fileSize > maxSizeAllowed || fileSize <= 0) {
      const err = new Error(`File size ${fileSize} exceeds maximum allowed of ${maxSizeAllowed} bytes.`);
      err.code = 'FILE_SIZE_EXCEEDS_LIMIT';
      err.statusCode = 400;
      throw err;
    }

    // 5. Enforce Owner-Scoped Idempotency
    const existingSession = await UploadSession.findOne({
      ownerId: userId,
      idempotencyKey,
    });

    if (existingSession) {
      if (existingSession.status === 'AUTHORIZED' && existingSession.expiresAt > new Date()) {
        const authPayload = await storageProvider.createUploadAuthorization({
          objectKey: existingSession.objectKey,
          declaredMimeType: existingSession.declaredMimeType,
          maxSizeBytes: existingSession.declaredFileSize,
          expiresAt: existingSession.expiresAt,
        });

        return {
          sessionId: existingSession._id.toString(),
          mediaAssetId: existingSession.mediaAssetId ? existingSession.mediaAssetId.toString() : null,
          purpose: existingSession.purpose,
          mediaType: existingSession.mediaType,
          status: existingSession.status,
          uploadTarget: authPayload,
          expiresAt: existingSession.expiresAt,
        };
      }
    }

    // 6. Generate Secure Server Object Key
    const env = process.env.NODE_ENV || 'development';
    const mediaAssetId = new mongoose.Types.ObjectId();
    const randomHex = crypto.randomBytes(8).toString('hex');
    const ext = this._getExtensionForMime(normalizedMime);
    const objectKey = `media/${env}/${userId}/${mediaAssetId}/original/${randomHex}${ext}`;

    const expiresAt = new Date(Date.now() + mediaConfig.limits.uploadSessionTtlMinutes * 60 * 1000);

    // 7. Create UploadSession & Pending MediaAsset atomically
    const session = await UploadSession.create({
      ownerId: userId,
      purpose,
      mediaType,
      declaredMimeType: normalizedMime,
      declaredFileSize: fileSize,
      declaredChecksum: checksum,
      objectKey,
      status: 'AUTHORIZED',
      expiresAt,
      mediaAssetId,
      idempotencyKey,
    });

    await MediaAsset.create({
      _id: mediaAssetId,
      ownerId: userId,
      uploadSessionId: session._id,
      purpose,
      mediaType,
      originalObjectKey: objectKey,
      originalMimeType: normalizedMime,
      fileSize,
      checksum,
      processingStatus: 'PENDING_UPLOAD',
      moderationStatus: 'NOT_STARTED',
    });

    // 8. Generate Scoped Upload Authorization
    const uploadAuth = await storageProvider.createUploadAuthorization({
      objectKey,
      declaredMimeType: normalizedMime,
      maxSizeBytes: fileSize,
      expiresAt,
    });

    return {
      sessionId: session._id.toString(),
      mediaAssetId: mediaAssetId.toString(),
      purpose,
      mediaType,
      status: 'AUTHORIZED',
      uploadTarget: uploadAuth,
      expiresAt,
      limits: {
        maxSizeBytes: maxSizeAllowed,
      },
    };
  }

  /**
   * Finalize and independently verify an uploaded session
   */
  async finalizeUploadSession(userId, sessionId, data = {}) {
    const session = await UploadSession.findById(sessionId);
    if (!session) {
      const err = new Error('Upload session not found.');
      err.code = 'UPLOAD_SESSION_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 1. Verify Ownership (IDOR Protection)
    if (session.ownerId.toString() !== userId.toString()) {
      const err = new Error('You do not own this upload session.');
      err.code = 'MEDIA_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    // 2. Check Idempotency (Already Finalized)
    if (session.status === 'FINALIZED') {
      const asset = await MediaAsset.findOne({ uploadSessionId: session._id });
      return {
        sessionId: session._id.toString(),
        mediaAssetId: asset ? asset._id.toString() : null,
        status: 'FINALIZED',
        processingStatus: asset ? asset.processingStatus : 'QUEUED',
        verified: true,
      };
    }

    // 3. Check Expiry
    if (session.expiresAt < new Date()) {
      session.status = 'EXPIRED';
      session.failureCode = 'SESSION_EXPIRED';
      await session.save();

      const err = new Error('Upload session has expired. Please create a new upload session.');
      err.code = 'UPLOAD_SESSION_EXPIRED';
      err.statusCode = 400;
      throw err;
    }

    // 4. Verify Stored Object Existence & Bytes
    const inspection = await storageProvider.inspectObject(session.objectKey);
    if (!inspection.exists) {
      session.status = 'FAILED';
      session.failureCode = 'OBJECT_NOT_FOUND_IN_STORAGE';
      await session.save();

      const err = new Error('Uploaded object was not found in storage.');
      err.code = 'UPLOADED_OBJECT_NOT_FOUND';
      err.statusCode = 400;
      throw err;
    }

    // 5. Byte-Level Verification (Size & Magic Numbers)
    if (inspection.sizeBytes === 0) {
      const err = new Error('Uploaded file is empty (0 bytes).');
      err.code = 'EMPTY_FILE_UPLOADED';
      err.statusCode = 400;
      throw err;
    }

    let maxLimit = mediaConfig.limits.maxImageBytes;
    if (session.mediaType === 'VIDEO') maxLimit = mediaConfig.limits.maxVideoBytes;
    if (session.mediaType === 'AUDIO') maxLimit = mediaConfig.limits.maxAudioBytes;

    if (inspection.sizeBytes > maxLimit) {
      const err = new Error(`Uploaded file size exceeds permitted maximum of ${maxLimit} bytes.`);
      err.code = 'FILE_SIZE_EXCEEDS_LIMIT';
      err.statusCode = 400;
      throw err;
    }

    // Check magic number MIME match if detected
    if (inspection.mimeType && inspection.mimeType !== 'application/octet-stream') {
      if (!mediaConfig.allowedMimeTypes[session.mediaType].includes(inspection.mimeType)) {
        const err = new Error(`Byte inspection detected invalid MIME type: ${inspection.mimeType}`);
        err.code = 'BYTE_LEVEL_MIME_SPOOF_DETECTED';
        err.statusCode = 400;
        throw err;
      }
    }

    // 6. Transition Session to FINALIZED
    session.status = 'FINALIZED';
    session.finalizedAt = new Date();
    await session.save();

    // 7. Transition MediaAsset to QUEUED
    const asset = await MediaAsset.findOne({ uploadSessionId: session._id });
    if (asset) {
      asset.processingStatus = 'QUEUED';
      asset.fileSize = inspection.sizeBytes;
      asset.checksum = inspection.checksum;
      asset.verifiedMimeType = inspection.mimeType || session.declaredMimeType;
      await asset.save();

      // Record Outbox Event for Asynchronous Processing
      try {
        await OutboxEvent.create({
          eventType: 'media.processing_requested',
          aggregateType: 'MEDIA_ASSET',
          aggregateId: asset._id.toString(),
          payload: {
            mediaAssetId: asset._id.toString(),
            uploadSessionId: session._id.toString(),
            ownerId: userId.toString(),
            purpose: asset.purpose,
            mediaType: asset.mediaType,
            originalObjectKey: asset.originalObjectKey,
            queuedAt: new Date(),
          },
          deduplicationKey: `media_req_${asset._id}_${Date.now()}`,
        });
      } catch (outboxErr) {
        console.warn('[MEDIA SERVICE] Outbox event recording warning:', outboxErr.message);
      }

      // Execute processor in background / synchronously for test environments
      mediaProcessor.processAsset(asset._id).catch((pErr) => {
        console.error('[MEDIA SERVICE] Background processing error:', pErr);
      });
    }

    return {
      sessionId: session._id.toString(),
      mediaAssetId: asset ? asset._id.toString() : null,
      status: 'FINALIZED',
      processingStatus: 'QUEUED',
      verified: true,
    };
  }

  /**
   * Get media processing status (Owner or authorized caller only)
   */
  async getMediaStatus(userId, mediaId) {
    const asset = await MediaAsset.findById(mediaId);
    if (!asset || asset.processingStatus === 'DELETED') {
      const err = new Error('Media asset not found.');
      err.code = 'MEDIA_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Ownership check
    if (asset.ownerId.toString() !== userId.toString()) {
      const err = new Error('You do not have permission to view this media asset status.');
      err.code = 'MEDIA_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    return {
      mediaId: asset._id.toString(),
      purpose: asset.purpose,
      mediaType: asset.mediaType,
      processingStatus: asset.processingStatus,
      moderationStatus: asset.moderationStatus,
      width: asset.width,
      height: asset.height,
      durationMs: asset.durationMs,
      aspectRatio: asset.aspectRatio,
      thumbnail: asset.thumbnail,
      variants: asset.variants,
      failureCode: asset.failureCode,
      failureMessageSafe: asset.failureMessageSafe,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  /**
   * Delete an unbound media asset
   */
  async deleteMediaAsset(userId, mediaId) {
    const asset = await MediaAsset.findById(mediaId);
    if (!asset) {
      const err = new Error('Media asset not found.');
      err.code = 'MEDIA_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    if (asset.ownerId.toString() !== userId.toString()) {
      const err = new Error('You do not have permission to delete this media asset.');
      err.code = 'MEDIA_ACCESS_DENIED';
      err.statusCode = 403;
      throw err;
    }

    if (asset.processingStatus === 'DELETED') {
      return { deleted: true, mediaId: asset._id.toString() };
    }

    asset.processingStatus = 'DELETED';
    asset.deletedAt = new Date();
    await asset.save();

    // Clean up physical files in storage
    try {
      await storageProvider.deleteObject(asset.originalObjectKey);
      for (const v of asset.variants || []) {
        if (v.objectKey) {
          await storageProvider.deleteObject(v.objectKey);
        }
      }
    } catch (cleanErr) {
      console.warn('[MEDIA SERVICE] Storage deletion warning:', cleanErr.message);
    }

    // Record Outbox Event
    try {
      await OutboxEvent.create({
        eventType: 'media.deleted',
        aggregateType: 'MEDIA_ASSET',
        aggregateId: asset._id.toString(),
        payload: {
          mediaAssetId: asset._id.toString(),
          ownerId: userId.toString(),
          deletedAt: asset.deletedAt,
        },
        deduplicationKey: `media_del_${asset._id}_${Date.now()}`,
      });
    } catch (outboxErr) {
      console.warn('[MEDIA SERVICE] Outbox deletion event warning:', outboxErr.message);
    }

    return {
      deleted: true,
      mediaId: asset._id.toString(),
    };
  }

  /**
   * Cleanup expired upload sessions and orphaned unfinalized objects
   */
  async cleanupExpiredUploadSessions() {
    const cutoff = new Date(Date.now() - mediaConfig.limits.orphanCleanupHours * 60 * 60 * 1000);

    const expiredSessions = await UploadSession.find({
      status: 'AUTHORIZED',
      expiresAt: { $lt: new Date() },
      createdAt: { $lt: cutoff },
    }).limit(100);

    let cleanedCount = 0;
    for (const s of expiredSessions) {
      s.status = 'EXPIRED';
      await s.save();

      // Clean storage if file was uploaded but never finalized
      await storageProvider.deleteObject(s.objectKey);
      cleanedCount++;
    }

    return { cleanedCount };
  }

  /**
   * Authorize media delivery variant access
   */
  async getMediaDeliveryAccess(viewerId, mediaId, variantName = 'medium') {
    const asset = await MediaAsset.findById(mediaId);
    if (!asset || asset.processingStatus === 'DELETED') {
      const err = new Error('Media asset not found.');
      err.code = 'MEDIA_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const Content = require('../models/Content');
    const boundContent = await Content.findOne({
      'mediaItems.mediaAssetId': asset._id,
      status: { $ne: 'DELETED' },
    });

    if (boundContent) {
      const socialPolicyService = require('./socialPolicyService');
      const authResult = await socialPolicyService.evaluateSocialContentAccess({
        viewerId,
        contentDoc: boundContent,
        context: 'MEDIA_DELIVERY',
      });

      if (!authResult.allowed) {
        const err = new Error('You do not have permission to access this media.');
        err.code = authResult.safeErrorCode || 'MEDIA_ACCESS_DENIED';
        err.statusCode = authResult.safeErrorStatus || 404;
        throw err;
      }
    } else {
      // Unbound asset is owner-only
      if (!viewerId || asset.ownerId.toString() !== viewerId.toString()) {
        const err = new Error('You do not have permission to access this media.');
        err.code = 'MEDIA_ACCESS_DENIED';
        err.statusCode = 403;
        throw err;
      }
    }

    // Resolve variant
    const variant = (asset.variants || []).find((v) => v.name === variantName) || asset.variants?.[0];
    const targetObjectKey = variant ? variant.objectKey : (asset.thumbnail?.objectKey || asset.originalObjectKey);
    const readUrl = await storageProvider.createReadAuthorization(targetObjectKey, 3600);

    return {
      mediaId: asset._id.toString(),
      variant: variant?.name || 'original',
      url: readUrl,
      expiresInSec: 3600,
      mimeType: variant?.mimeType || asset.verifiedMimeType || asset.originalMimeType,
      width: variant?.width || asset.width,
      height: variant?.height || asset.height,
    };
  }

  _getExtensionForMime(mimeType) {
    const map = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/heic': '.heic',
      'image/heif': '.heif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/m4a': '.m4a',
      'audio/wav': '.wav',
      'audio/aac': '.aac',
      'audio/ogg': '.ogg',
    };
    return map[mimeType] || '.bin';
  }
}

const mediaService = new MediaService();

module.exports = mediaService;
