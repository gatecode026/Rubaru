require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const mongoose = require('mongoose');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');
const callRoutes = require('./routes/callRoutes');
const notifRoutes = require('./routes/notifRoutes');

async function runTests() {
  console.log('====================================================');
  console.log('   RUBARU BACKEND ENDPOINTS INTEGRATION TEST SUITE   ');
  console.log('====================================================\n');

  // Connect to DB
  await connectDB();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profileRoutes);
  app.use('/api/reels', reelRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/notifications', notifRoutes);

  app.get('/', (req, res) => res.json({ status: 'ok', message: 'Rubaru API Running' }));

  const TEST_PORT = 5099;
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[TEST SERVER] Started temporary test server on port ${TEST_PORT}\n`);

  const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
  let passedCount = 0;
  let failedCount = 0;

  async function testEndpoint(name, url, options = {}) {
    const start = Date.now();
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      const duration = Date.now() - start;
      const isSuccess = res.status >= 200 && res.status < 300;

      if (isSuccess) {
        console.log(`✅ [PASS] ${name} (${res.status}) - ${duration}ms`);
        passedCount++;
        return { success: true, status: res.status, data };
      } else {
        console.error(`❌ [FAIL] ${name} (${res.status}) - ${duration}ms - Message: ${data.message || JSON.stringify(data)}`);
        failedCount++;
        return { success: false, status: res.status, data };
      }
    } catch (err) {
      console.error(`❌ [ERROR] ${name} - Exception: ${err.message}`);
      failedCount++;
      return { success: false, error: err.message };
    }
  }

  try {
    // 1. Health Check
    await testEndpoint('Health Check GET /', `${BASE_URL}/`);

    // 2. Auth: Register
    const uniqueEmail = `user_${Date.now()}@rubaru.app`;
    const regRes = await testEndpoint(
      'Auth Register POST /api/auth/register-email',
      `${BASE_URL}/api/auth/register-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail, password: 'StrongPassword123!' }),
      }
    );

    // 3. Auth: Verify OTP
    const verifyRes = await testEndpoint(
      'Auth Verify OTP POST /api/auth/verify-otp',
      `${BASE_URL}/api/auth/verify-otp`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail, otpCode: '1234' }),
      }
    );

    const token = verifyRes.data ? verifyRes.data.token : null;
    const authHeaders = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};

    // 4. Auth: Login
    await testEndpoint(
      'Auth Login POST /api/auth/login',
      `${BASE_URL}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uniqueEmail, password: 'StrongPassword123!' }),
      }
    );

    // 5. Auth: Profile Setup
    if (token) {
      await testEndpoint(
        'Auth Profile Setup POST /api/auth/profile-setup',
        `${BASE_URL}/api/auth/profile-setup`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            displayName: 'Aarav Sharma',
            dateOfBirth: '2000-01-15',
            gender: 'Male',
            interests: ['Travel', 'Photography', 'Music', 'Coffee'],
            bio: 'Exploring the world, one coffee at a time!',
            locationName: 'Jaipur, Rajasthan',
            latitude: 26.9124,
            longitude: 75.7873,
          }),
        }
      );

      // 6. Profile: Get Me
      await testEndpoint('Profiles GET /api/profiles/me', `${BASE_URL}/api/profiles/me`, {
        headers: authHeaders,
      });

      // 7. Profile: Search
      await testEndpoint('Profiles Search GET /api/profiles/search?q=Aarav', `${BASE_URL}/api/profiles/search?q=Aarav`, {
        headers: authHeaders,
      });

      // 8. Profile: Nearby Discover
      await testEndpoint('Profiles Nearby GET /api/profiles/discover/nearby', `${BASE_URL}/api/profiles/discover/nearby`, {
        headers: authHeaders,
      });

      // 9. Profile: All
      await testEndpoint('Profiles All GET /api/profiles/all', `${BASE_URL}/api/profiles/all`, {
        headers: authHeaders,
      });

      // 10. Reels: List
      await testEndpoint('Reels GET /api/reels', `${BASE_URL}/api/reels`, {
        headers: authHeaders,
      });

      // 11. Calls: Get Logs
      await testEndpoint('Calls Logs GET /api/calls/logs', `${BASE_URL}/api/calls/logs`, {
        headers: authHeaders,
      });

      // 12. Notifications: Get List
      await testEndpoint('Notifications GET /api/notifications', `${BASE_URL}/api/notifications`, {
        headers: authHeaders,
      });

      // 13. Chats: Get List
      await testEndpoint('Chats GET /api/chats', `${BASE_URL}/api/chats`, {
        headers: authHeaders,
      });
    }

    console.log('\n====================================================');
    console.log(`RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('====================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
    console.log('[TEST SUITE] Database disconnected & test server shutdown complete.');
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});
