const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

require('dotenv').config();
const assert = require('assert');
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { io: ioClient } = require('socket.io-client');

const { connectSafeTestDB } = require('../config/testDbGuard');
const { initRedis, closeRedis, getRedisHealth, getRedisClient, getPublisherClient, getSubscriberClient } = require('../config/redis');

// Models
const User = require('../models/User');
const Profile = require('../models/Profile');
const Match = require('../models/Match');
const Conversation = require('../models/Conversation');

let totalTests = 0;
let passedTests = 0;
let blockedTests = 0;

async function runTest(name, fn) {
  totalTests++;
  try {
    const result = await fn();
    if (result && result.blocked) {
      console.log(`  ⚠️  [BLOCKED] ${name} (${result.reason})`);
      blockedTests++;
    } else {
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    }
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function createTestUserWithToken() {
  const userId = new mongoose.Types.ObjectId();
  const phone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;

  const user = await User.create({
    _id: userId,
    phone,
    password: 'Password@123',
    role: 'USER',
    isVerified: true,
  });

  await Profile.create({
    userId: user._id,
    user: user._id,
    name: `User_${userId.toString().slice(-4)}`,
    displayName: `User_${userId.toString().slice(-4)}`,
    dateOfBirth: new Date('1998-05-15'),
    gender: 'Female',
    bio: 'Test user for multi-instance socket routing',
  });

  const token = jwt.sign(
    { id: user._id.toString(), phone: user.phone, role: user.role },
    process.env.JWT_SECRET || 'test_jwt_secret',
    { expiresIn: '1h' }
  );

  return { user, token };
}

const socketio = require('socket.io');
const socketHandler = require('../socket/socketHandler');

function createServerInstance(port) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ port, redis: getRedisHealth() });
  });

  const server = http.createServer(app);
  const io = socketio(server, { cors: { origin: '*' } });
  socketHandler(io);

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({ server, io, port });
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('   PC-13: MULTI-INSTANCE REDIS & CROSS-PROCESS SOCKET TESTS     ');
  console.log('================================================================\n');

  const { dbName, maskedHost } = await connectSafeTestDB();
  console.log(`[TEST RUNNER] Database: '${dbName}' on ${maskedHost}`);

  // Test real Redis connection attempt
  let realRedisAvailable = false;
  try {
    const redisResult = await initRedis({ connectTimeout: 1500, maxRetriesPerRequest: 0 });
    realRedisAvailable = !redisResult.isMock;
  } catch (err) {
    console.warn('[TEST RUNNER] Real Redis server not reachable on localhost:6379, falling back to mock driver.');
    await initRedis({ mock: true });
    realRedisAvailable = false;
  }

  const PORT_1 = 5091;
  const PORT_2 = 5092;

  let inst1, inst2;

  try {
    inst1 = await createServerInstance(PORT_1);
    inst2 = await createServerInstance(PORT_2);
    console.log(`[INSTANCES] Instance 1 listening on port ${PORT_1}, Instance 2 on port ${PORT_2}`);

    const userA = await createTestUserWithToken();
    const userB = await createTestUserWithToken();

    // -------------------------------------------------------------------------
    // TEST 1: Real Redis Readiness & Health
    // -------------------------------------------------------------------------
    await runTest('Redis infrastructure connection and health status', async () => {
      const health = getRedisHealth();
      assert.ok(health.connected, 'Redis client must report connected');
      if (!realRedisAvailable) {
        return {
          blocked: true,
          reason: 'Local Redis Server on localhost:6379 unreachable in host environment; mock driver active for test',
        };
      }
      assert.strictEqual(health.distributedReady, true);
    });

    // -------------------------------------------------------------------------
    // TEST 2: Cross-Instance Socket Connection
    // -------------------------------------------------------------------------
    await runTest('Dual-Instance Socket.io clients connect to distinct ports', async () => {
      const socketA = ioClient(`http://127.0.0.1:${PORT_1}`, {
        auth: { token: userA.token },
        transports: ['websocket'],
      });

      const socketB = ioClient(`http://127.0.0.1:${PORT_2}`, {
        auth: { token: userB.token },
        transports: ['websocket'],
      });

      await new Promise((resolve, reject) => {
        let connectedA = false;
        let connectedB = false;

        const check = () => {
          if (connectedA && connectedB) resolve();
        };

        socketA.on('connect', () => {
          connectedA = true;
          check();
        });

        socketB.on('connect', () => {
          connectedB = true;
          check();
        });

        setTimeout(() => reject(new Error('Socket connection timeout')), 3000);
      });

      assert.ok(socketA.connected, 'User A connected to Instance 1');
      assert.ok(socketB.connected, 'User B connected to Instance 2');

      socketA.disconnect();
      socketB.disconnect();
    });

    // -------------------------------------------------------------------------
    // TEST 3: Distributed WebRTC Call Signaling Channel
    // -------------------------------------------------------------------------
    await runTest('Distributed WebRTC Call Signaling relay across Redis channels', async () => {
      const pub = getPublisherClient();
      const sub = getSubscriberClient();

      let receivedSignal = null;
      const channel = `rubaru:signaling:${userB.user._id.toString()}`;

      await sub.subscribe(channel);
      sub.on('message', (ch, msg) => {
        if (ch === channel) {
          receivedSignal = JSON.parse(msg);
        }
      });

      const signalPayload = {
        callSessionId: `call_session_${uuidv4()}`,
        senderId: userA.user._id.toString(),
        targetUserId: userB.user._id.toString(),
        type: 'OFFER',
        sdp: 'v=0\r\no=test 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n',
      };

      await pub.publish(channel, JSON.stringify(signalPayload));
      await new Promise((r) => setTimeout(r, 100));

      assert.ok(receivedSignal, 'Signal payload received across Redis channel');
      assert.strictEqual(receivedSignal.type, 'OFFER');
      assert.strictEqual(receivedSignal.senderId, userA.user._id.toString());
    });

    console.log('\n================================================================');
    console.log(`  MULTI-INSTANCE SUMMARY: ${passedTests} PASSED, ${blockedTests} BLOCKED (0 FAILED)`);
    console.log('================================================================\n');

  } finally {
    if (inst1?.server) inst1.server.close();
    if (inst2?.server) inst2.server.close();
    await closeRedis();
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('\nMulti-instance test runner terminated with error:', err);
  process.exit(1);
});
