const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Conversation = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const Message = require('../models/Message');
const Profile = require('../models/Profile');
const User = require('../models/User');
const imagekitService = require('../services/imagekitService');

// @desc    Get all chats / conversations of logged-in user
// @route   GET /api/chats
// @access  Private
const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
    })
      .sort({ updatedAt: -1 })
      .populate('lastMessage')
      .populate('participants', '_id');

    // Build rich details for each conversation (participants profiles)
    const chatList = await Promise.all(
      chats.map(async (chat) => {
        const otherParticipantId = chat.participants.find(
          (p) => p._id.toString() !== req.user._id.toString()
        )?._id;

        let otherProfile = null;
        let otherUser = null;
        if (otherParticipantId) {
          [otherProfile, otherUser] = await Promise.all([
            Profile.findOne({ user: otherParticipantId }),
            User.findById(otherParticipantId, '_id email phone'),
          ]);
        }

        const rawDisplayName = otherProfile?.displayName;
        const resolvedDisplayName = rawDisplayName && rawDisplayName.trim() !== '' && !rawDisplayName.includes('undefined')
          ? rawDisplayName.trim()
          : (otherUser?.email ? otherUser.email.split('@')[0] : (otherUser?.phone ? `User ${otherUser.phone.slice(-4)}` : 'Rubaru User'));

        const resolvedAvatarUri = otherProfile?.avatarUri || (Array.isArray(otherProfile?.photos) && otherProfile.photos[0]) || '';

        const unreadCount = await Message.countDocuments({
          $or: [{ chat: chat._id }, { conversationId: chat._id }],
          $and: [
            {
              $or: [
                { sender: { $ne: req.user._id } },
                { senderId: { $ne: req.user._id } },
              ],
            },
          ],
          isRead: false,
        });

        let lastMsgDoc = chat.lastMessage;
        if (!lastMsgDoc) {
          lastMsgDoc = await Message.findOne({
            $or: [{ chat: chat._id }, { conversationId: chat._id }],
            status: { $ne: 'DELETED' },
          }).sort({ createdAt: -1 });
        }

        const isFromMe = lastMsgDoc
          ? ((lastMsgDoc.sender || lastMsgDoc.senderId)?.toString() === req.user._id.toString())
          : false;

        const msgStatus = lastMsgDoc
          ? (lastMsgDoc.isRead ? 'READ' : (lastMsgDoc.deliveredAt ? 'DELIVERED' : 'SENT'))
          : 'SENT';

        return {
          id: chat._id,
          isGroup: chat.isGroup,
          groupName: chat.groupName || '',
          groupAvatar: chat.groupAvatar || '',
          unreadCount: unreadCount || 0,
          otherParticipant: otherParticipantId
            ? {
                userId: otherParticipantId,
                displayName: resolvedDisplayName,
                avatarUri: resolvedAvatarUri,
                bio: otherProfile?.bio || '',
              }
            : null,
          lastMessage: lastMsgDoc
            ? {
                id: lastMsgDoc._id,
                text: lastMsgDoc.text,
                type: lastMsgDoc.type,
                createdAt: lastMsgDoc.createdAt,
                isFromMe,
                status: msgStatus,
              }
            : null,
          updatedAt: lastMsgDoc?.createdAt || chat.updatedAt,
        };
      })
    );

    res.status(200).json(chatList);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message, error: { code: error.code } });
  }
};

