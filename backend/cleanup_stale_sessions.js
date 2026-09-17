require('dns').setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function clean() {
  await mongoose.connect(process.env.MONGO_URI);
  const Session = mongoose.model('PaidCommunicationSession', new mongoose.Schema({}, { strict: false }));
  
  // Also clean up stale MESSAGE sessions for our test users if older than 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const res = await Session.updateMany(
    {
      status: { $in: ['PENDING', 'ACCEPTED', 'CONNECTING', 'REQUESTED', 'RINGING', 'ACTIVE'] },
      createdAt: { $lt: tenMinutesAgo }
    },
    {
      $set: {
        status: 'ENDED',
        endedAt: new Date(),
        endReason: 'STALE_CALL_CLEANUP'
      }
    }
  );
  console.log('Cleaned up stale sessions:', res);
  await mongoose.disconnect();
}
clean().catch(console.error);
