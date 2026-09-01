const CallLog = require('../models/CallLog');
const Profile = require('../models/Profile');

// @desc    Get user's call logs history
// @route   GET /api/calls/logs
// @access  Private
const getCallLogs = async (req, res) => {
  try {
    const logs = await CallLog.find({
      $or: [{ caller: req.user._id }, { receiver: req.user._id }],
    })
      .sort({ startedAt: -1 })
      .populate('caller', '_id')
      .populate('receiver', '_id');

    const formattedLogs = await Promise.all(
      logs.map(async (log) => {
        // Find other user in the call log
        const isCaller = log.caller._id.toString() === req.user._id.toString();
        const otherUser = isCaller ? log.receiver : log.caller;
        const otherProfile = await Profile.findOne({ user: otherUser._id });

        // Translate database state to exact keys used in INITIAL_CALL_LOGS UI
        let callTypeUi = log.callType; // incoming, outgoing, missed
        if (!isCaller && log.callType === 'outgoing') {
          callTypeUi = 'incoming';
        } else if (isCaller && log.callType === 'outgoing') {
          callTypeUi = 'outgoing';
        } else if (!isCaller && log.callType === 'missed') {
          callTypeUi = 'missed';
        }

        return {
          id: log._id,
          name: otherProfile ? otherProfile.displayName : 'Rubaru User',
          avatarUri: otherProfile ? otherProfile.avatarUri : 'https://i.pravatar.cc/150?img=60',
          callType: callTypeUi,
          callIconType: log.callIconType,
          date: log.startedAt,
          duration: log.duration,
          isMissed: log.callType === 'missed' || log.callType === 'missed-x',
        };
      })
    );

    res.status(200).json(formattedLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new call log
// @route   POST /api/calls/logs
// @access  Private
const createCallLog = async (req, res) => {
  const { receiverId, callType, callIconType, duration } = req.body;

  if (!receiverId || !callType) {
    return res.status(400).json({ message: 'Please provide receiverId and callType' });
  }

  try {
    const log = await CallLog.create({
      caller: req.user._id,
      receiver: receiverId,
      callType,
      callIconType: callIconType || 'voice',
      duration: duration || '---',
    });

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCallLogs,
  createCallLog,
};
