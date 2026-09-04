const mongoose = require('mongoose');
const Profile = require('../models/Profile');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Content = require('../models/Content');
const Match = require('../models/Match');
const FollowRelationship = require('../models/FollowRelationship');
const imagekitService = require('../services/imagekitService');

/**
 * Enrich profile with live dynamic stats:
 * 1. likesCount: Total likes across published content (posts & reels) + profile likes
 * 2. connectionsCount: Active matches and accepted follow relationships
 * 3. profileViews: Total profile view count
 */
async function enrichProfileStats(profileDoc) {
  if (!profileDoc) return profileDoc;
  const targetUserId = profileDoc.user?._id || profileDoc.user;

  try {
    const userObjectId = new mongoose.Types.ObjectId(targetUserId.toString());
    const [contentLikesAgg, matchesCount, followsCount] = await Promise.all([
      Content.aggregate([
        {
          $match: {
            authorId: userObjectId,
            status: 'PUBLISHED',
          },
        },
        { $group: { _id: null, totalLikes: { $sum: '$likesCount' } } },
      ]),
      Match.countDocuments({
        users: userObjectId,
        status: 'ACTIVE',
      }),
      FollowRelationship.countDocuments({
        $or: [
          { followerId: userObjectId },
          { followingId: userObjectId },
        ],
        status: 'ACCEPTED',
      }),
    ]);

    const totalContentLikes = contentLikesAgg[0]?.totalLikes || 0;
    const dynamicLikes = Math.max(Number(profileDoc.likesCount) || 0, totalContentLikes);
    const dynamicConnections = Math.max(
      matchesCount,
      followsCount,
      Number(profileDoc.connectionsCount) || 0,
      Number(profileDoc.followersCount) || 0
    );
    const dynamicViews = Number(profileDoc.profileViews) || 0;

    const obj = profileDoc.toObject ? profileDoc.toObject() : { ...profileDoc };
    obj.likesCount = dynamicLikes;
    obj.connectionsCount = dynamicConnections;
    obj.profileViews = dynamicViews;

    // Enrich photos with Content document IDs, likesCount, commentsCount
    const photoUrls = Array.isArray(profileDoc.photos) ? profileDoc.photos : [];
    if (photoUrls.length > 0) {
      try {
        const photosDetailed = await Promise.all(
          photoUrls.map(async (url) => {
            let contentDoc = await Content.findOne({
              authorId: userObjectId,
              $or: [
                { 'mediaItems.originalUrl': url },
                { 'mediaItems.thumbnail.url': url },
                { 'mediaItems.variants.url': url },
              ],
              status: { $ne: 'DELETED' },
            });

            if (!contentDoc) {
              try {
                contentDoc = await Content.create({
                  authorId: userObjectId,
                  contentType: 'POST',
                  mediaItems: [{
                    mediaType: 'IMAGE',
                    originalUrl: url,
                    thumbnail: { url },
                    variants: [{ url, mimeType: 'image/jpeg' }],
                  }],
                  status: 'PUBLISHED',
                  audience: 'PUBLIC',
                });
              } catch (e) {}
            }

            return {
              id: contentDoc?._id?.toString() || url,
              _id: contentDoc?._id?.toString() || url,
              url,
              thumbnailUri: url,
              likesCount: contentDoc?.likesCount || 0,
              commentsCount: contentDoc?.commentsCount || 0,
              isLiked: false,
            };
          })
        );
        obj.photosDetailed = photosDetailed;
      } catch (pErr) {
        console.warn('[ENRICH PHOTOS ERROR]', pErr.message);
      }
    }

    return obj;
  } catch (err) {
    console.warn('[ENRICH PROFILE STATS ERROR]', err.message);
    const obj = profileDoc.toObject ? profileDoc.toObject() : { ...profileDoc };
    obj.likesCount = Number(profileDoc.likesCount) || 0;
    obj.connectionsCount = Number(profileDoc.connectionsCount) || Number(profileDoc.followersCount) || 0;
    obj.profileViews = Number(profileDoc.profileViews) || 0;
    return obj;
  }
}

