require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const dns = require('dns');

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // Ignore DNS set errors
}

async function purgeDummyData() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('[PURGE] Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  console.log(`[PURGE] Connected to database: ${mongoose.connection.name}`);

  // 1. Identify dummy user accounts
  const dummyUsers = await db.collection('users').find({
    $or: [
      { email: { $regex: /loadtest_/i } },
      { email: { $regex: /@test\.rubaru\.com/i } },
      { email: { $regex: /test_.*@example\.com/i } },
      { email: 'test@rubaru.com' },
      { phone: '9876543210' },
    ],
  }).toArray();

  console.log(`[PURGE] Found ${dummyUsers.length} dummy/seed user accounts.`);

  // Safety check: ensure real accounts are NOT marked for deletion
  const protectedPhones = ['+917340445907', '7340445907'];
  const protectedEmails = ['rahul@gmail.com'];

  for (const u of dummyUsers) {
    if (protectedPhones.includes(u.phone) || protectedEmails.includes(u.email)) {
      console.error(`FATAL SAFETY CHECK FAILED: Real user ${u.email || u.phone} is in dummy list! Aborting.`);
      process.exit(1);
    }
  }

  const dummyObjectIds = dummyUsers.map((u) => u._id);
  const dummyStringIds = dummyObjectIds.map((id) => id.toString());

  console.log('[PURGE] Verified safety check: 0 real users affected.');

  // 2. Identify dummy content
  const dummyContents = await db.collection('contents').find({
    authorId: { $in: dummyObjectIds },
  }).toArray();
  const dummyContentIds = dummyContents.map((c) => c._id);
  const dummyContentStringIds = dummyContentIds.map((id) => id.toString());
  console.log(`[PURGE] Found ${dummyContentIds.length} dummy content items (posts, reels, stories).`);

  // 3. Identify dummy conversations
  const dummyConvos = await db.collection('conversations').find({
    participants: { $in: dummyObjectIds },
  }).toArray();
  const dummyConvoIds = dummyConvos.map((c) => c._id);

  // 4. Execute targeted deletions across collections
  const results = {};

  // Users, Profiles, DatingProfiles
  results.users = (await db.collection('users').deleteMany({ _id: { $in: dummyObjectIds } })).deletedCount;
  results.profiles = (await db.collection('profiles').deleteMany({ user: { $in: dummyObjectIds } })).deletedCount;
  results.datingprofiles = (await db.collection('datingprofiles').deleteMany({ user: { $in: dummyObjectIds } })).deletedCount;

  // Contents & MediaAssets
  results.contents = (await db.collection('contents').deleteMany({ _id: { $in: dummyContentIds } })).deletedCount;
  results.mediaassets = (await db.collection('mediaassets').deleteMany({
    $or: [
      { ownerId: { $in: dummyObjectIds } },
      { contentId: { $in: dummyContentIds } },
    ],
  })).deletedCount;

  // Social interactions
  results.followrelationships = (await db.collection('followrelationships').deleteMany({
    $or: [
      { follower: { $in: dummyObjectIds } },
      { following: { $in: dummyObjectIds } },
      { followerId: { $in: dummyObjectIds } },
      { followingId: { $in: dummyObjectIds } },
    ],
  })).deletedCount;

  results.contentlikes = (await db.collection('contentlikes').deleteMany({
    $or: [
      { userId: { $in: dummyObjectIds } },
      { contentId: { $in: dummyContentIds } },
    ],
  })).deletedCount;

  results.comments = (await db.collection('comments').deleteMany({
    $or: [
      { authorId: { $in: dummyObjectIds } },
      { contentId: { $in: dummyContentIds } },
    ],
  })).deletedCount;

  results.storyviews = (await db.collection('storyviews').deleteMany({
    $or: [
      { viewerId: { $in: dummyObjectIds } },
      { storyId: { $in: dummyContentIds } },
    ],
  })).deletedCount;

  results.reelplaybackevents = (await db.collection('reelplaybackevents').deleteMany({
    $or: [
      { userId: { $in: dummyObjectIds } },
      { reelId: { $in: dummyContentIds } },
    ],
  })).deletedCount;

  // Messaging
  results.messages = (await db.collection('messages').deleteMany({
    $or: [
      { senderId: { $in: dummyObjectIds } },
      { conversationId: { $in: dummyConvoIds } },
    ],
  })).deletedCount;

  results.conversationmembers = (await db.collection('conversationmembers').deleteMany({
    $or: [
      { userId: { $in: dummyObjectIds } },
      { conversationId: { $in: dummyConvoIds } },
    ],
  })).deletedCount;

  results.conversations = (await db.collection('conversations').deleteMany({
    _id: { $in: dummyConvoIds },
  })).deletedCount;

  // Wallets, Sessions & Runaway Billing Loop Ledgers
  results.wallets = (await db.collection('wallets').deleteMany({
    userId: { $in: dummyObjectIds },
  })).deletedCount;

  // Known dummy test IDs including previously deleted test users
  const allKnownDummyIds = [
    ...dummyObjectIds,
    new mongoose.Types.ObjectId('6aa23ac569d9a01ba18076d0'), // test@rubaru.com
    new mongoose.Types.ObjectId('6aa38a956f248a051de4f79d'), // test_...
  ];

  results.paidcommunicationsessions = (await db.collection('paidcommunicationsessions').deleteMany({
    $or: [
      { initiatorId: { $in: allKnownDummyIds } },
      { targetUserId: { $in: allKnownDummyIds } },
      { peerUserId: { $in: allKnownDummyIds } },
    ],
  })).deletedCount;

  results.walletledgers = (await db.collection('walletledgers').deleteMany({
    $or: [
      { userId: { $in: allKnownDummyIds } },
      { counterpartyId: { $in: allKnownDummyIds } },
      { counterpartyUserId: { $in: allKnownDummyIds } },
    ],
  })).deletedCount;

  // Reset real user wallet to clean baseline (500 coins)
  const shubhId = new mongoose.Types.ObjectId('6aa23a1469d9a01ba180757f');
  await db.collection('wallets').updateOne(
    { userId: shubhId },
    {
      $set: {
        availableBalance: 500,
        lockedBalance: 0,
        lifetimeEarned: 500,
        lifetimeSpent: 0,
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    }
  );

  // 5. Clean orphaned and test paid communication sessions
  const realUsers = await db.collection('users').find({}).toArray();
  const realUserIds = realUsers.map((u) => u._id);
  const realUserStringIds = realUserIds.map((id) => id.toString());

  const realContents = await db.collection('contents').find({}).toArray();
  const realContentIds = realContents.map((c) => c._id);
  const realContentStringIds = realContentIds.map((id) => id.toString());

  results.paidcommunicationsessions += (await db.collection('paidcommunicationsessions').deleteMany({
    $or: [
      { targetUserId: { $nin: realUserIds } },
      { targetUserId: { $exists: false } },
      { targetUserId: null },
      { initiatorId: { $nin: realUserIds } },
    ],
  })).deletedCount;

  // Notifications: remove any notification whose recipient or sender is not a real user
  results.notifications = (await db.collection('notifications').deleteMany({
    $or: [
      { recipientId: { $nin: realUserIds } },
      { recipientId: { $exists: false } },
      { recipientId: null },
    ],
  })).deletedCount;

  // Transient caches: FeedBatches & OutboxEvents
  results.feedbatches = (await db.collection('feedbatches').deleteMany({})).deletedCount;

  // Keep only outbox events directly tied to real entities
  const validAggregateIds = [...realUserStringIds, ...realContentStringIds];
  results.outboxevents = (await db.collection('outboxevents').deleteMany({
    $and: [
      { aggregateId: { $nin: validAggregateIds } },
      { 'payload.authorId': { $nin: realUserIds } },
    ],
  })).deletedCount;

  console.log('\n======================================================');
  console.log('✅ DATABASE PURGE COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.table(results);

  // Print remaining users & contents for verification
  const remainingUsers = await db.collection('users').find({}, { projection: { email: 1, phone: 1, accountStatus: 1 } }).toArray();
  console.log('\nRemaining Users in Database:');
  console.table(remainingUsers);

  const remainingContents = await db.collection('contents').find({}, { projection: { authorId: 1, contentType: 1, caption: 1 } }).toArray();
  console.log('\nRemaining Contents in Database:');
  console.table(remainingContents);

  await mongoose.disconnect();
  console.log('\n[PURGE] Disconnected from MongoDB.');
}

purgeDummyData().catch((err) => {
  console.error('[PURGE ERROR]:', err);
  process.exit(1);
});
