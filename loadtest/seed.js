const path = require('path');
const backendModules = path.join(__dirname, '../backend/node_modules');
require(path.join(backendModules, 'dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const mongoose = require(path.join(backendModules, 'mongoose'));
const jwt = require(path.join(backendModules, 'jsonwebtoken'));
const bcrypt = require(path.join(backendModules, 'bcryptjs'));
const fs = require('fs');

const connectDB = require('../backend/config/db');
const User = require('../backend/models/User');
const Profile = require('../backend/models/Profile');
const FollowRelationship = require('../backend/models/FollowRelationship');
const Content = require('../backend/models/Content');
const MediaAsset = require('../backend/models/MediaAsset');

const JWT_SECRET = process.env.JWT_SECRET || 'rubaru_jwt_secret_token_key_2026';
const assertSeedPermission = require('../backend/utils/assertSeedPermission');
assertSeedPermission('loadtest/seed.js');

async function seed() {
  console.log('[SEED] Connecting to MongoDB...');
  await connectDB();
  console.log('[SEED] Connected.');

  const hashedPassword = await bcrypt.hash('loadtest_pass_123', 8);

  // 1. Clean previous loadtest entities
  console.log('[SEED] Cleaning previous loadtest data...');
  const oldUsers = await User.find({ email: /loadtest_.*@test\.rubaru\.com/ }).select('_id');
  const oldUserIds = oldUsers.map((u) => u._id);
  if (oldUserIds.length > 0) {
    await Promise.all([
      User.deleteMany({ _id: { $in: oldUserIds } }),
      Profile.deleteMany({ user: { $in: oldUserIds } }),
      FollowRelationship.deleteMany({ $or: [{ followerId: { $in: oldUserIds } }, { followingId: { $in: oldUserIds } }] }),
      Content.deleteMany({ authorId: { $in: oldUserIds } }),
      MediaAsset.deleteMany({ ownerId: { $in: oldUserIds } }),
    ]);
  }
  console.log(`[SEED] Purged ${oldUserIds.length} existing loadtest accounts.`);

  // 2. Create Celebrity Account (High-follower target)
  const celebrityUser = await User.create({
    email: 'loadtest_celebrity@test.rubaru.com',
    password: hashedPassword,
    isActive: true,
    accountStatus: 'ACTIVE',
  });
  const celebrityProfile = await Profile.create({
    user: celebrityUser._id,
    username: 'celebrity_star',
    displayName: 'Celebrity Creator',
    gender: 'Female',
    dateOfBirth: new Date('1998-01-01'),
    socialAccountVisibility: 'PUBLIC',
    followersCount: 0,
    followingCount: 0,
    isVerified: true,
  });
  const celebrityToken = jwt.sign({ id: celebrityUser._id }, JWT_SECRET, { expiresIn: '30d' });

  // 3. Create regular test users (50 accounts)
  console.log('[SEED] Creating 50 test users with follow graph...');
  const regularUsers = [];
  for (let i = 1; i <= 50; i++) {
    const u = await User.create({
      email: `loadtest_user_${i}@test.rubaru.com`,
      password: hashedPassword,
      isActive: true,
      accountStatus: 'ACTIVE',
    });
    await Profile.create({
      user: u._id,
      username: `loadtest_u${i}`,
      displayName: `Test User ${i}`,
      gender: i % 2 === 0 ? 'Female' : 'Male',
      dateOfBirth: new Date('1999-06-15'),
      socialAccountVisibility: 'PUBLIC',
      followersCount: 0,
      followingCount: 1, // Following celebrity
    });
    const token = jwt.sign({ id: u._id }, JWT_SECRET, { expiresIn: '30d' });
    regularUsers.push({ id: u._id.toString(), email: u.email, token });
  }

  // 4. Build Follow Graph: All 50 users follow Celebrity + mutual follows
  console.log('[SEED] Establishing follow relationships...');
  const followOps = [];
  for (const ru of regularUsers) {
    // Follow Celebrity
    followOps.push({
      followerId: new mongoose.Types.ObjectId(ru.id),
      followingId: celebrityUser._id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
    });
  }

  // Mutual network among first 20 users
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 5; j++) {
      const targetIdx = (i + j + 1) % 20;
      followOps.push({
        followerId: new mongoose.Types.ObjectId(regularUsers[i].id),
        followingId: new mongoose.Types.ObjectId(regularUsers[targetIdx].id),
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      });
    }
  }
  await FollowRelationship.insertMany(followOps);
  await Profile.updateOne({ user: celebrityUser._id }, { $set: { followersCount: 50 } });

  // 5. Seed Content for Celebrity and Users (Reels, Posts, Stories)
  console.log('[SEED] Seeding media content (reels, posts, stories)...');
  const now = new Date();
  const createdReelIds = [];
  const createdPostIds = [];
  const createdStoryIds = [];

  // Celebrity Content
  for (let r = 1; r <= 10; r++) {
    const reel = await Content.create({
      authorId: celebrityUser._id,
      contentType: 'REEL',
      caption: `Celebrity Official Reel #${r} - Viral Showcase #trending`,
      mediaItems: [
        {
          mediaType: 'VIDEO',
          originalUrl: 'https://ik.imagekit.io/zjd5xircoy/reels/sample_reel.mp4',
          thumbnail: { url: 'https://ik.imagekit.io/zjd5xircoy/reels/sample_reel.mp4/ik-thumbnail.jpg' },
          variants: [{ name: 'source', url: 'https://ik.imagekit.io/zjd5xircoy/reels/sample_reel.mp4' }],
          width: 1080,
          height: 1920,
          aspectRatio: 0.5625,
          durationMs: 15000,
        },
      ],
      videoMediaAssetId: new mongoose.Types.ObjectId(),
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      audience: 'PUBLIC',
      likesCount: 15,
      commentsCount: 5,
      viewsCount: 200,
      playCount: 180,
      publishedAt: new Date(now.getTime() - r * 3600000),
    });
    createdReelIds.push(reel._id.toString());
  }

  for (let p = 1; p <= 5; p++) {
    const post = await Content.create({
      authorId: celebrityUser._id,
      contentType: 'POST',
      caption: `Celebrity Lifestyle Post #${p} ✨ Living the dream`,
      mediaItems: [
        {
          mediaType: 'IMAGE',
          originalUrl: 'https://ik.imagekit.io/zjd5xircoy/posts/sample_image.jpg',
          thumbnail: { url: 'https://ik.imagekit.io/zjd5xircoy/posts/sample_image.jpg' },
          variants: [{ name: 'original', url: 'https://ik.imagekit.io/zjd5xircoy/posts/sample_image.jpg' }],
          width: 1080,
          height: 1350,
          aspectRatio: 0.8,
        },
      ],
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      audience: 'PUBLIC',
      likesCount: 42,
      commentsCount: 12,
      publishedAt: new Date(now.getTime() - p * 7200000),
    });
    createdPostIds.push(post._id.toString());
  }

  // Active Story for Celebrity
  for (let s = 1; s <= 3; s++) {
    const story = await Content.create({
      authorId: celebrityUser._id,
      contentType: 'STORY',
      caption: `Celebrity Daily Story #${s}`,
      mediaItems: [
        {
          mediaType: 'IMAGE',
          originalUrl: 'https://ik.imagekit.io/zjd5xircoy/stories/sample_image.jpg',
          thumbnail: { url: 'https://ik.imagekit.io/zjd5xircoy/stories/sample_image.jpg' },
          width: 1080,
          height: 1920,
          aspectRatio: 0.5625,
        },
      ],
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      audience: 'PUBLIC',
      expiresAt: new Date(now.getTime() + 20 * 3600000), // Active for 20 more hours
      publishedAt: new Date(now.getTime() - s * 1800000),
    });
    createdStoryIds.push(story._id.toString());
  }

  // Seed some posts for test users
  for (let i = 0; i < 10; i++) {
    const userObj = regularUsers[i];
    const userPost = await Content.create({
      authorId: new mongoose.Types.ObjectId(userObj.id),
      contentType: 'POST',
      caption: `User ${i} sunset moment 🌅`,
      mediaItems: [
        {
          mediaType: 'IMAGE',
          originalUrl: 'https://ik.imagekit.io/zjd5xircoy/posts/sample_image.jpg',
          thumbnail: { url: 'https://ik.imagekit.io/zjd5xircoy/posts/sample_image.jpg' },
          variants: [{ name: 'original', url: 'https://ik.imagekit.io/zjd5xircoy/posts/sample_image.jpg' }],
          width: 1080,
          height: 1080,
          aspectRatio: 1.0,
        },
      ],
      status: 'PUBLISHED',
      moderationStatus: 'APPROVED',
      audience: 'PUBLIC',
      publishedAt: new Date(now.getTime() - i * 1800000),
    });
    createdPostIds.push(userPost._id.toString());
  }

  const outputPayload = {
    celebrity: {
      id: celebrityUser._id.toString(),
      email: celebrityUser.email,
      token: celebrityToken,
    },
    users: regularUsers,
    reelIds: createdReelIds,
    postIds: createdPostIds,
    storyIds: createdStoryIds,
    targetUserIds: [celebrityUser._id.toString(), ...regularUsers.slice(0, 10).map((u) => u.id)],
  };

  const outputPath = path.join(__dirname, 'users.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputPayload, null, 2));
  console.log(`[SEED SUCCESS] Created users.json with ${regularUsers.length} users, 1 celebrity, ${createdReelIds.length} reels, ${createdPostIds.length} posts, ${createdStoryIds.length} stories.`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
