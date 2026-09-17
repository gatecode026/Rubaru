const dns = require('dns');
try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch(e) {}
const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Notification = require('../models/Notification');

async function cleanupDuplicates() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  const allNotifs = await Notification.find().sort({ createdAt: -1 });
  const seenSignatures = new Set();
  const toDelete = [];

  for (const n of allNotifs) {
    const senderKey = n.sender ? n.sender.toString() : 'sys';
    const sig = `${n.recipient}_${n.type}_${senderKey}_${n.message}`;
    if (seenSignatures.has(sig)) {
      toDelete.push(n._id);
    } else {
      seenSignatures.add(sig);
    }
  }

  console.log(`Total notifications in DB: ${allNotifs.length}`);
  console.log(`Duplicates identified to remove: ${toDelete.length}`);

  if (toDelete.length > 0) {
    const res = await Notification.deleteMany({ _id: { $in: toDelete } });
    console.log(`Deleted duplicates count: ${res.deletedCount}`);
  }

  const remaining = await Notification.find().sort({ createdAt: -1 });
  console.log(`Remaining clean unique notifications: ${remaining.length}`);
  remaining.forEach((n) => {
    console.log(` - [${n.type}] "${n.message}" (id: ${n._id})`);
  });

  await mongoose.disconnect();
}

cleanupDuplicates().catch(console.error);