// @desc    Get messages inside a conversation thread
// @route   GET /api/chats/:chatId/messages
// @access  Private
const getMessages = async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  try {
    const { requireActiveDatingConversation } = require('../services/matchAuthorizationService');
    const authContext = await requireActiveDatingConversation(req.user._id, req.params.chatId);
    const chat = authContext.chat;

    if (!chat) {
      return res.status(404).json({ message: 'Conversation thread not found or unauthorized' });
    }

    const skipIndex = (page - 1) * limit;

    const messages = await Message.find({ chat: req.params.chatId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skipIndex)
      .populate('replyTo')
      .populate('sender', '_id');

    // Parse messages to format required by the UI
    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        const senderProfile = await Profile.findOne({ user: msg.sender._id });

        // Format reactions array into user reactions list
        const reactionsList = await Promise.all(
          msg.reactions.map(async (r) => {
            const profile = await Profile.findOne({ user: r.user });
            return {
              userId: r.user,
              displayName: profile ? profile.displayName : 'User',
              emoji: r.emoji,
            };
          })
        );

        return {
          id: msg._id,
          chatId: msg.chat,
          senderId: msg.sender._id,
          senderName: senderProfile ? senderProfile.displayName : 'Rubaru User',
          type: msg.type,
          text: msg.text,
          attachmentUri: msg.attachmentUri,
          stickerId: msg.stickerId,
          isRead: msg.isRead,
          createdAt: msg.createdAt,
          reactions: reactionsList,
          replyTo: msg.replyTo
            ? {
                id: msg.replyTo._id,
                text: msg.replyTo.text,
                type: msg.replyTo.type,
              }
            : null,
          isPoll: msg.isPoll,
          pollQuestion: msg.pollQuestion,
          pollOptions: msg.pollOptions.map((opt, index) => ({
            index,
            optionText: opt.optionText,
            voterIds: opt.votes,
            votesCount: opt.votes.length,
          })),
        };
      })
    );

    // Return in chronological order
    res.status(200).json(formattedMessages.reverse());
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message, error: { code: error.code } });
  }
};

