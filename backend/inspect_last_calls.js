const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config();

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

const PaidCommunicationSession = require('./models/PaidCommunicationSession');

async function inspectLastCalls() {
  await mongoose.connect(process.env.MONGO_URI);
  const s1 = await PaidCommunicationSession.findOne({ sessionId: '1756a4e9-5508-46a3-a4ac-c7ffc5f2306c' });
  const s2 = await PaidCommunicationSession.findOne({ sessionId: '6d447548-b465-480e-8c6a-a56ef177d868' });

  console.log('--- SESSION 1 (1756a4e9) ---');
  console.log({
    status: s1.status,
    initiatedAt: s1.initiatedAt,
    ringingAt: s1.ringingAt,
    acceptedAt: s1.acceptedAt,
    connectingAt: s1.connectingAt,
    connectedAt: s1.connectedAt,
    initiatorConnectedAt: s1.initiatorConnectedAt,
    receiverConnectedAt: s1.receiverConnectedAt,
    endedAt: s1.endedAt,
    endReason: s1.endReason,
    failureCode: s1.failureCode
  });

  console.log('--- SESSION 2 (6d447548) ---');
  console.log({
    status: s2.status,
    initiatedAt: s2.initiatedAt,
    ringingAt: s2.ringingAt,
    acceptedAt: s2.acceptedAt,
    connectingAt: s2.connectingAt,
    connectedAt: s2.connectedAt,
    initiatorConnectedAt: s2.initiatorConnectedAt,
    receiverConnectedAt: s2.receiverConnectedAt,
    endedAt: s2.endedAt,
    endReason: s2.endReason,
    failureCode: s2.failureCode
  });

  process.exit(0);
}

inspectLastCalls().catch(e => {
  console.error(e);
  process.exit(1);
});
