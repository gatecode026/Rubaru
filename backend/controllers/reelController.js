const Reel = require('../models/Reel');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');

// @desc    Upload a new Reel
// @route   POST /api/reels/upload
// @access  Private
const createReel = async (req, res) => {
  const { caption, category, location } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'Please upload a video file' });
  }

  try {
    const videoUri = `/uploads/videos/${req.file.filename}`;

    const reel = await Reel.create({
      user: req.user._id,
      videoUri,
      caption: caption || '',
      category: category || 'General',
      location: location || '',
    });

    res.status(201).json(reel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Reels Feed (all reels or by category)
// @route   GET /api/reels
// @access  Private
const getReels = async (req, res) => {
  const { category, page = 1, limit = 10 } = req.query;

  try {
    const query = {};
    if (category) {
      query.category = category;
    }

    const skipIndex = (page - 1) * limit;

    // Find reels, populated with user info
    const reels = await Reel.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skipIndex)
      .populate('user', 'email');

    // Build rich reels objects matching frontend ReelItem expectancies
    const populatedReels = await Promise.all(
      reels.map(async (reel) => {
        const creatorProfile = await Profile.findOne({ user: reel.user._id });
        const isLiked = reel.likes.includes(req.user._id);

        return {
          id: reel._id,
          videoUri: reel.videoUri,
          caption: reel.caption,
          category: reel.category,
          location: reel.location,
          likesCount: reel.likes.length,
          isLiked: isLiked,
          userName: creatorProfile ? creatorProfile.displayName : 'Rubaru User',
          userAvatar: creatorProfile ? creatorProfile.avatarUri : 'https://i.pravatar.cc/150?img=60',
          sharesCount: reel.sharesCount,
          commentsCount: reel.commentsCount,
          createdAt: reel.createdAt,
        };
      })
    );

    res.status(200).json(populatedReels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Like / Unlike a Reel
// @route   POST /api/reels/:id/like
// @access  Private
const likeReel = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const currentUserId = req.user._id;
    const isLiked = reel.likes.includes(currentUserId);

    if (isLiked) {
      // Unlike
      reel.likes = reel.likes.filter(id => id.toString() !== currentUserId.toString());
      await reel.save();

      res.status(200).json({ isLiked: false, likesCount: reel.likes.length });
    } else {
      // Like
      reel.likes.push(currentUserId);
      await reel.save();

      // Trigger notification if liker is not the owner
      if (reel.user.toString() !== currentUserId.toString()) {
        const currentProfile = await Profile.findOne({ user: currentUserId });
        
        await Notification.create({
          recipient: reel.user,
          sender: currentUserId,
          type: 'like',
          message: `${currentProfile ? currentProfile.displayName : 'Someone'} liked your short video.`,
          relatedReel: reel._id,
        });
      }

      res.status(200).json({ isLiked: true, likesCount: reel.likes.length });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Reels by user
// @route   GET /api/reels/user/:userId
// @access  Private
const getUserReels = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    const reels = await Reel.find({ user: userId })
      .sort({ createdAt: -1 })
      .lean();

    const result = reels.map((reel) => ({
      id: reel._id,
      videoUri: reel.videoUri,
      thumbnailUri: reel.thumbnailUri || '',
      caption: reel.caption,
      category: reel.category,
      likesCount: reel.likes ? reel.likes.length : 0,
      isLiked: reel.likes ? reel.likes.map(String).includes(String(req.user._id)) : false,
      sharesCount: reel.sharesCount,
      commentsCount: reel.commentsCount,
      createdAt: reel.createdAt,
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createReel,
  getReels,
  likeReel,
  getUserReels,
};
