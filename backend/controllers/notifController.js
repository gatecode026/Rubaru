const Notification = require('../models/Notification');
const Profile = require('../models/Profile');

// @desc    Get user's notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .populate('sender', '_id');

    const formattedNotifs = await Promise.all(
      notifications.map(async (notif) => {
        const senderProfile = await Profile.findOne({ user: notif.sender._id });

        return {
          id: notif._id,
          type: notif.type, // 'like', 'follow', 'message', 'call', etc.
          message: notif.message,
          isRead: notif.isRead,
          createdAt: notif.createdAt,
          sender: senderProfile
            ? {
                userId: senderProfile.user,
                displayName: senderProfile.displayName,
                avatarUri: senderProfile.avatarUri,
              }
            : null,
          relatedReel: notif.relatedReel,
          relatedChat: notif.relatedChat,
        };
      })
    );

    res.status(200).json(formattedNotifs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const notif = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notif) {
      return res.status(404).json({ message: 'Notification not found or unauthorized' });
    }

    notif.isRead = true;
    await notif.save();

    res.status(200).json(notif);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
};
