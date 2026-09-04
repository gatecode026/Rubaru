require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const socketHandler = require('./socket/socketHandler');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reelRoutes = require('./routes/reelRoutes');
const chatRoutes = require('./routes/chatRoutes');
const callRoutes = require('./routes/callRoutes');
const notifRoutes = require('./routes/notifRoutes');
const datingRoutes = require('./routes/datingRoutes');
const discoveryRoutes = require('./routes/discoveryRoutes');
const likeRoutes = require('./routes/likeRoutes');
const matchRoutes = require('./routes/matchRoutes');
const safetyRoutes = require('./routes/safetyRoutes');
const { initRedis, getRedisHealth } = require('./config/redis');

// Connect to Database & Initialize Distributed Redis
connectDB();
initRedis().catch((err) => {
  console.warn('[REDIS INIT NOTE]:', err.message);
});

const app = express();
const server = http.createServer(app);

// Socket.io Server Setup
const io = socketio(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// Run Socket Handler & Bind Notification Service
socketHandler(io);
const notificationService = require('./services/notificationService');
notificationService.setSocketIO(io);

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads Folder Statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/notifications', notifRoutes);

const mediaRoutes = require('./routes/mediaRoutes');
const followRoutes = require('./routes/followRoutes');
const postRoutes = require('./routes/postRoutes');
const interactionRoutes = require('./routes/interactionRoutes');

// Mount Dating Core Routes (v1)
app.use('/v1/dating', datingRoutes);
app.use('/api/v1/dating', datingRoutes);
app.use('/v1/discovery', discoveryRoutes);
app.use('/api/v1/discovery', discoveryRoutes);
app.use('/v1/likes', likeRoutes);
app.use('/api/v1/likes', likeRoutes);
app.use('/v1/matches', matchRoutes);
app.use('/api/v1/matches', matchRoutes);
app.use('/v1/users', safetyRoutes);
app.use('/api/v1/users', safetyRoutes);

// Mount Social Media Foundation Routes (v1)
app.use('/v1/media', mediaRoutes);
app.use('/api/v1/media', mediaRoutes);

// Mount Social Follow & Privacy Routes (v1)
app.use('/v1', followRoutes);
app.use('/api/v1', followRoutes);

// Mount Social Content & Post Routes (v1)
app.use('/v1', postRoutes);
app.use('/api/v1', postRoutes);

// Mount Social Interactions & Engagement Routes (v1)
app.use('/v1', interactionRoutes);
app.use('/api/v1', interactionRoutes);

// Mount Social Connected Feed Routes (v1)
const feedRoutes = require('./routes/feedRoutes');
app.use('/v1', feedRoutes);
app.use('/api/v1', feedRoutes);

// Mount Social Stories & Ephemeral Content Routes (v1)
const storyRoutes = require('./routes/storyRoutes');
app.use('/v1', storyRoutes);
app.use('/api/v1', storyRoutes);

// Mount Social Reels & Video Playback Routes (v1)
const reelRoutesV1 = require('./routes/reelRoutes');
app.use('/v1', reelRoutesV1);
app.use('/api/v1', reelRoutesV1);

// Mount Social Safety & Moderation Routes (v1)
app.use('/v1', safetyRoutes);
app.use('/api/v1', safetyRoutes);

// Mount Social Notifications & Device Routes (v1)
const deviceRoutes = require('./routes/deviceRoutes');
app.use('/v1/notifications', notifRoutes);
app.use('/api/v1/notifications', notifRoutes);
app.use('/v1/devices', deviceRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/v1/users/me/notification-preferences', notifRoutes);
app.use('/api/v1/users/me/notification-preferences', notifRoutes);

// Mount Messaging Foundation Routes (v1)
const conversationRoutes = require('./routes/conversationRoutes');
app.use('/v1/conversations', conversationRoutes);
app.use('/api/v1/conversations', conversationRoutes);

// Mount Messaging Offline Synchronization Routes (v1)
const syncRoutes = require('./routes/syncRoutes');
app.use('/v1/messaging', syncRoutes);
app.use('/api/v1/messaging', syncRoutes);

// Mount Paid Communication & Billing Foundation Routes (v1)
const paidCommunicationRoutes = require('./routes/paidCommunicationRoutes');
const walletRoutes = require('./routes/walletRoutes');
const adminRoutes = require('./routes/adminRoutes');
app.use('/v1/paid-communication', paidCommunicationRoutes);
app.use('/api/v1/paid-communication', paidCommunicationRoutes);
app.use('/v1/wallet', walletRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/v1/admin/paid-communication', adminRoutes);
app.use('/api/v1/admin/paid-communication', adminRoutes);

const pushAdapter = require('./services/pushAdapter');

// Health and Readiness check routes
app.get(['/', '/health', '/api/health'], (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const redisHealth = getRedisHealth();
  const pushStatus = pushAdapter.getProviderStatus();
  const dbStatus = mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED';

  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    components: {
      database: { status: dbStatus, host: mongoose.connection.host || 'unknown' },
      redis: redisHealth,
      push: pushStatus,
      turn: {
        configured: Boolean(process.env.COTURN_SECRET || process.env.TURN_SECRET),
        status: (process.env.COTURN_SECRET || process.env.TURN_SECRET) ? 'CONFIGURED' : (isProduction ? 'DISABLED_UNCONFIGURED' : 'DEV_STUN_FALLBACK'),
      },
    },
  });
});

app.get(['/ready', '/api/ready'], (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const redisHealth = getRedisHealth();
  const dbConnected = mongoose.connection.readyState === 1;

  // In production, Redis must be real and connected, and DB must be connected
  const isReady = dbConnected && (!isProduction || (redisHealth.connected && !redisHealth.isMock));

  const responsePayload = {
    ready: isReady,
    status: isReady ? 'READY' : 'NOT_READY',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      database: dbConnected,
      redis: isProduction ? (redisHealth.connected && !redisHealth.isMock) : redisHealth.connected,
      redisDistributed: redisHealth.distributedReady,
    },
    timestamp: new Date().toISOString(),
  };

  if (!isReady) {
    return res.status(503).json(responsePayload);
  }
  return res.status(200).json(responsePayload);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]:', err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
