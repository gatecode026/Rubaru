const safetyService = require('../services/safetyService');
const socialModerationService = require('../services/socialModerationService');

/**
 * @desc    Unmatch an active match (Dating Core)
 * @route   POST /v1/matches/:id/unmatch
 * @access  Private
 */
const unmatchMatch = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await safetyService.unmatchUser(userId, id, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred while unmatching',
    });
  }
};

/**
 * @desc    Block a user
 * @route   POST /v1/users/:id/block
 * @access  Private
 */
const blockUser = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await safetyService.blockUser(userId, id, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred while blocking user',
    });
  }
};

/**
 * @desc    Unblock a user
 * @route   DELETE /v1/users/:id/block
 * @access  Private
 */
const unblockUser = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await safetyService.unblockUser(userId, id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An unexpected error occurred while unblocking user',
    });
  }
};

/**
 * @desc    Submit report against user (Profile / Dating / Social)
 * @route   POST /v1/users/:id/report
 * @access  Private
 */
const reportUser = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { id } = req.params;
    const result = await socialModerationService.reportUser(userId, id, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'REPORT_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Submit report against content (Post, Reel, Story)
 * @route   POST /v1/content/:contentId/report
 * @access  Private
 */
const reportContent = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { contentId } = req.params;
    const result = await socialModerationService.reportContent(userId, contentId, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'REPORT_CONTENT_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Submit report against comment
 * @route   POST /v1/comments/:commentId/report
 * @access  Private
 */
const reportComment = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { commentId } = req.params;
    const result = await socialModerationService.reportComment(userId, commentId, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'REPORT_COMMENT_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Admin: List moderation cases
 * @route   GET /v1/admin/moderation/cases
 * @access  Admin/Moderator
 */
const getModerationCases = async (req, res) => {
  try {
    const moderatorId = req.user && req.user._id;
    const { status, priority, subjectType, subjectId, limit } = req.query;
    const result = await socialModerationService.getModerationCases(moderatorId, {
      status,
      priority,
      subjectType,
      subjectId,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'FETCH_CASES_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Admin: Get moderation case details
 * @route   GET /v1/admin/moderation/cases/:caseId
 * @access  Admin/Moderator
 */
const getModerationCaseDetail = async (req, res) => {
  try {
    const moderatorId = req.user && req.user._id;
    const { caseId } = req.params;
    const result = await socialModerationService.getModerationCaseDetail(moderatorId, caseId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'FETCH_CASE_DETAIL_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Admin: Assign moderation case
 * @route   POST /v1/admin/moderation/cases/:caseId/assign
 * @access  Admin/Moderator
 */
const assignModerationCase = async (req, res) => {
  try {
    const moderatorId = req.user && req.user._id;
    const { caseId } = req.params;
    const result = await socialModerationService.assignModerationCase(moderatorId, caseId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'ASSIGN_CASE_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Admin: Apply moderation decision
 * @route   POST /v1/admin/moderation/cases/:caseId/decision
 * @access  Admin/Moderator
 */
const applyModerationDecision = async (req, res) => {
  try {
    const moderatorId = req.user && req.user._id;
    const { caseId } = req.params;
    const result = await socialModerationService.applyModerationDecision(moderatorId, caseId, req.body);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      code: error.code || 'DECISION_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  unmatchMatch,
  blockUser,
  unblockUser,
  reportUser,
  reportContent,
  reportComment,
  getModerationCases,
  getModerationCaseDetail,
  assignModerationCase,
  applyModerationDecision,
};
