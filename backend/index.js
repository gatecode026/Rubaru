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

// Connect to Database
connectDB();

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
app.use('/v1/notifications', notifRoutes);
app.use('/api/v1/notifications', notifRoutes);
app.use('/v1/devices', notifRoutes);
app.use('/api/v1/devices', notifRoutes);
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

// Health check routes
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({
    status: 'ok',
    message: 'Rubaru API Server is running smoothly',
    timestamp: new Date().toISOString(),
  });
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
