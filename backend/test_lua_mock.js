const RedisMock = require('ioredis-mock');

async function testPrefix() {
  const client = new RedisMock();
  const keyA = 'call:lock:user:6aaa25f2821158cddf638188';
  const keyB = 'call:lock:user:6aaa272f821158cddf6384a9';
  const callId = 'call-1';
  const ttlSeconds = 60;

  const luaScript = `
    local valA = redis.call('GET', KEYS[1])
    local valB = redis.call('GET', KEYS[2])
    local callId = ARGV[1]
    local ttl = tonumber(ARGV[2])

    if (valA and valA ~= callId) then
      return {0, KEYS[1], valA}
    end
    if (valB and valB ~= callId) then
      return {0, KEYS[2], valB}
    end

    redis.call('SET', KEYS[1], callId, 'EX', ttl)
    redis.call('SET', KEYS[2], callId, 'EX', ttl)
    return {1, 'OK', ''}
  `;

  const res1 = await client.eval(luaScript, 2, keyA, keyB, callId, ttlSeconds);
  console.log('Eval 1:', res1);

  // Now simulate call:initiate with another callId (like when user tapped call again)
  const res2 = await client.eval(luaScript, 2, keyA, keyB, 'call-2', ttlSeconds);
  console.log('Eval 2 (within 60s):', res2);

  const busyUserId = res2[1].replace(/^.*call:lock:user:/, '');
  console.log('busyUserId:', busyUserId);

  process.exit(0);
}

testPrefix().catch(e => {
  console.error(e);
  process.exit(1);
});
