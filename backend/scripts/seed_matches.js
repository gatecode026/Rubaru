const mongoose = require('mongoose');
require('dotenv').config();

async function seedMatches() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  
  const users = await db.collection('users').find({}).toArray();
  console.log(`Found ${users.length} users in database.`);
  
  const targetUsers = users.filter(u => u.email === 'rk@gmail.com' || u.phone === '+911111111111');
  console.log('Target users:', targetUsers.map(u => ({ id: u._id.toString(), email: u.email, phone: u.phone })));
  
  for (const tUser of targetUsers) {
    // Ensure wallet has 500 coins for testing
    await db.collection('wallets').updateOne(
      { userId: tUser._id },
      { $set: { userId: tUser._id, availableBalance: 500, lockedBalance: 0, status: 'ACTIVE', lifetimeEarned: 500, lifetimeSpent: 0, updatedAt: new Date() } },
      { upsert: true }
    );

    for (const other of users) {
      if (other._id.toString() === tUser._id.toString()) continue;
      
      const [u1, u2] = [tUser._id.toString(), other._id.toString()].sort();
      const canonicalPair = `${u1}:${u2}`;
      
      await db.collection('matches').updateOne(
        { canonicalPair },
        {
          $set: {
            canonicalPair,
            user1: new mongoose.Types.ObjectId(u1),
            user2: new mongoose.Types.ObjectId(u2),
            users: [new mongoose.Types.ObjectId(u1), new mongoose.Types.ObjectId(u2)],
            status: 'ACTIVE',
            initiatorInteraction: new mongoose.Types.ObjectId(),
            matchedAt: new Date(),
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
    }
  }
  
  console.log('Successfully created ACTIVE matches and funded wallets for all target users!');
  await mongoose.disconnect();
}

seedMatches();
