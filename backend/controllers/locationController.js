const locationService = require('../services/locationService');

/**
 * @desc    Update authenticated user's protected location
 * @route   PUT /v1/dating/location
 * @access  Private
 */
const updateLocation = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    
    // Explicitly disallow client-supplied userId
    if (req.body.userId && req.body.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED_USER_ID',
          message: 'Client cannot supply another user ID for location update',
        },
      });
    }

    const result = await locationService.updateLocation(userId, req.body);
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
        message: error.message || 'An unexpected error occurred while updating location',
        details: error.details || null,
      },
    });
  }
};

module.exports = {
  updateLocation,
};
