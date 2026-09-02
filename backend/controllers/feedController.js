const feedService = require('../services/feedService');

// @desc    Get connected home feed
// @route   GET /v1/feed
// @access  Private
const getConnectedFeed = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const { cursor, limit } = req.query;

    const result = await feedService.getConnectedFeed(viewerId, {
      cursor,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'FEED_ERROR',
      message: error.message,
    });
  }
};

// @desc    Record batched feed impressions
// @route   POST /v1/feed/impressions
// @access  Private
const recordImpressions = async (req, res) => {
  try {
    const viewerId = req.user._id;
    const result = await feedService.recordImpressions(viewerId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'IMPRESSION_INGESTION_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  getConnectedFeed,
  recordImpressions,
};
