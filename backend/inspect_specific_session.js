const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

const PaidCommunicationSession = require('./models/PaidCommunicationSession');

async function inspectSession() {
  await mongoose.connect(process.env.MONGO_URI);
  const s = await PaidCommunicationSession.findOne({ sessionId: '45f6e631-a6ae-4c42-8abc-cdbcc83c535a' });
  console.log(JSON.stringify(s, null, 2));
  process.exit(0);
}

inspectSession().catch(e => {
  console.error(e);
  process.exit(1);
});
