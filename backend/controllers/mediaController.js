const mediaService = require('../services/mediaService');
const storageProvider = require('../services/storage/storageProvider');

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
};
