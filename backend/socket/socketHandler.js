const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');

// Map of userId -> socket.id for active calling and notifications mapping
const userSocketMap = new Map();

const socketHandler = (io) => {
  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket Auth Error:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    userSocketMap.set(userId, socket.id);
    socket.join(`user:${userId}`);
    socket.join(`user_${userId}`);
    console.log(`[SOCKET] User connected: ${userId} (Socket ID: ${socket.id})`);

    // --- CHAT ROOMS MANAGEMENT ---
    
    // Join a specific chat room
    socket.on('join_chat', (chatId) => {
      socket.join(`chat_${chatId}`);
      console.log(`[SOCKET] User ${userId} joined room: chat_${chatId}`);
    });

    // Leave a specific chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat_${chatId}`);
      console.log(`[SOCKET] User ${userId} left room: chat_${chatId}`);
    });

    // Send chat message
    socket.on('send_message', async (data) => {
      const { chatId, text, type, stickerId, replyTo } = data;

      try {
        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) {
          return socket.emit('error_message', { message: 'Chat room not found or unauthorized' });
        }

        const msg = await Message.create({
          chat: chatId,
          sender: userId,
          type: type || 'text',
          text: text || '',
          stickerId: stickerId || '',
          replyTo: replyTo || undefined,
        });

        // Update chat lastMessage
        chat.lastMessage = msg._id;
        await chat.save();

        const senderProfile = await Profile.findOne({ user: userId });

        const messagePayload = {
          id: msg._id,
          chatId,
          senderId: userId,
          senderName: senderProfile ? senderProfile.displayName : 'Rubaru User',
          type: msg.type,
          text: msg.text,
          attachmentUri: msg.attachmentUri,
          stickerId: msg.stickerId,
          isRead: false,
          createdAt: msg.createdAt,
          reactions: [],
          replyTo: replyTo ? { id: replyTo } : null,
          isPoll: false,
          pollQuestion: '',
          pollOptions: [],
        };

        // Broadcast to all users in chat room
        io.to(`chat_${chatId}`).emit('receive_message', messagePayload);
      } catch (err) {
        console.error('[SOCKET] send_message error:', err.message);
        socket.emit('error_message', { message: 'Failed to send message' });
      }
    });

    // Relay an already saved message (e.g. attachments uploaded via REST)
    socket.on('relay_message', (data) => {
      const { chatId, message } = data;
      console.log(`[SOCKET] Relaying message ${message.id} to room: chat_${chatId}`);
      io.to(`chat_${chatId}`).emit('receive_message', message);
    });

    // Add / Update Reaction
    socket.on('send_reaction', async (data) => {
      const { chatId, messageId, emoji } = data;

      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const reactionIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId
        );

        if (reactionIndex > -1) {
          if (message.reactions[reactionIndex].emoji === emoji) {
            message.reactions.splice(reactionIndex, 1);
          } else {
            message.reactions[reactionIndex].emoji = emoji;
          }
        } else {
          message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        const profile = await Profile.findOne({ user: userId });
        const updatedReactions = await Promise.all(
          message.reactions.map(async (r) => {
            const p = await Profile.findOne({ user: r.user });
            return {
              userId: r.user,
              displayName: p ? p.displayName : 'User',
              emoji: r.emoji,
            };
          })
        );

        io.to(`chat_${chatId}`).emit('update_reaction', {
          messageId,
          reactions: updatedReactions,
        });
      } catch (err) {
        console.error('[SOCKET] send_reaction error:', err.message);
      }
    });

    // Submit Poll Vote
    socket.on('submit_vote', async (data) => {
      const { chatId, messageId, optionIndex } = data;

      try {
        const msg = await Message.findById(messageId);
        if (!msg || !msg.isPoll) return;

        // Single option voting logic
        msg.pollOptions.forEach((option) => {
          option.votes = option.votes.filter((id) => id.toString() !== userId);
        });

        msg.pollOptions[optionIndex].votes.push(userId);
        await msg.save();

        const updatedOptions = msg.pollOptions.map((opt, index) => ({
          index,
          optionText: opt.optionText,
          voterIds: opt.votes,
          votesCount: opt.votes.length,
        }));

        io.to(`chat_${chatId}`).emit('update_poll', {
          messageId,
          pollOptions: updatedOptions,
        });
      } catch (err) {
        console.error('[SOCKET] submit_vote error:', err.message);
      }
    });

    // --- CALL SIGNALING & WEBRTC HANDSHAKE ---

    // Outgoing call initiation
    socket.on('call_user', async (data) => {
      const { recipientId, callType, callSessionId } = data; // callType: 'voice' | 'video'

      console.log(`[SOCKET] ${userId} calling ${recipientId} (${callType})`);
      const recipientSocketId = userSocketMap.get(recipientId);

      const callerProfile = await Profile.findOne({ user: userId });

      if (recipientSocketId) {
        io.to(recipientSocketId).emit('incoming_call', {
          callerId: userId,
          callerName: callerProfile ? callerProfile.displayName : 'Rubaru Caller',
          callerAvatar: callerProfile ? callerProfile.avatarUri : 'https://i.pravatar.cc/150?img=60',
          callType,
          callSessionId,
        });
      } else {
        socket.emit('call_failed', { message: 'User is offline' });
      }
    });

    // Call Accepted
    socket.on('call_accepted', (data) => {
      const { callerId, callSessionId } = data;
      console.log(`[SOCKET] Call accepted by recipient. Alerting caller: ${callerId}`);
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_connected', { callSessionId });
      }
    });

    // Call Rejected
    socket.on('call_rejected', (data) => {
      const { callerId, callSessionId } = data;
      console.log(`[SOCKET] Call rejected by recipient. Alerting caller: ${callerId}`);
      const callerSocketId = userSocketMap.get(callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_declined', { callSessionId });
      }
    });

    // Call Ended
    socket.on('call_ended', (data) => {
      const { recipientId, callSessionId } = data;
      console.log(`[SOCKET] Call ended by one party. Relaying hang up to: ${recipientId}`);
      const recipientSocketId = userSocketMap.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call_hungup', { callSessionId });
      }
    });

    // WebRTC Signaling SDP / ICE candidates relay
    socket.on('send_webrtc_signal', (data) => {
      const { recipientId, signalData } = data;
      const recipientSocketId = userSocketMap.get(recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('receive_webrtc_signal', {
          senderId: userId,
          signalData,
        });
      }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
      console.log(`[SOCKET] User disconnected: ${userId}`);
      userSocketMap.delete(userId);
    });
  });
};

module.exports = socketHandler;
