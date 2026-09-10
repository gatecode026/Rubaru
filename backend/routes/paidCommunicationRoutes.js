const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const paidCommunicationService = require('../services/paidCommunicationService');
const turnService = require('../services/turnService');
const telemetryService = require('../services/telemetryService');

/**
 * GET /v1/paid-communication/turn-credentials
 * Get short-lived authenticated STUN/TURN ICE server configuration
 */
router.get('/turn-credentials', protect, async (req, res) => {
  try {
    const creds = turnService.generateTurnCredentials(req.user._id.toString());
    return res.json({
      ok: true,
      data: creds,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, code: 'TURN_ERROR', message: err.message });
  }
});

/**
 * GET /v1/paid-communication/health
 * Public/authenticated health & alert check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await telemetryService.getHealthStatus();
    const statusCode = health.status === 'HEALTHY' ? 200 : 503;
    return res.status(statusCode).json({ ok: true, data: health });
  } catch (err) {
    return res.status(500).json({ ok: false, code: 'HEALTH_CHECK_ERROR', message: err.message });
  }
});

/**
 * POST /v1/paid-communication/sessions
 * Initiate a new paid communication session
 */
router.post('/sessions', protect, async (req, res) => {
  try {
    const { receiverId, conversationId, communicationType } = req.body || {};

    if (!receiverId || !communicationType) {
      return res.status(400).json({
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'receiverId and communicationType are required',
      });
    }

    const session = await paidCommunicationService.initiatePaidSession({
      initiatorId: req.user._id,
      receiverId,
      conversationId: conversationId || null,
      communicationType,
    });

    return res.status(201).json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      details: err.details,
    });
  }
});

/**
 * POST /v1/paid-communication/sessions/:sessionId/accept
 * Receiver accepts session request
 */
router.post('/sessions/:sessionId/accept', protect, async (req, res) => {
  try {
    const session = await paidCommunicationService.acceptPaidSession({
      receiverId: req.user._id,
      sessionId: req.params.sessionId,
    });

    return res.json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /v1/paid-communication/sessions/:sessionId/decline
 * Receiver declines session request
 */
router.post('/sessions/:sessionId/decline', protect, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const session = await paidCommunicationService.declinePaidSession({
      receiverId: req.user._id,
      sessionId: req.params.sessionId,
      reason,
    });

    return res.json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /v1/paid-communication/sessions/:sessionId/cancel
 * Initiator cancels session request
 */
router.post('/sessions/:sessionId/cancel', protect, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const session = await paidCommunicationService.cancelPaidSession({
      initiatorId: req.user._id,
      sessionId: req.params.sessionId,
      reason,
    });

    return res.json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /v1/paid-communication/sessions/:sessionId/connected
 * Mark participant media/socket connected
 */
router.post('/sessions/:sessionId/connected', protect, async (req, res) => {
  try {
    const { connectionNonce } = req.body || {};
    const session = await paidCommunicationService.markParticipantConnected({
      userId: req.user._id,
      sessionId: req.params.sessionId,
      connectionNonce,
    });

    return res.json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /v1/paid-communication/sessions/:sessionId/heartbeat
 * Record heartbeat
 */
router.post('/sessions/:sessionId/heartbeat', protect, async (req, res) => {
  try {
    const result = await paidCommunicationService.recordSessionHeartbeat({
      userId: req.user._id,
      sessionId: req.params.sessionId,
    });

    return res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /v1/paid-communication/sessions/:sessionId/end
 * End an active or pending session
 */
router.post('/sessions/:sessionId/end', protect, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const session = await paidCommunicationService.endPaidSession({
      actorUserId: req.user._id,
      sessionId: req.params.sessionId,
      endReason: reason,
    });

    return res.json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * GET /v1/paid-communication/sessions/:sessionId
 * Get single session details
 */
router.get('/sessions/:sessionId', protect, async (req, res) => {
  try {
    const session = await paidCommunicationService.getPaidSession(
      req.params.sessionId,
      req.user._id
    );

    return res.json({
      ok: true,
      data: session,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

/**
 * GET /v1/paid-communication/sessions
 * List authenticated user's sessions
 */
router.get('/sessions', protect, async (req, res) => {
  try {
    const { limit, page, status } = req.query || {};
    const result = await paidCommunicationService.listUserPaidSessions(
      req.user._id,
      { limit, page, status }
    );

    return res.json({
      ok: true,
      data: result.sessions,
      pagination: result.pagination,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      ok: false,
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
    });
  }
});

module.exports = router;
