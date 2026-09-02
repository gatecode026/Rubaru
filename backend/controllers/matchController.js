const matchService = require('../services/matchService');

/**
 * @desc    Get active Matches list for logged-in user
 * @route   GET /v1/matches
 * @access  Private
 */
const getMatches = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const result = await matchService.getMatchesList(userId, req.query);

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
        message: error.message || 'An unexpected error occurred while fetching matches',
        details: error.details || null,
      },
    });
  }
};

/**
 * @desc    Get Match Details by ID
 * @route   GET /v1/matches/:id
 * @access  Private
 */
const getMatchById = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await matchService.getMatchDetails(userId, id);

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
        message: error.message || 'An unexpected error occurred while fetching match details',
        details: error.details || null,
      },
    });
  }
};

module.exports = {
  getMatches,
  getMatchById,
};
