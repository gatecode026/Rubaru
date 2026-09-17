require('dns').setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Session = mongoose.model('PaidCommunicationSession', new mongoose.Schema({}, { strict: false }));
  
  const uid = new mongoose.Types.ObjectId('6aaa25f2821158cddf638188');
  const sessions = await Session.find({
    $or: [
      { caller: uid },
      { receiver: uid },
      { callerId: uid },
      { receiverId: uid },
      { initiatorId: uid }
    ]
  }).sort({ createdAt: -1 }).limit(10);
  
  console.log('Recent sessions count:', sessions.length);
  sessions.forEach(s => {
    console.log({
      id: s.sessionId || s.callId,
      status: s.status,
      caller: s.caller || s.callerId,
      receiver: s.receiver || s.receiverId,
      createdAt: s.createdAt,
      endedAt: s.endedAt
    });
  });
  
  await mongoose.disconnect();
}
check().catch(console.error);
