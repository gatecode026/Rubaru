const express = require('express');
const {
  blockUser,
  unblockUser,
  reportUser,
  reportContent,
  reportComment,
  getModerationCases,
  getModerationCaseDetail,
  assignModerationCase,
  applyModerationDecision,
} = require('../controllers/safetyController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All safety routes require authenticated session
router.use(protect);

// User-level block & report (Mounted under /v1/users OR /v1)
router.post('/:id/block', blockUser);
router.delete('/:id/block', unblockUser);
router.post('/:id/report', reportUser);

router.post('/users/:id/block', blockUser);
router.delete('/users/:id/block', unblockUser);
router.post('/users/:id/report', reportUser);

// Social Content & Comment Reporting
router.post('/content/:contentId/report', reportContent);
router.post('/comments/:commentId/report', reportComment);

// Admin Moderation Queue Endpoints
router.get('/admin/moderation/cases', getModerationCases);
router.get('/admin/moderation/cases/:caseId', getModerationCaseDetail);
router.post('/admin/moderation/cases/:caseId/assign', assignModerationCase);
router.post('/admin/moderation/cases/:caseId/decision', applyModerationDecision);

module.exports = router;
