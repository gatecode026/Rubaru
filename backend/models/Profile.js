const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ['Female', 'Male', 'More', 'Other'],
      required: true,
    },
    interests: {
      type: [String],
      default: [],
    },
    avatarUri: {
      type: String,
      default: 'https://i.pravatar.cc/150?img=60', // Fallback default avatar
    },
    photos: {
      type: [String],
      default: [],
    },
    bio: {
      type: String,
      default: '',
    },
    locationName: {
      type: String,
      default: '',
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [75.7873, 26.9124], // Jaipur default coordinates
      },
    },
    followersCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    connectionsCount: {
      type: Number,
      default: 0,
    },
    profileViews: {
      type: Number,
      default: 0,
    },
    socialAccountVisibility: {
      type: String,
      enum: ['PUBLIC', 'PRIVATE'],
      default: 'PUBLIC',
      index: true,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

ProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Profile', ProfileSchema);
