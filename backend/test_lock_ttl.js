const callLockService = require('./services/callLockService');
const { initRedis } = require('./config/redis');

async function test() {
  await initRedis();
  const callerId = 'user_1';
  const receiverId = 'user_2';
  const callId = 'call_test_1';

  // Acquire with 1s ttl
  const r1 = await callLockService.acquireDualUserCallLock(callerId, receiverId, callId, 1);
  console.log('Acquired 1:', r1);

  const client = callLockService._getClient();
  const keyA = callLockService.getUserLockKey(callerId);
  console.log('TTL of keyA in redis:', await client.ttl(keyA));

  // Try acquiring with another call immediately
  const r2 = await callLockService.acquireDualUserCallLock(callerId, receiverId, 'call_test_2', 1);
  console.log('Immediate acquire another call:', r2);

  // Wait 1.5s
  console.log('Waiting 1.5s...');
  await new Promise(r => setTimeout(r, 1500));

  console.log('TTL of keyA after 1.5s:', await client.ttl(keyA));
  console.log('Value of keyA after 1.5s:', await client.get(keyA));

  const r3 = await callLockService.acquireDualUserCallLock(callerId, receiverId, 'call_test_2', 1);
  console.log('Acquire after TTL expired:', r3);

  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
