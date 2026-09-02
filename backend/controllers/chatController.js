const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Profile = require('../models/Profile');
const User = require('../models/User');

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
        if (otherParticipantId) {
          otherProfile = await Profile.findOne({ user: otherParticipantId });
        }

        return {
          id: chat._id,
          isGroup: chat.isGroup,
          groupName: chat.groupName || '',
          groupAvatar: chat.groupAvatar || '',
          otherParticipant: otherProfile
            ? {
                userId: otherProfile.user,
                displayName: otherProfile.displayName,
                avatarUri: otherProfile.avatarUri,
                bio: otherProfile.bio,
              }
            : null,
          lastMessage: chat.lastMessage
            ? {
                id: chat.lastMessage._id,
                text: chat.lastMessage.text,
                type: chat.lastMessage.type,
                createdAt: chat.lastMessage.createdAt,
              }
            : null,
          updatedAt: chat.updatedAt,
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
      if (req.file.mimetype.startsWith('image/')) {
        attachmentUri = `/uploads/images/${req.file.filename}`;
        messageType = 'image';
      } else if (req.file.mimetype.startsWith('audio/')) {
        attachmentUri = `/uploads/audio/${req.file.filename}`;
        messageType = 'voice';
      }
    }

    // 2. Create Message
    const newMessage = await Message.create({
      chat: targetChatId,
      sender: req.user._id,
      type: messageType,
      text: text || '',
      attachmentUri,
      stickerId: stickerId || '',
      replyTo: replyTo || undefined,
    });

    // 3. Update Chat lastMessage pointer
    chat.lastMessage = newMessage._id;
    await chat.save();

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

module.exports = {
  getChats,
  getMessages,
  sendMessage,
  createPoll,
  votePoll,
  reactMessage,
};
