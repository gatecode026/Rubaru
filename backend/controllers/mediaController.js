const mediaService = require('../services/mediaService');
const storageProvider = require('../services/storage/storageProvider');
const imagekitService = require('../services/imagekitService');
const MediaAsset = require('../models/MediaAsset');
const mongoose = require('mongoose');

// @desc    Create a scoped, authenticated upload session
// @route   POST /v1/media/upload-sessions
// @access  Private
const createUploadSession = async (req, res) => {
  try {
    const result = await mediaService.createUploadSession(req.user._id, req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'UPLOAD_SESSION_ERROR',
      message: error.message,
    });
  }
};

// @desc    Finalize and verify an uploaded session
// @route   POST /v1/media/upload-sessions/:sessionId/finalize
// @access  Private
const finalizeUploadSession = async (req, res) => {
  try {
    const result = await mediaService.finalizeUploadSession(
      req.user._id,
      req.params.sessionId,
      req.body
    );
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FINALIZE_SESSION_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get upload session status
// @route   GET /v1/media/upload-sessions/:sessionId
// @access  Private
const getUploadSessionStatus = async (req, res) => {
  try {
    const result = await mediaService.getUploadSessionStatus(req.user._id, req.params.sessionId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'SESSION_STATUS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Retry an interrupted or failed upload session
// @route   POST /v1/media/upload-sessions/:sessionId/retry
// @access  Private
const retryUploadSession = async (req, res) => {
  try {
    const result = await mediaService.retryUploadSession(req.user._id, req.params.sessionId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'RETRY_SESSION_ERROR',
      message: error.message,
    });
  }
};

// @desc    Cancel an unattached upload session
// @route   DELETE /v1/media/upload-sessions/:sessionId
// @access  Private
const cancelUploadSession = async (req, res) => {
  try {
    const result = await mediaService.cancelUploadSession(req.user._id, req.params.sessionId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'CANCEL_SESSION_ERROR',
      message: error.message,
    });
  }
};

// @desc    Get media processing status
// @route   GET /v1/media/:mediaId/status
// @access  Private
const getMediaStatus = async (req, res) => {
  try {
    const result = await mediaService.getMediaStatus(req.user._id, req.params.mediaId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'MEDIA_STATUS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Delete an unbound media asset
// @route   DELETE /v1/media/:mediaId
// @access  Private
const deleteMediaAsset = async (req, res) => {
  try {
    const result = await mediaService.deleteMediaAsset(req.user._id, req.params.mediaId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'MEDIA_DELETE_ERROR',
      message: error.message,
    });
  }
};

// @desc    Direct raw upload receiver (local / test environment endpoint)
// @route   PUT /v1/media/upload-direct/:objectKey
// @access  Public / Scoped Authorization
const handleDirectUpload = async (req, res) => {
  try {
    const objectKey = decodeURIComponent(req.params.objectKey);
    const mimeType = req.headers['content-type'] || 'application/octet-stream';

    // Buffer incoming stream
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      await storageProvider.writeObject(objectKey, buffer, mimeType);
      return res.status(200).json({
        success: true,
        message: 'Object uploaded successfully.',
        objectKey,
        sizeBytes: buffer.length,
      });
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get authorized media delivery access
// @route   GET /v1/media/:mediaId/access
// @access  Private
const getMediaDeliveryAccess = async (req, res) => {
  try {
    const viewerId = req.user ? req.user._id : null;
    const result = await mediaService.getMediaDeliveryAccess(viewerId, req.params.mediaId, req.query.variant);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'MEDIA_ACCESS_ERROR',
      message: error.message,
    });
  }
};

// @desc    Upload media directly to ImageKit and register a MediaAsset
// @route   POST /v1/media/upload
// @access  Private
const uploadMultipartMedia = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No media file provided.' });
    }

    const purpose = req.body.purpose || 'POST_MEDIA';
    const folder = purpose === 'STORY_MEDIA'
      ? imagekitService.FOLDERS.STORIES
      : purpose === 'REEL_VIDEO'
      ? imagekitService.FOLDERS.REELS
      : imagekitService.FOLDERS.POSTS;

    const isVideo = file.mimetype.startsWith('video/');
    const mediaType = isVideo ? 'VIDEO' : 'IMAGE';

    // Upload directly to ImageKit
    const ikRes = await imagekitService.uploadLocalFile(
      file.path,
      file.filename,
      folder,
      ['rubaru', purpose.toLowerCase(), req.user._id.toString()]
    );

    const mediaAssetId = new mongoose.Types.ObjectId();
    const asset = await MediaAsset.create({
      _id: mediaAssetId,
      ownerId: req.user._id,
      uploadSessionId: new mongoose.Types.ObjectId(),
      purpose,
      mediaType,
      attachmentCategory: mediaType,
      originalObjectKey: ikRes.filePath || ikRes.name,
      originalMimeType: file.mimetype,
      verifiedMimeType: file.mimetype,
      fileSize: file.size || 0,
      width: ikRes.width || (isVideo ? 1080 : 1080),
      height: ikRes.height || (isVideo ? 1920 : 1350),
      aspectRatio: (ikRes.width && ikRes.height) ? (ikRes.width / ikRes.height) : (isVideo ? 0.5625 : 0.8),
      thumbnail: {
        url: ikRes.thumbnailUrl || (isVideo ? `${ikRes.url}/ik-thumbnail.jpg` : ikRes.url),
        width: 480,
        height: isVideo ? 854 : 600,
      },
      variants: [
        {
          name: 'original',
          objectKey: ikRes.filePath || ikRes.name,
          mimeType: file.mimetype,
          url: ikRes.url,
          width: ikRes.width || 1080,
          height: ikRes.height || (isVideo ? 1920 : 1350),
          fileSize: file.size || 0,
          processingState: 'READY',
        },
      ],
      processingStatus: 'READY',
      moderationStatus: 'APPROVED',
    });

    return res.status(201).json({
      success: true,
      mediaAssetId: asset._id.toString(),
      _id: asset._id.toString(),
      url: ikRes.url,
      thumbnailUrl: asset.thumbnail.url,
      data: {
        mediaAssetId: asset._id.toString(),
        _id: asset._id.toString(),
        url: ikRes.url,
        thumbnailUrl: asset.thumbnail.url,
        mediaType,
        width: asset.width,
        height: asset.height,
      },
    });
  } catch (error) {
    console.error('[UPLOAD MULTIPART ERROR]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Media upload failed',
    });
  }
};

module.exports = {
  createUploadSession,
  finalizeUploadSession,
  getUploadSessionStatus,
  retryUploadSession,
  cancelUploadSession,
  getMediaStatus,
  deleteMediaAsset,
  handleDirectUpload,
  getMediaDeliveryAccess,
  uploadMultipartMedia,
};
