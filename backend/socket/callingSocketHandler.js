const Profile = require('../models/Profile');
const Message = require('../models/Message');
const Block = require('../models/Block');
const turnService = require('../services/turnService');

// In-memory rate limiting map for ICE candidates per socket/session (max 60 candidates per minute)
const candidateRateLimits = new Map();

/**
 * Register Calling and WebRTC Signaling Handlers
 * Isolated from the messaging domain to maintain 100% backward compatibility
 */
function registerCallingHandlers(io, socket, userSocketMap) {
  const userId = socket.data ? socket.data.userId : (socket.user ? socket.user._id.toString() : null);

  if (!userId) return;

  // 1. Outgoing Call Initiation
  socket.on('call_user', async (data) => {
    const { recipientId, callType, callSessionId } = data || {};

    console.log(`[SOCKET CALL] ${userId} calling ${recipientId} (${callType})`);
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
      // Also emit to server-derived user room in case user is connected on other sockets
      io.to(`user:${recipientId}`).emit('incoming_call', {
        callerId: userId,
        callerName: callerProfile ? callerProfile.displayName : 'Rubaru Caller',
        callerAvatar: callerProfile ? callerProfile.avatarUri : 'https://i.pravatar.cc/150?img=60',
        callType,
        callSessionId,
      });
    }
  });

  // 2. Call Accepted
  socket.on('call_accepted', (data) => {
    const { callerId, callSessionId } = data || {};
    console.log(`[SOCKET CALL] Call accepted. Alerting caller: ${callerId}`);
    const callerSocketId = userSocketMap.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_connected', { callSessionId });
    }
    io.to(`user:${callerId}`).emit('call_connected', { callSessionId });
  });

  // 3. Call Rejected
  socket.on('call_rejected', (data) => {
    const { callerId, callSessionId } = data || {};
    console.log(`[SOCKET CALL] Call rejected. Alerting caller: ${callerId}`);
    const callerSocketId = userSocketMap.get(callerId);
    if (callerSocketId) {
      io.to(callerSocketId).emit('call_declined', { callSessionId });
    }
    io.to(`user:${callerId}`).emit('call_declined', { callSessionId });
  });

  // 4. Call Ended
  socket.on('call_ended', (data) => {
    const { recipientId, callSessionId } = data || {};
    console.log(`[SOCKET CALL] Call ended. Relaying hangup to: ${recipientId}`);
    const recipientSocketId = userSocketMap.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('call_hungup', { callSessionId });
    }
    io.to(`user:${recipientId}`).emit('call_hungup', { callSessionId });
  });

  // 5. Standard WebRTC SDP / ICE Candidate Signaling Handlers with Validation & Rate Limiting
  socket.on('call.offer', async (data, callback) => {
    try {
      const { recipientId, sessionId, sdp } = data || {};
      if (!recipientId || !sdp) {
        if (typeof callback === 'function') callback({ ok: false, message: 'recipientId and sdp are required' });
        return;
      }

      // Validate SDP structure and size
      const sdpValidation = turnService.validateSdp(typeof sdp === 'object' ? sdp.sdp : sdp);
      if (!sdpValidation.valid) {
        if (typeof callback === 'function') callback({ ok: false, message: sdpValidation.error });
        return;
      }

      const isBlocked = await Block.findOne({
        $or: [
          { blocker: userId, blocked: recipientId },
          { blocker: recipientId, blocked: userId },
        ],
      });
      if (isBlocked) {
        if (typeof callback === 'function') callback({ ok: false, message: 'Communication blocked' });
        return;
      }

      io.to(`user:${recipientId}`).emit('call.offer', {
        senderId: userId,
        sessionId,
        sdp,
      });

      if (typeof callback === 'function') callback({ ok: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ ok: false, message: err.message });
    }
  });

  socket.on('call.answer', async (data, callback) => {
    try {
      const { recipientId, sessionId, sdp } = data || {};
      if (!recipientId || !sdp) {
        if (typeof callback === 'function') callback({ ok: false, message: 'recipientId and sdp are required' });
        return;
      }

      // Validate SDP structure and size
      const sdpValidation = turnService.validateSdp(typeof sdp === 'object' ? sdp.sdp : sdp);
      if (!sdpValidation.valid) {
        if (typeof callback === 'function') callback({ ok: false, message: sdpValidation.error });
        return;
      }

      io.to(`user:${recipientId}`).emit('call.answer', {
        senderId: userId,
        sessionId,
        sdp,
      });

      if (typeof callback === 'function') callback({ ok: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ ok: false, message: err.message });
    }
  });

  socket.on('call.ice_candidate', async (data, callback) => {
    try {
      const { recipientId, sessionId, candidate } = data || {};
      if (!recipientId || !candidate) {
        if (typeof callback === 'function') callback({ ok: false, message: 'recipientId and candidate are required' });
        return;
      }

      // Validate candidate structure
      const candidateValidation = turnService.validateIceCandidate(candidate);
      if (!candidateValidation.valid) {
        if (typeof callback === 'function') callback({ ok: false, message: candidateValidation.error });
        return;
      }

      // Rate limit check: max 60 candidates per minute per socket
      const now = Date.now();
      const rateKey = `${socket.id}:${sessionId || 'global'}`;
      let rateData = candidateRateLimits.get(rateKey);
      if (!rateData || now - rateData.windowStart > 60000) {
        rateData = { windowStart: now, count: 0 };
        candidateRateLimits.set(rateKey, rateData);
      }
      rateData.count++;
      if (rateData.count > 60) {
        if (typeof callback === 'function') callback({ ok: false, message: 'RATE_LIMIT_EXCEEDED: Too many ICE candidates' });
        return;
      }

      io.to(`user:${recipientId}`).emit('call.ice_candidate', {
        senderId: userId,
        sessionId,
        candidate,
      });

      if (typeof callback === 'function') callback({ ok: true });
    } catch (err) {
      if (typeof callback === 'function') callback({ ok: false, message: err.message });
    }
  });

  // Legacy relay fallback
  socket.on('send_webrtc_signal', (data) => {
    const { recipientId, signalData } = data || {};
    const recipientSocketId = userSocketMap.get(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('receive_webrtc_signal', {
        senderId: userId,
        signalData,
      });
    }
    io.to(`user:${recipientId}`).emit('receive_webrtc_signal', {
      senderId: userId,
      signalData,
    });
  });

  // 6. Legacy Relay Message
  socket.on('relay_message', (data) => {
    const { chatId, message } = data || {};
    if (chatId && message) {
      io.to(`conversation:${chatId}`).emit('receive_message', message);
      io.to(`chat_${chatId}`).emit('receive_message', message);
    }
  });

  // 7. Legacy Reaction
  socket.on('send_reaction', async (data) => {
    const { chatId, messageId, emoji } = data || {};
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      const reactionIndex = message.reactions.findIndex((r) => r.user.toString() === userId);
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

      io.to(`conversation:${chatId}`).emit('update_reaction', {
        messageId,
        reactions: updatedReactions,
      });
      io.to(`chat_${chatId}`).emit('update_reaction', {
        messageId,
        reactions: updatedReactions,
      });
    } catch (err) {
      console.error('[SOCKET CALL] send_reaction error:', err.message);
    }
  });

  // 8. Legacy Poll Vote
  socket.on('submit_vote', async (data) => {
    const { chatId, messageId, optionIndex } = data || {};
    try {
      const msg = await Message.findById(messageId);
      if (!msg || !msg.isPoll) return;

      msg.pollOptions.forEach((option) => {
        option.votes = option.votes.filter((id) => id.toString() !== userId);
      });

      if (msg.pollOptions[optionIndex]) {
        msg.pollOptions[optionIndex].votes.push(userId);
        await msg.save();

        const updatedOptions = msg.pollOptions.map((opt, index) => ({
          index,
          optionText: opt.optionText,
          voterIds: opt.votes,
          votesCount: opt.votes.length,
        }));

        io.to(`conversation:${chatId}`).emit('update_poll', {
          messageId,
          pollOptions: updatedOptions,
        });
        io.to(`chat_${chatId}`).emit('update_poll', {
          messageId,
          pollOptions: updatedOptions,
        });
      }
    } catch (err) {
      console.error('[SOCKET CALL] submit_vote error:', err.message);
    }
  });

  // Socket cleanup on disconnect
  socket.on('disconnect', () => {
    // Clear rate limiter entries for this socket
    for (const [key] of candidateRateLimits.entries()) {
      if (key.startsWith(`${socket.id}:`)) {
        candidateRateLimits.delete(key);
      }
    }
  });
}

module.exports = {
  registerCallingHandlers,
};
