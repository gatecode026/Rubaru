const mongoose = require('mongoose');
const { Genders, DatingIntentions } = require('./enums');

const DatingProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
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
    age: {
      type: Number,
      required: true,
      min: [18, 'User must be at least 18 years old to use the dating engine'],
      max: [120, 'Invalid age value'],
    },
    gender: {
      type: String,
      enum: Object.values(Genders),
      required: true,
      index: true,
    },
    bio: {
      type: String,
      default: '',
      maxLength: [500, 'Bio cannot exceed 500 characters'],
      trim: true,
    },
    avatarUri: {
      type: String,
      required: true,
      default: 'https://i.pravatar.cc/150?img=60',
    },
    photos: {
      type: [String],
      default: [],
    },
    prompts: [
      {
        questionId: {
          type: String,
          required: true,
        },
        question: {
          type: String,
          required: true,
        },
        answer: {
          type: String,
          required: true,
          maxLength: [300, 'Prompt answer cannot exceed 300 characters'],
        },
      },
    ],
    interests: {
      type: [String],
      default: [],
      index: true,
    },
    datingIntention: {
      type: String,
      enum: Object.values(DatingIntentions),
      default: DatingIntentions.NOT_SURE,
      index: true,
    },
    relationshipType: {
      type: String,
      enum: ['MONOGAMOUS', 'NON_MONOGAMOUS', 'OPEN_TO_BOTH'],
      default: 'MONOGAMOUS',
    },
    heightCm: {
      type: Number,
      min: 50,
      max: 260,
    },
    work: {
      type: String,
      default: '',
      trim: true,
    },
    education: {
      type: String,
      default: '',
      trim: true,
    },
    isDiscoverable: {
      type: Boolean,
      default: true,
      index: true,
    },
    completenessScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for high-speed candidate filtering
DatingProfileSchema.index({ isDiscoverable: 1, gender: 1, age: 1 });

module.exports = mongoose.model('DatingProfile', DatingProfileSchema);
