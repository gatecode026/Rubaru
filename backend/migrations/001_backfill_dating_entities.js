require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const DatingProfile = require('../models/DatingProfile');
const DatingPreference = require('../models/DatingPreference');
const UserLocation = require('../models/UserLocation');
const DatingInteraction = require('../models/DatingInteraction');
const Match = require('../models/Match');
const Block = require('../models/Block');
const Report = require('../models/Report');
const ProfileImpression = require('../models/ProfileImpression');
const RecommendationBatch = require('../models/RecommendationBatch');
const OutboxEvent = require('../models/OutboxEvent');
const UserEntitlement = require('../models/UserEntitlement');
const Chat = require('../models/Chat');

async function runMigration() {
  console.log('===========================================================');
  console.log('  RUBARU DATING CORE MIGRATION & BACKFILL (SAFE/IDEMPOTENT)');
  console.log('===========================================================\n');

  await connectDB();

  try {
    console.log('[MIGRATION 1/3] Syncing Schema Indexes & Constraints...');
    await Promise.all([
      User.syncIndexes(),
      Profile.syncIndexes(),
      DatingProfile.syncIndexes(),
      DatingPreference.syncIndexes(),
      UserLocation.syncIndexes(),
      DatingInteraction.syncIndexes(),
      Match.syncIndexes(),
      Block.syncIndexes(),
      Report.syncIndexes(),
      ProfileImpression.syncIndexes(),
      RecommendationBatch.syncIndexes(),
      OutboxEvent.syncIndexes(),
      UserEntitlement.syncIndexes(),
      Chat.syncIndexes(),
    ]);
    console.log('✅ All indexes and unique constraints successfully synchronized.\n');

    console.log('[MIGRATION 2/3] Checking Historical Users & Profiles for Backfill...');
    const users = await User.find({});
    console.log(`Found ${users.length} existing users in database.`);

    let backfilledCount = 0;

    for (const user of users) {
      const profile = await Profile.findOne({ user: user._id });

      // 1. Calculate verified age
      let age = 21;
      let dob = new Date('2000-01-01');
      if (profile && profile.dateOfBirth) {
        dob = new Date(profile.dateOfBirth);
        const diffMs = Date.now() - dob.getTime();
        const calculatedAge = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
        if (calculatedAge >= 18 && calculatedAge <= 120) {
          age = calculatedAge;
        }
      }

      // 2. DatingProfile Backfill (if not exists)
      const existingDatingProfile = await DatingProfile.findOne({ user: user._id });
      if (!existingDatingProfile) {
        await DatingProfile.create({
          user: user._id,
          displayName: profile?.displayName || user.email?.split('@')[0] || user.phone || 'Rubaru User',
          dateOfBirth: dob,
          age,
          gender: profile?.gender || 'Other',
          bio: profile?.bio || '',
          avatarUri: profile?.avatarUri || 'https://i.pravatar.cc/150?img=60',
          photos: profile?.photos || [],
          interests: profile?.interests || [],
          isDiscoverable: true,
          completenessScore: profile ? 70 : 30,
        });
        backfilledCount++;
      }

      // 3. DatingPreference Backfill (if not exists)
      const existingPref = await DatingPreference.findOne({ user: user._id });
      if (!existingPref) {
        await DatingPreference.create({
          user: user._id,
          version: 1,
          genderPreference: ['Female', 'Male', 'Non-Binary', 'Other'],
          ageRange: { min: 18, max: 99, isDealbreaker: true },
          maxDistanceKm: 50,
          distanceDealbreaker: true,
        });
      }

      // 4. UserLocation Backfill (if not exists)
      const existingLoc = await UserLocation.findOne({ user: user._id });
      if (!existingLoc) {
        const coords = profile?.location?.coordinates || [75.7873, 26.9124];
        await UserLocation.create({
          user: user._id,
          location: {
            type: 'Point',
            coordinates: coords,
          },
          city: profile?.locationName || 'Jaipur',
        });
      }

      // 5. UserEntitlement Backfill (if not exists)
      const existingEntitlement = await UserEntitlement.findOne({ user: user._id });
      if (!existingEntitlement) {
        await UserEntitlement.create({
          user: user._id,
          dailyFreeLikesLimit: 25,
          hasUnlimitedLikes: false,
          rosesBalance: 1,
          priorityLikesBalance: 0,
          undoPassEntitlement: true,
          premiumTier: 'FREE',
        });
      }
    }

    console.log(`✅ Backfill complete. Created/Verified dating entities for ${users.length} users (${backfilledCount} newly populated).\n`);

    console.log('[MIGRATION 3/3] Validating Historical Matches for Canonical Uniqueness...');
    const existingMatches = await Match.find({});
    console.log(`Auditing ${existingMatches.length} existing match records for canonical validity...`);
    const seenPairs = new Set();
    let conflictCount = 0;

    for (const match of existingMatches) {
      if (seenPairs.has(match.canonicalPair)) {
        console.warn(`⚠️ CONFLICT DETECTED: Duplicate canonical pair found: ${match.canonicalPair}`);
        conflictCount++;
      } else {
        seenPairs.add(match.canonicalPair);
      }
    }

    if (conflictCount === 0) {
      console.log('✅ Canonical Match uniqueness validation passed with 0 conflicts.');
    } else {
      console.warn(`⚠️ Warning: ${conflictCount} duplicate match pairs detected in historical data.`);
    }

    console.log('\n===========================================================');
    console.log('  MIGRATION COMPLETED SUCCESSFULLY');
    console.log('===========================================================\n');
  } catch (err) {
    console.error('❌ MIGRATION FAILED:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = runMigration;
