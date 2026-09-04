const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const walletService = require('../services/walletService');

/**
 * GET /v1/wallet
 * Get authenticated user's wallet balance and stats
 */
router.get('/', protect, async (req, res) => {
  try {
    const balanceInfo = await walletService.getWalletBalance(req.user._id);
    return res.json({
      ok: true,
      data: balanceInfo,
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
 * GET /v1/wallet/transactions
 * Get authenticated user's sanitized transaction history
 */
router.get('/transactions', protect, async (req, res) => {
  try {
    const { limit, page, cursor } = req.query || {};
    const result = await walletService.getUserTransactions(req.user._id, {
      limit,
      page,
      cursor,
    });

    return res.json({
      ok: true,
      data: result.transactions,
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
