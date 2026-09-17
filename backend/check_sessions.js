const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

const PaidCommunicationSession = require('./models/PaidCommunicationSession');

async function checkSessions() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const userId = '6aaa25f2821158cddf638188';
  const sessions = await PaidCommunicationSession.find({
    $or: [{ initiatorId: userId }, { receiverId: userId }],
    status: { $in: ['INITIATED', 'RINGING', 'ACTIVE', 'RECONNECTING'] }
  });

  console.log('Active/Pending sessions for user:', sessions.length);
  for (const s of sessions) {
    console.log('Session:', {
      sessionId: s.sessionId,
      status: s.status,
      initiatorId: s.initiatorId,
      receiverId: s.receiverId,
      createdAt: s.createdAt,
      endedAt: s.endedAt
    });
  }

  process.exit(0);
}

checkSessions().catch(e => {
  console.error(e);
  process.exit(1);
});
