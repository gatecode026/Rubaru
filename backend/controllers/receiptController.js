const receiptService = require('../services/receiptService');

/**
 * @desc    Advance delivered watermark for a conversation
 * @route   POST /v1/conversations/:conversationId/receipts/delivered
 * @access  Private
 */
const markDelivered = async (req, res) => {
  try {
    const { throughSequence } = req.body || {};
    const result = await receiptService.advanceDeliveryWatermark({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      throughSequence,
    });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'RECEIPT_DELIVERY_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Advance read watermark for a conversation (Read implies delivered)
 * @route   POST /v1/conversations/:conversationId/receipts/read
 * @access  Private
 */
const markRead = async (req, res) => {
  try {
    const { throughSequence } = req.body || {};
    const result = await receiptService.advanceReadWatermark({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
      throughSequence,
    });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'RECEIPT_READ_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Get receipt state for a conversation (Self & Peer watermarks)
 * @route   GET /v1/conversations/:conversationId/receipts
 * @access  Private
 */
const getReceiptState = async (req, res) => {
  try {
    const result = await receiptService.getConversationReceiptState({
      actorUserId: req.user._id,
      conversationId: req.params.conversationId,
    });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || 'GET_RECEIPT_STATE_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  markDelivered,
  markRead,
  getReceiptState,
};