// @desc    Post a new Message (handles REST text, images, and voice notes)
// @route   POST /api/chats/message
// @access  Private
const sendMessage = async (req, res) => {
  const { chatId, recipientId, text, type = 'text', stickerId, replyTo } = req.body;

  try {
    let targetChatId = chatId;

    // 1. If chatId is not provided, check or create private chat with recipientId
    if (!targetChatId && recipientId) {
      let existingChat = await Chat.findOne({
        isGroup: false,
        participants: { $all: [req.user._id, recipientId] },
      });

      if (!existingChat) {
        existingChat = await Chat.create({
          participants: [req.user._id, recipientId],
        });
      }
      targetChatId = existingChat._id;
    }

    if (!targetChatId) {
      return res.status(400).json({ message: 'Please provide chatId or recipientId' });
    }

    // Double check chat access with active Match authorization
    const { requireActiveDatingConversation } = require('../services/matchAuthorizationService');
    const authContext = await requireActiveDatingConversation(req.user._id, targetChatId);
    const chat = authContext.chat;

    if (!chat) {
      return res.status(404).json({ message: 'Conversation thread not found or unauthorized' });
    }

    // Determine attachment URI
    let attachmentUri = '';
    let messageType = type;

    if (req.file) {
      try {
        if (req.file.mimetype.startsWith('image/')) {
          const uploaded = await imagekitService.uploadLocalFile(
            req.file.path,
            req.file.filename,
            imagekitService.FOLDERS.CHAT,
            ['chat', 'image', targetChatId.toString()]
          );
          attachmentUri = uploaded.url;
          messageType = 'image';
        } else if (req.file.mimetype.startsWith('audio/')) {
          const uploaded = await imagekitService.uploadLocalFile(
            req.file.path,
            req.file.filename,
            imagekitService.FOLDERS.CHAT,
            ['chat', 'voice', targetChatId.toString()]
          );
          attachmentUri = uploaded.url;
          messageType = 'voice';
        }
      } catch (uploadErr) {
        console.warn('[CHAT ATTACHMENT IMAGEKIT FALLBACK]', uploadErr.message);
        if (req.file.mimetype.startsWith('image/')) {
          attachmentUri = `/uploads/images/${req.file.filename}`;
          messageType = 'image';
        } else if (req.file.mimetype.startsWith('audio/')) {
          attachmentUri = `/uploads/audio/${req.file.filename}`;
          messageType = 'voice';
        }
      }
    }

    // 2. Allocate sequence atomically
    let nextSequence = 1;
    const conv = await Conversation.findOneAndUpdate(
      { _id: targetChatId },
      { $inc: { lastSequence: 1 } },
      { new: true }
    );
    if (conv) {
      nextSequence = conv.lastSequence;
    } else {
      const highestMsg = await Message.findOne({
        $or: [{ conversationId: targetChatId }, { chat: targetChatId }],
      }).sort({ sequence: -1 });
      nextSequence = (highestMsg?.sequence || 0) + 1;
    }

    // Create Message with sequence
    const newMessage = await Message.create({
      chat: targetChatId,
      conversationId: targetChatId,
      sender: req.user._id,
      senderId: req.user._id,
      clientMessageId: req.body.clientMessageId || `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      sequence: nextSequence,
      type: messageType,
      text: text || '',
      attachmentUri,
      stickerId: stickerId || '',
      replyTo: replyTo || undefined,
      isRead: false,
    });

    // 3. Update Chat lastMessage pointer
    chat.lastMessage = newMessage._id;
    await chat.save();

    // 4. Real-time Socket Broadcast to conversation room and all participants
    try {
      const { getSocketIO } = require('../services/socketDispatchService');
      const io = getSocketIO();
      if (io) {
        const msgPayload = {
          id: newMessage._id.toString(),
          _id: newMessage._id.toString(),
          chatId: targetChatId.toString(),
          chat: targetChatId.toString(),
          conversationId: targetChatId.toString(),
          senderId: req.user._id.toString(),
          sender: req.user._id.toString(),
          type: messageType,
          text: text || '',
          attachmentUri: newMessage.attachmentUri,
          isRead: false,
          createdAt: newMessage.createdAt,
        };

        io.to(`conversation:${targetChatId}`).emit('receive_message', msgPayload);
        io.to(`conversation:${targetChatId}`).emit('message.created', { version: 1, data: { message: msgPayload } });
        io.to(`chat_${targetChatId}`).emit('receive_message', msgPayload);

        if (Array.isArray(chat.participants)) {
          chat.participants.forEach((p) => {
            const participantId = (p._id || p).toString();
            io.to(`user:${participantId}`).emit('receive_message', msgPayload);
            io.to(`user_${participantId}`).emit('receive_message', msgPayload);
            io.to(`user:${participantId}`).emit('message.created', { version: 1, data: { message: msgPayload } });
            io.to(`user:${participantId}`).emit('new_message', msgPayload);
          });
        }
      }
    } catch (socketBroadcastErr) {
      console.warn('[CHAT REST SOCKET BROADCAST ERROR]', socketBroadcastErr.message);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message, error: { code: error.code } });
  }
};

// @desc    Create a custom Poll inside a Chat
// @route   POST /api/chats/poll
// @access  Private
const createPoll = async (req, res) => {
  const { chatId, pollQuestion, options } = req.body;

  if (!chatId || !pollQuestion || !options || options.length < 2) {
    return res.status(400).json({
      message: 'Please provide chatId, pollQuestion and at least 2 options',
    });
  }

  try {
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({ message: 'Conversation thread not found' });
    }

    const parsedOptions = typeof options === 'string' ? JSON.parse(options) : options;

    const formattedOptions = parsedOptions.map((opt) => ({
      optionText: opt,
      votes: [],
    }));

    const newPoll = await Message.create({
      chat: chatId,
      sender: req.user._id,
      type: 'poll',
      isPoll: true,
      pollQuestion,
      pollOptions: formattedOptions,
    });

    chat.lastMessage = newPoll._id;
    await chat.save();

    res.status(201).json(newPoll);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Vote on a Poll Option
// @route   POST /api/chats/poll/:messageId/vote
// @access  Private
const votePoll = async (req, res) => {
  const { optionIndex } = req.body; // Index of the option user is voting for
  const userId = req.user._id;

  if (optionIndex === undefined) {
    return res.status(400).json({ message: 'Please provide optionIndex' });
  }

  try {
    const pollMessage = await Message.findById(req.params.messageId);
    if (!pollMessage || !pollMessage.isPoll) {
      return res.status(404).json({ message: 'Poll message not found' });
    }

    // 1. Remove user's vote from all other options in this poll (Single-choice voting rule)
    pollMessage.pollOptions.forEach((option) => {
      option.votes = option.votes.filter((id) => id.toString() !== userId.toString());
    });

    // 2. Toggle vote on target index
    const alreadyVotedOption = pollMessage.pollOptions[optionIndex].votes.includes(userId);
    if (!alreadyVotedOption) {
      pollMessage.pollOptions[optionIndex].votes.push(userId);
    }

    await pollMessage.save();

    res.status(200).json(pollMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    React to a Message with Emoji
// @route   POST /api/chats/message/:messageId/react
// @access  Private
const reactMessage = async (req, res) => {
  const { emoji } = req.body;
  const userId = req.user._id;

  if (!emoji) {
    return res.status(400).json({ message: 'Please provide an emoji character' });
  }

  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.user.toString() === userId.toString()
    );

    if (existingReactionIndex > -1) {
      // If user already reacted with the same emoji, remove it
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        // Change emoji
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      // Add new reaction
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();
    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark conversation messages as read
// @route   PUT /api/chats/:chatId/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!chatId) {
      return res.status(400).json({ message: 'chatId is required' });
    }

    const possibleIds = [chatId];
    if (mongoose.Types.ObjectId.isValid(chatId)) {
      const objId = new mongoose.Types.ObjectId(chatId);
      possibleIds.push(objId);

      // Check if chatId is a recipient's user ID rather than a chat ID
      const [chatByPart, convByPart] = await Promise.all([
        Chat.findOne({ participants: { $all: [req.user._id, objId] } }),
        Conversation.findOne({
          $or: [
            { participants: { $all: [req.user._id, objId] } },
            { canonicalParticipantKey: `${[req.user._id.toString(), objId.toString()].sort().join(':')}` },
          ],
        }),
      ]);

      if (chatByPart) {
        possibleIds.push(chatByPart._id);
        possibleIds.push(chatByPart._id.toString());
      }
      if (convByPart) {
        possibleIds.push(convByPart._id);
        possibleIds.push(convByPart._id.toString());
      }
    }

    // 1. Mark all messages from other sender as read
    await Message.updateMany(
      {
        $or: [
          { chat: { $in: possibleIds } },
          { conversationId: { $in: possibleIds } },
        ],
        $and: [
          {
            $or: [
              { sender: { $ne: req.user._id } },
              { senderId: { $ne: req.user._id } },
            ],
          },
        ],
        isRead: false,
      },
      { $set: { isRead: true, readAt: new Date() } }
    );

    // 2. Advance ConversationMember read watermarks
    const matchedConvs = await Conversation.find({ _id: { $in: possibleIds } }).lean();
    for (const conv of matchedConvs) {
      const maxSeq = conv.lastSequence || 0;
      await ConversationMember.updateMany(
        {
          conversationId: conv._id,
          userId: req.user._id,
        },
        {
          $max: {
            readThroughSequence: maxSeq,
            lastReadSequence: maxSeq,
            deliveredThroughSequence: maxSeq,
            lastDeliveredSequence: maxSeq,
          },
          $set: { readAt: new Date() },
        }
      );
    }

    // 3. Broadcast read receipt via Socket.IO to conversation and user rooms
    try {
      const { getSocketIO } = require('../services/socketDispatchService');
      const io = getSocketIO();
      if (io) {
        const uniqueIdStrs = Array.from(new Set(possibleIds.map((id) => id.toString())));
        uniqueIdStrs.forEach((idStr) => {
          const payload = {
            chatId: idStr,
            conversationId: idStr,
            readerId: req.user._id.toString(),
            actorUserId: req.user._id.toString(),
            unreadCount: 0,
          };
          io.to(`conversation:${idStr}`).emit('messages_read', payload);
          io.to(`chat_${idStr}`).emit('messages_read', payload);
          io.to(`conversation:${idStr}`).emit('receipt.read', payload);
          io.to(`conversation:${idStr}`).emit('message_read', payload);
        });

        // Collect all participants to notify their individual user rooms
        const chatDocs = await Chat.find({ _id: { $in: possibleIds } }).lean();
        const allParticipants = new Set();
        allParticipants.add(req.user._id.toString());
        chatDocs.forEach((c) => {
          (c.participants || []).forEach((p) => allParticipants.add((p._id || p).toString()));
        });
        matchedConvs.forEach((c) => {
          (c.participants || []).forEach((p) => allParticipants.add((p._id || p).toString()));
        });

        allParticipants.forEach((pId) => {
          const payload = {
            chatId,
            conversationId: chatId,
            readerId: req.user._id.toString(),
            actorUserId: req.user._id.toString(),
            unreadCount: 0,
          };
          io.to(`user:${pId}`).emit('messages_read', payload);
          io.to(`user_${pId}`).emit('messages_read', payload);
          io.to(`user:${pId}`).emit('message_read', payload);
          io.to(`user:${pId}`).emit('receipt.read', payload);
        });
      }
    } catch (sErr) {
      console.warn('[MARK AS READ SOCKET EMIT ERROR]', sErr.message);
    }

    res.status(200).json({ success: true, chatId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getChats,
  getMessages,
  sendMessage,
  createPoll,
  votePoll,
  reactMessage,
  markAsRead,
};