// @desc    Get current user profile
// @route   GET /api/profiles/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id }).populate('user', 'email phone points');
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    const enriched = await enrichProfileStats(profile);
    res.status(200).json(enriched);
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

    // Increment profile views in real-time when viewed by another user
    if (req.user && req.user._id && req.user._id.toString() !== profile.user._id.toString()) {
      await Profile.updateOne({ _id: profile._id }, { $inc: { profileViews: 1 } });
      profile.profileViews = (profile.profileViews || 0) + 1;
    }

    const enriched = await enrichProfileStats(profile);
    res.status(200).json(enriched);
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
    let profile = await Profile.findOne({ user: req.user._id });
    if (!profile) {
      profile = new Profile({
        user: req.user._id,
        displayName: displayName ? displayName.trim() : 'Rubaru User',
        dateOfBirth: new Date('2000-01-01'),
        gender: gender || 'Other',
        avatarUri: 'https://i.pravatar.cc/150?img=60',
        photos: [],
        interests: [],
      });
    }

    if (displayName && typeof displayName === 'string') {
      profile.displayName = displayName.trim();
    }

    if (dateOfBirth && dateOfBirth !== 'null' && dateOfBirth !== 'undefined') {
      const parsedDate = new Date(dateOfBirth);
      if (!isNaN(parsedDate.getTime())) {
        profile.dateOfBirth = parsedDate;
      }
    }

    if (gender) profile.gender = gender;
    if (bio !== undefined) profile.bio = String(bio);
    if (locationName !== undefined) profile.locationName = String(locationName);

    if (interests !== undefined) {
      try {
        profile.interests = typeof interests === 'string' ? JSON.parse(interests) : (Array.isArray(interests) ? interests : []);
      } catch (e) {
        profile.interests = Array.isArray(interests) ? interests : [interests];
      }
    }

    // Handle single avatar upload or removal
    if (req.body.removeAvatar === 'true' || req.body.removeAvatar === true) {
      profile.avatarUri = 'https://i.pravatar.cc/150?img=60';
    } else if (req.files && req.files.avatar && req.files.avatar.length > 0) {
      try {
        const avatarFile = req.files.avatar[0];
        const uploadedAvatar = await imagekitService.uploadLocalFile(
          avatarFile.path,
          avatarFile.filename,
          imagekitService.FOLDERS.AVATARS,
          ['avatar', req.user._id.toString()]
        );
        profile.avatarUri = uploadedAvatar.url;
      } catch (avatarErr) {
        console.warn('[PROFILE AVATAR IMAGEKIT FALLBACK]', avatarErr.message);
        profile.avatarUri = `/uploads/images/${req.files.avatar[0].filename}`;
      }
    }

    // Handle existing photos
    if (req.body.existingPhotos !== undefined) {
      try {
        profile.photos = typeof req.body.existingPhotos === 'string' ? JSON.parse(req.body.existingPhotos) : (Array.isArray(req.body.existingPhotos) ? req.body.existingPhotos : []);
      } catch (e) {
        profile.photos = Array.isArray(req.body.existingPhotos) ? req.body.existingPhotos : [];
      }
    }

    // Handle multiple photos upload
    if (req.files && req.files.photos && req.files.photos.length > 0) {
      const photoUrls = await Promise.all(
        req.files.photos.map(async (file) => {
          try {
            const uploadedPhoto = await imagekitService.uploadLocalFile(
              file.path,
              file.filename,
              imagekitService.FOLDERS.PHOTOS,
              ['photo', req.user._id.toString()]
            );
            return uploadedPhoto.url;
          } catch (photoErr) {
            console.warn('[PROFILE PHOTO IMAGEKIT FALLBACK]', photoErr.message);
            return `/uploads/images/${file.filename}`;
          }
        })
      );
      profile.photos = [...(Array.isArray(profile.photos) ? profile.photos : []), ...photoUrls];
    }

    // Handle location updates
    if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
      profile.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
    }

    const updatedProfile = await profile.save();
    await User.findByIdAndUpdate(req.user._id, { isProfileSetup: true });
    console.log(`[EDIT PROFILE] Profile updated for user ${req.user._id}`);
    res.status(200).json(updatedProfile);
  } catch (error) {
    console.error('[EDIT PROFILE BACKEND ERROR]', error);
    res.status(500).json({ message: error.message || 'Failed to update profile' });
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

    const result = profiles
      .filter((p) => p.user)
      .map((p) => ({
        userId: p.user._id || p.user,
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

    const result = profiles
      .filter((p) => p.user)
      .map((p) => ({
        userId: p.user._id || p.user,
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
