const discoveryService = require('../services/discoveryService');
const impressionService = require('../services/impressionService');

/**
 * @desc    Get discovery candidates for authenticated user
 * @route   GET /v1/discovery/candidates
 * @access  Private
 */
const getCandidates = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { cursor, limit, surface } = req.query;

    const result = await discoveryService.getDiscoveryCandidates(userId, {
      cursor,
      limit,
      surface,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred during discovery',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Record confirmed profile impressions from mobile discovery view
 * @route   POST /v1/discovery/impressions
 * @access  Private
 */
const recordImpressions = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const result = await impressionService.recordConfirmedImpressions(userId, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred while recording impressions',
        details: error.details || null,
      },
    });
  }
};

module.exports = {
  getCandidates,
  recordImpressions,
};
