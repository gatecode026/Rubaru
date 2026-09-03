const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createUploadSession,
  finalizeUploadSession,
  getUploadSessionStatus,
  retryUploadSession,
  cancelUploadSession,
  getMediaStatus,
  deleteMediaAsset,
  handleDirectUpload,
  getMediaDeliveryAccess,
} = require('../controllers/mediaController');

// Direct upload destination for local/test driver (PUT /v1/media/upload-direct/:objectKey)
router.put('/upload-direct/:objectKey(*)', handleDirectUpload);

// Authenticated Media Management Routes
router.post('/upload-sessions', protect, createUploadSession);
router.get('/upload-sessions/:sessionId', protect, getUploadSessionStatus);
router.post('/upload-sessions/:sessionId/finalize', protect, finalizeUploadSession);
router.post('/upload-sessions/:sessionId/retry', protect, retryUploadSession);
router.delete('/upload-sessions/:sessionId', protect, cancelUploadSession);
router.get('/:mediaId/status', protect, getMediaStatus);
router.get('/:mediaId/access', protect, getMediaDeliveryAccess);
router.delete('/:mediaId', protect, deleteMediaAsset);

module.exports = router;
