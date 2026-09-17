const callLockService = require('./services/callLockService');
const { initRedis } = require('./config/redis');

async function test() {
  await initRedis();
  const callerId = '6aaa25f2821158cddf638188';
  const receiverId = '6aaa272f821158cddf6384a9';
  const callId = 'test-call-id-1';

  console.log('Testing acquireDualUserCallLock:');
  const result1 = await callLockService.acquireDualUserCallLock(callerId, receiverId, callId, 60);
  console.log('Result 1:', result1);

  const client = callLockService._getClient();
  const keyA = callLockService.getUserLockKey(callerId);
  const keyB = callLockService.getUserLockKey(receiverId);
  console.log('Key A in redis:', keyA, 'val:', await client.get(keyA));
  console.log('Key B in redis:', keyB, 'val:', await client.get(keyB));

  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});
