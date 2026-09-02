const preferenceService = require('../services/preferenceService');

/**
 * @desc    Get authenticated user's dating preferences
 * @route   GET /v1/dating/preferences
 * @access  Private
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const result = await preferenceService.getPreferences(userId);
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
        message: error.message || 'An unexpected error occurred while fetching preferences',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Partially update authenticated user's dating preferences
 * @route   PATCH /v1/dating/preferences
 * @access  Private
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const result = await preferenceService.updatePreferences(userId, req.body);
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
        message: error.message || 'An unexpected error occurred while updating preferences',
        details: error.details || null,
      },
    });
  }
};

module.exports = {
  getPreferences,
  updatePreferences,
};
