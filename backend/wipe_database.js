const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (e) {}
require('dotenv').config();
const mongoose = require('mongoose');

async function wipeDatabase() {
  console.log('--- CONNECTING TO MONGODB ---');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`Connected to database: '${db.databaseName}'`);

  console.log('\n--- FETCHING ALL COLLECTIONS ---');
  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections.`);

  console.log('\n--- WIPING ALL COLLECTIONS ---');
  for (const col of collections) {
    // Avoid deleting system collections
    if (col.name.startsWith('system.')) continue;
    const countBefore = await db.collection(col.name).countDocuments();
    await db.collection(col.name).deleteMany({});
    console.log(`✅ Cleared collection '${col.name}' (deleted ${countBefore} documents)`);
  }

  console.log('\n--- VERIFYING CLEAN STATE ---');
  let remainingCount = 0;
  for (const col of collections) {
    if (col.name.startsWith('system.')) continue;
    const count = await db.collection(col.name).countDocuments();
    if (count > 0) {
      console.warn(`⚠️ Warning: ${col.name} still has ${count} documents`);
      remainingCount += count;
    }
  }

  if (remainingCount === 0) {
    console.log('\n🎉 SUCCESS: All collections are 100% completely clean and empty!');
  } else {
    console.warn(`\n⚠️ Finished with ${remainingCount} remaining documents.`);
  }

  process.exit(0);
}

wipeDatabase().catch((err) => {
  console.error('Error wiping database:', err);
  process.exit(1);
});
