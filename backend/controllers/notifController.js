const notificationService = require('../services/notificationService');

/**
 * @desc    Get user's notifications (Cursor paginated)
 * @route   GET /v1/notifications & GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const { cursor, limit, category, type } = req.query;

    const result = await notificationService.getNotifications(userId, {
      cursor,
      limit,
      category,
      type,
    });

    res.status(200).json({
      success: true,
      data: result.items,
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'GET_NOTIFICATIONS_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Mark a notification as read
 * @route   PATCH /v1/notifications/:id/read & PUT /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    const result = await notificationService.markAsRead(userId, notificationId);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'MARK_READ_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /v1/notifications/read-all & PUT /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.markAllAsRead(userId);
    res.status(200).json({
      success: true,
      data: result,
      ...result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'MARK_ALL_READ_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Get unread notifications count
 * @route   GET /v1/notifications/unread-count & GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.getUnreadCount(userId);
    res.status(200).json({
      success: true,
      data: result,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'GET_UNREAD_COUNT_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Get user notification preferences
 * @route   GET /v1/users/me/notification-preferences
 * @access  Private
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.getPreferences(userId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'GET_PREFERENCES_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Update user notification preferences
 * @route   PATCH /v1/users/me/notification-preferences
 * @access  Private
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.updatePreferences(userId, req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'UPDATE_PREFERENCES_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Register device push token
 * @route   POST /v1/devices
 * @access  Private
 */
const registerDevice = async (req, res) => {
  try {
    const userId = req.user._id;
    const result = await notificationService.registerDevice(userId, req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'REGISTER_DEVICE_ERROR',
      message: error.message,
    });
  }
};

/**
 * @desc    Revoke device push token
 * @route   DELETE /v1/devices/:deviceId
 * @access  Private
 */
const deleteDevice = async (req, res) => {
  try {
    const userId = req.user._id;
    const deviceId = req.params.deviceId;
    const result = await notificationService.deleteDevice(userId, deviceId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'DELETE_DEVICE_ERROR',
      message: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getPreferences,
  updatePreferences,
  registerDevice,
  deleteDevice,
};
