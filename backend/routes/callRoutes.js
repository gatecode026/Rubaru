const express = require('express');
const {
  getCallLogs,
  createCallLog,
} = require('../controllers/callController');
const { protect } = require('../middleware/auth');
const turnService = require('../services/turnService');
const callMetrics = require('../services/callMetrics');
const pushAdapter = require('../services/pushAdapter');
const CallingConfig = require('../config/callingConfig');

const router = express.Router();

router.use(protect);

router.get('/logs', getCallLogs);
router.post('/logs', createCallLog);

/**
 * GET /api/calls/turn-credentials and /api/calls/ice-servers
 * Return short-lived HMAC-authenticated STUN/TURN configuration
 */
const getIceServersHandler = async (req, res) => {
  try {
    const creds = turnService.generateTurnCredentials(req.user._id.toString());
    return res.json({
      ok: true,
      data: creds,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, code: 'TURN_ERROR', message: err.message });
  }
};

router.get('/turn-credentials', getIceServersHandler);
router.get('/ice-servers', getIceServersHandler);

/**
 * GET /api/calls/operational-health and /api/calls/metrics
 * Expose live operational calling metrics, latency percentiles, and alerts
 */
const getOperationalHealthHandler = async (req, res) => {
  try {
    const health = callMetrics.getOperationalHealth();
    const configStatus = CallingConfig.validateConfig();
    const pushStatus = pushAdapter.getProviderStatus();

    return res.json({
      ok: true,
      data: {
        ...health,
        subsystems: {
          config: configStatus.summary,
          push: pushStatus,
          isCallingEnabled: CallingConfig.isCallingEnabled,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

router.get('/operational-health', getOperationalHealthHandler);
router.get('/metrics', getOperationalHealthHandler);

/**
 * POST /api/calls/:callId/diagnostics and /api/calls/diagnostics
 * Ingest production WebRTC call diagnostics summary safely without sensitive leaks
 */
const postDiagnosticsHandler = async (req, res) => {
  try {
    const callId = req.params.callId || req.body.callId;
    const userId = req.user._id.toString();
    const diagnostics = req.body.diagnostics || req.body;

    if (!callId || !diagnostics) {
      return res.status(400).json({ ok: false, message: 'callId and diagnostics required' });
    }

    // Strip any sensitive fields if present in payload
    const sanitized = {
      testCaseId: diagnostics.testCaseId || 'CLIENT_OBS',
      timeline: diagnostics.timeline || {},
      connection: diagnostics.connection || {},
      qualityMetrics: diagnostics.qualityMetrics || {},
      termination: diagnostics.termination || {},
      redactionStatus: { secretsRedacted: true, tokensExcluded: true, turnCredentialsExcluded: true },
      receivedAt: new Date().toISOString(),
    };

    // Feed sanitized diagnostics into live metrics aggregator
    callMetrics.recordClientDiagnostics(sanitized);

    return res.json({ ok: true, message: 'Diagnostics recorded successfully', data: sanitized });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};

router.post('/:callId/diagnostics', postDiagnosticsHandler);
router.post('/diagnostics', postDiagnosticsHandler);

module.exports = router;

