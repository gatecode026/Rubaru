require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Profile = require('./models/Profile');
const DatingProfile = require('./models/DatingProfile');

async function seedTestUser() {
  await connectDB();
  console.log('[SEED] Connected to database');

  const email = 'test@rubaru.com';
  const phone = '9876543210';
  const rawPassword = 'Password123!';

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(rawPassword, salt);

  // Check if test user already exists
  let user = await User.findOne({
    $or: [
      { email },
      { phone: '9876543210' },
      { phone: '+919876543210' },
      { phone: /9876543210$/ },
    ]
  });

  if (user) {
    user.email = email;
    user.phone = phone;
    user.password = hashedPassword;
    user.isActive = true;
    user.isProfileSetup = true;
    user.accountStatus = 'ACTIVE';
    await user.save();
    console.log('[SEED] Preserved existing test user:', user._id);
  } else {
    user = await User.create({
      email,
      phone,
      password: hashedPassword,
      isActive: true,
      isProfileSetup: true,
      accountStatus: 'ACTIVE',
      points: 500,
    });
    console.log('[SEED] Created fresh test user:', user._id);
  }

  // Upsert Social Profile (preserve user's photos if they already uploaded any)
  let profile = await Profile.findOne({ user: user._id });
  if (!profile) {
    profile = await Profile.create({
      user: user._id,
      displayName: 'Shubh Dev',
      bio: 'Welcome to Rubaru! Exploring social discovery & dating.',
      dateOfBirth: new Date('2000-01-01'),
      gender: 'Male',
      interests: ['Music', 'Art', 'Traveling', 'Yoga'],
      avatarUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
      photos: [],
    });
  }

  // Upsert Dating Profile
  let datingProfile = await DatingProfile.findOne({ user: user._id });
  if (datingProfile) {
    datingProfile.displayName = 'Shubh';
    datingProfile.age = 24;
    datingProfile.gender = 'Male';
    datingProfile.bio = 'Looking for meaningful conversations.';
    datingProfile.interests = ['Music', 'Art', 'Traveling'];
    await datingProfile.save();
  } else {
    await DatingProfile.create({
      user: user._id,
      displayName: 'Shubh',
      dateOfBirth: new Date('2000-01-01'),
      age: 24,
      gender: 'Male',
      bio: 'Looking for meaningful conversations.',
      interests: ['Music', 'Art', 'Traveling'],
    });
  }

  console.log('\n==================================================');
  console.log('🎉 TEST USER SEED SUCCESSFUL!');
  console.log('Email:    test@rubaru.com');
  console.log('Phone:    9876543210');
  console.log('Password: Password123!');
  console.log('==================================================\n');

  process.exit(0);
}

seedTestUser().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
