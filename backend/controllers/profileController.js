const Profile = require('../models/Profile');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Get current user profile
// @route   GET /api/profiles/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id }).populate('user', 'email phone points');
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile by ID
// @route   GET /api/profiles/:userId
// @access  Private
const getProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.params.userId }).populate('user', 'email phone');
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Edit user profile
// @route   PUT /api/profiles/edit
// @access  Private
const editProfile = async (req, res) => {
  const { displayName, dateOfBirth, gender, interests, bio, locationName, latitude, longitude } = req.body;

  try {
    const profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    if (displayName) profile.displayName = displayName;
    if (dateOfBirth) profile.dateOfBirth = new Date(dateOfBirth);
    if (gender) profile.gender = gender;
    if (bio !== undefined) profile.bio = bio;
    if (locationName !== undefined) profile.locationName = locationName;

    if (interests) {
      profile.interests = typeof interests === 'string' ? JSON.parse(interests) : interests;
    }

    // Handle single avatar upload or removal
    if (req.body.removeAvatar === 'true' || req.body.removeAvatar === true) {
      profile.avatarUri = 'https://i.pravatar.cc/150?img=60';
    } else if (req.files && req.files.avatar) {
      profile.avatarUri = `/uploads/images/${req.files.avatar[0].filename}`;
    }

    // Handle existing photos
    if (req.body.existingPhotos) {
      profile.photos = typeof req.body.existingPhotos === 'string' ? JSON.parse(req.body.existingPhotos) : req.body.existingPhotos;
    }

    // Handle multiple photos upload
    if (req.files && req.files.photos) {
      const photoUrls = req.files.photos.map(file => `/uploads/images/${file.filename}`);
      profile.photos = [...profile.photos, ...photoUrls];
    }

    // Handle location updates
    if (latitude && longitude) {
      profile.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
    }

    const updatedProfile = await profile.save();
    res.status(200).json(updatedProfile);
  } catch (error) {
    console.error('[EDIT PROFILE BACKEND ERROR]', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Follow / Unfollow a profile
// @route   POST /api/profiles/:userId/follow
// @access  Private
const followProfile = async (req, res) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user._id;

  if (targetUserId === currentUserId.toString()) {
    return res.status(400).json({ message: 'You cannot follow yourself' });
  }

  try {
    const targetProfile = await Profile.findOne({ user: targetUserId });
    const currentProfile = await Profile.findOne({ user: currentUserId });

    if (!targetProfile || !currentProfile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const isFollowing = currentProfile.following.includes(targetUserId);

    if (isFollowing) {
      // Unfollow
      currentProfile.following = currentProfile.following.filter(id => id.toString() !== targetUserId);
      currentProfile.followingCount = Math.max(0, currentProfile.followingCount - 1);

      targetProfile.followers = targetProfile.followers.filter(id => id.toString() !== currentUserId.toString());
      targetProfile.followersCount = Math.max(0, targetProfile.followersCount - 1);

      await currentProfile.save();
      await targetProfile.save();

      res.status(200).json({ message: 'Unfollowed successfully', isFollowing: false });
    } else {
      // Follow
      currentProfile.following.push(targetUserId);
      currentProfile.followingCount += 1;

      targetProfile.followers.push(currentUserId);
      targetProfile.followersCount += 1;

      await currentProfile.save();
      await targetProfile.save();

      // Create notification
      await Notification.create({
        recipient: targetUserId,
        sender: currentUserId,
        type: 'follow',
        message: `${currentProfile.displayName} started following you.`,
      });

      res.status(200).json({ message: 'Followed successfully', isFollowing: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get nearby discoverable profiles
// @route   GET /api/profiles/discover/nearby
// @access  Private
const getNearbyProfiles = async (req, res) => {
  try {
    const currentProfile = await Profile.findOne({ user: req.user._id });
    if (!currentProfile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    const [longitude, latitude] = currentProfile.location.coordinates;
    const maxDistance = req.query.distance ? parseInt(req.query.distance) : 50000; // default 50km
    
    // Find profiles within maxDistance (meters), excluding self
    const query = {
      user: { $ne: req.user._id },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistance,
        },
      },
    };

    // Filter by interest if specified
    if (req.query.interest) {
      query.interests = req.query.interest;
    }

    // Filter by gender if specified
    if (req.query.gender) {
      query.gender = req.query.gender;
    }

    const nearby = await Profile.find(query).populate('user', 'email phone');
    res.status(200).json(nearby);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Search profiles by name
// @route   GET /api/profiles/search?q=searchTerm
// @access  Private
const searchProfiles = async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q.trim()) {
      return res.status(200).json([]);
    }

    const regex = new RegExp(q.trim(), 'i');

    const profiles = await Profile.find({
      user: { $ne: req.user._id }, // exclude self
      $or: [
        { displayName: { $regex: regex } },
        { username: { $regex: regex } },
      ],
    })
      .limit(20)
      .populate('user', '_id email');

    const result = profiles.map((p) => ({
      userId: p.user._id,
      displayName: p.displayName || 'Rubaru User',
      username: p.username || '',
      avatarUri: p.avatarUri || '',
      bio: p.bio || '',
      locationName: p.locationName || '',
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all profiles (for discovery when no search term)
// @route   GET /api/profiles/all
// @access  Private
const getAllProfiles = async (req, res) => {
  try {
    const profiles = await Profile.find({ user: { $ne: req.user._id } })
      .limit(30)
      .populate('user', '_id email');

    const result = profiles.map((p) => ({
      userId: p.user._id,
      displayName: p.displayName || 'Rubaru User',
      username: p.username || '',
      avatarUri: p.avatarUri || '',
      bio: p.bio || '',
      locationName: p.locationName || '',
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMe,
  getProfile,
  editProfile,
  followProfile,
  getNearbyProfiles,
  searchProfiles,
  getAllProfiles,
};
