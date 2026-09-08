const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e){}
require('dotenv').config();
const mongoose = require('mongoose');

async function cleanAllDummyData() {
  console.log('--- CONNECTING TO MONGODB ---');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB successfully.');

  const db = mongoose.connection.db;

  // Active user ID (Raju Mistri)
  const realUserId = new mongoose.Types.ObjectId('6a9a5e9443a7289c6e5d16e0');

  console.log('\n--- PURGING DUMMY DATA ---');

  // 1. Users: remove all dummy/test users, keeping real user
  const userResult = await db.collection('users').deleteMany({
    _id: { $ne: realUserId }
  });
  console.log(`Deleted ${userResult.deletedCount} dummy users.`);

  // 2. Profiles: remove all profiles not belonging to real user
  const profileResult = await db.collection('profiles').deleteMany({
    user: { $ne: realUserId }
  });
  console.log(`Deleted ${profileResult.deletedCount} dummy profiles.`);

  // 3. DatingProfiles: remove all dummy dating profiles
  const datingProfilesRes = await db.collection('datingprofiles').deleteMany({
    $and: [
      { userId: { $ne: realUserId } },
      { user: { $ne: realUserId } }
    ]
  });
  console.log(`Deleted ${datingProfilesRes.deletedCount} dummy dating profiles.`);

  // 4. Contents: keep only real contents belonging to real user
  const contentResult = await db.collection('contents').deleteMany({
    authorId: { $ne: realUserId }
  });
  console.log(`Deleted ${contentResult.deletedCount} dummy contents.`);

  // 5. MediaAssets: keep only media assets belonging to real user
  const mediaResult = await db.collection('mediaassets').deleteMany({
    ownerId: { $ne: realUserId }
  });
  console.log(`Deleted ${mediaResult.deletedCount} dummy media assets.`);

  // 6. UserLocations
  const locResult = await db.collection('userlocations').deleteMany({
    $and: [
      { userId: { $ne: realUserId } },
      { user: { $ne: realUserId } }
    ]
  });
  console.log(`Deleted ${locResult.deletedCount} dummy user locations.`);

  // 7. DatingPreferences
  const prefResult = await db.collection('datingpreferences').deleteMany({
    userId: { $ne: realUserId }
  });
  console.log(`Deleted ${prefResult.deletedCount} dummy dating preferences.`);

  // 8. Wallets & WalletLedgers
  const walletRes = await db.collection('wallets').deleteMany({
    userId: { $ne: realUserId }
  });
  const ledgerRes = await db.collection('walletledgers').deleteMany({});
  console.log(`Deleted ${walletRes.deletedCount} dummy wallets and ${ledgerRes.deletedCount} wallet ledgers.`);

  // 9. Conversations, Members, Messages, Reactions
  const convRes = await db.collection('conversations').deleteMany({});
  const memberRes = await db.collection('conversationmembers').deleteMany({});
  const msgRes = await db.collection('messages').deleteMany({});
  const reactionRes = await db.collection('messagereactions').deleteMany({});
  console.log(`Deleted ${convRes.deletedCount} dummy conversations, ${memberRes.deletedCount} members, ${msgRes.deletedCount} messages, ${reactionRes.deletedCount} reactions.`);

  // 10. Matches & DatingInteractions
  const matchRes = await db.collection('matches').deleteMany({});
  const interactRes = await db.collection('datinginteractions').deleteMany({});
  console.log(`Deleted ${matchRes.deletedCount} dummy matches, ${interactRes.deletedCount} dating interactions.`);

  // 11. FeedBatches & RecommendationBatches
  const feedBatchRes = await db.collection('feedbatches').deleteMany({});
  const recBatchRes = await db.collection('recommendationbatches').deleteMany({});
  console.log(`Deleted ${feedBatchRes.deletedCount} feed batches and ${recBatchRes.deletedCount} recommendation batches.`);

  // 12. Impressions & Playback Events
  const ciRes = await db.collection('contentimpressions').deleteMany({});
  const piRes = await db.collection('profileimpressions').deleteMany({});
  const pbRes = await db.collection('reelplaybackevents').deleteMany({});
  const svRes = await db.collection('storyviews').deleteMany({});
  const seRes = await db.collection('shareevents').deleteMany({});
  console.log(`Deleted ${ciRes.deletedCount} content impressions, ${piRes.deletedCount} profile impressions, ${pbRes.deletedCount} playback events, ${svRes.deletedCount} story views, ${seRes.deletedCount} share events.`);

  // 13. Blocks, Reports, Moderation
  const blockRes = await db.collection('blocks').deleteMany({});
  const repRes = await db.collection('reports').deleteMany({});
  const repSupRes = await db.collection('reportersuppressions').deleteMany({});
  const modCaseRes = await db.collection('moderationcases').deleteMany({});
  const modAuditRes = await db.collection('moderationauditlogs').deleteMany({});
  const modSnapRes = await db.collection('moderationevidencesnapshots').deleteMany({});
  console.log(`Deleted ${blockRes.deletedCount} blocks, ${repRes.deletedCount} reports, ${repSupRes.deletedCount} suppressions, ${modCaseRes.deletedCount} cases, ${modAuditRes.deletedCount} audit logs, ${modSnapRes.deletedCount} snapshots.`);

  // 14. Follows, Notifications, UploadSessions, OutboxEvents
  const followRes = await db.collection('followrelationships').deleteMany({});
  const notifRes = await db.collection('notifications').deleteMany({});
  const notifPrefRes = await db.collection('notificationpreferences').deleteMany({
    userId: { $ne: realUserId }
  });
  const devRes = await db.collection('devices').deleteMany({
    userId: { $ne: realUserId }
  });
  const uploadSessRes = await db.collection('uploadsessions').deleteMany({
    ownerId: { $ne: realUserId }
  });
  const outboxRes = await db.collection('outboxevents').deleteMany({});
  console.log(`Deleted ${followRes.deletedCount} follow relationships, ${notifRes.deletedCount} notifications, ${notifPrefRes.deletedCount} notification prefs, ${devRes.deletedCount} devices, ${uploadSessRes.deletedCount} upload sessions, ${outboxRes.deletedCount} outbox events.`);

  // 15. Polls & Votes
  const pollRes = await db.collection('polls').deleteMany({});
  const voteRes = await db.collection('pollvotes').deleteMany({});
  const commentRes = await db.collection('comments').deleteMany({});
  const commentLikeRes = await db.collection('commentlikes').deleteMany({});
  const contentLikeRes = await db.collection('contentlikes').deleteMany({});
  const saveRes = await db.collection('saves').deleteMany({});
  console.log(`Deleted ${pollRes.deletedCount} polls, ${voteRes.deletedCount} poll votes, ${commentRes.deletedCount} comments, ${commentLikeRes.deletedCount} comment likes, ${contentLikeRes.deletedCount} content likes, ${saveRes.deletedCount} saves.`);

  // 16. Paid Communication
  const paidConfRes = await db.collection('paidcommunicationconfigs').deleteMany({});
  const paidSessRes = await db.collection('paidcommunicationsessions').deleteMany({});
  const userEntRes = await db.collection('userentitlements').deleteMany({});
  console.log(`Deleted ${paidConfRes.deletedCount} paid configs, ${paidSessRes.deletedCount} paid sessions, ${userEntRes.deletedCount} user entitlements.`);

  console.log('\n--- VERIFYING REMAINING DATA IN MONGO ---');
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    if (count > 0) {
      console.log(`  ${col.name}: ${count}`);
    }
  }

  console.log('\n✅ ALL DUMMY DATA HAS BEEN COMPLETELY REMOVED FROM MONGODB!');
  process.exit(0);
}

cleanAllDummyData().catch(e => {
  console.error('Error cleaning dummy data:', e);
  process.exit(1);
});
