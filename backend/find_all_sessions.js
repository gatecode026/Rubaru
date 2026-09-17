const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

const PaidCommunicationSession = require('./models/PaidCommunicationSession');

async function findAllSessions() {
  await mongoose.connect(process.env.MONGO_URI);
  const u1 = '6aaa25f2821158cddf638188';
  const u2 = '6aaa272f821158cddf6384a9';

  const sessions = await PaidCommunicationSession.find({
    $or: [
      { initiatorId: { $in: [u1, u2] } },
      { receiverId: { $in: [u1, u2] } },
      { caller: { $in: [u1, u2] } },
      { receiver: { $in: [u1, u2] } },
    ]
  }).sort({ createdAt: -1 });

  console.log('Total sessions found:', sessions.length);
  sessions.forEach(s => {
    console.log({
      id: s._id,
      sessionId: s.sessionId,
      type: s.communicationType,
      status: s.status,
      initiator: s.initiatorId,
      receiver: s.receiverId,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
      endReason: s.endReason
    });
  });

  process.exit(0);
}

findAllSessions().catch(e => {
  console.error(e);
  process.exit(1);
});
