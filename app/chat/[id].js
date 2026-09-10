import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Audio from '../../src/services/audioHelper';
import MessageBubble from '../../src/components/common/MessageBubble';
import MessageOptionsMenu from '../../src/components/common/MessageOptionsMenu';
import EmojiPickerSheet from '../../src/components/common/EmojiPickerSheet';
import ImageBubble from '../../src/components/common/ImageBubble';
import VoiceMessageBubble from '../../src/components/common/VoiceMessageBubble';
import AttachmentSheet from '../../src/components/common/AttachmentSheet';
import StickerPicker from '../../src/components/common/StickerPicker';
import AIAssistMenu from '../../src/components/common/AIAssistMenu';
import PollBubble from '../../src/components/common/PollBubble';
import PollResultsModal from '../../src/components/common/PollResultsModal';
import CreatePollModal from '../../src/components/common/CreatePollModal';
import ReplyPreviewBar from '../../src/components/common/ReplyPreviewBar';
import { useTheme } from '../../src/theme';
import api from '../../src/services/api';
import { getSocket } from '../../src/services/socket';
import { usePointsStore } from '../../src/store/pointsStore';
import { useCallStore } from '../../src/store/callStore';
import paidCommunicationClient from '../../src/services/paidCommunicationService';
import {
  PaidCommunicationConfirmModal,
  PaidSessionLiveBadge,
  PaidSessionReceiptModal,
} from '../../src/components/common/PaidCommunicationModal';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';
function getFullUrl(uri) {
  if (!uri) return '';
  if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://')) return uri;
  return `${BASE_URL}${uri}`;
}

function formatTime(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
}

function getDateLabel(dateInput) {
  if (!dateInput) return 'Today';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Today';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = today.getTime() - msgDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (today.getFullYear() === d.getFullYear()) {
    return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
}

function sortMessagesChronologically(msgList) {
  return [...msgList].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function formatServerMessage(m, currentUserId) {
  const senderIdStr = String(m.senderId?._id || m.senderId || m.sender?._id || m.sender || '');
  const isSent = Boolean(currentUserId && senderIdStr && senderIdStr === String(currentUserId));
  const createdAt = m.createdAt || new Date().toISOString();

  let optionsList = [];
  if (m.isPoll && Array.isArray(m.pollOptions)) {
    optionsList = m.pollOptions.map((opt, idx) => ({
      id: `opt-${idx}`,
      label: opt.optionText || opt.label || '',
      votes: Array.isArray(opt.voterIds) ? opt.voterIds.length : (opt.votes || 0),
      isSelected: Array.isArray(opt.voterIds) && currentUserId ? opt.voterIds.some(id => String(id) === String(currentUserId)) : false,
      voters: [],
    }));
  }

  return {
    id: String(m.id || m._id),
    clientMessageId: m.clientMessageId || undefined,
    type: (m.type || 'text').toLowerCase(),
    text: m.text || '',
    attachmentUri: m.attachmentUri ? getFullUrl(m.attachmentUri) : '',
    imageUri: (m.type === 'image' || m.attachmentUri) ? getFullUrl(m.attachmentUri) : undefined,
    voiceUri: (m.type === 'voice' || m.type === 'audio') ? getFullUrl(m.attachmentUri) : undefined,
    duration: m.duration || (m.type === 'voice' ? '00:15' : undefined),
    createdAt,
    time: formatTime(createdAt),
    isSent,
    isRead: Boolean(m.isRead),
    status: isSent ? (m.isRead ? 'read' : 'sent') : 'sent',
    replyTo: m.replyTo ? {
      senderName: m.replyTo.senderName || 'User',
      text: m.replyTo.text || '',
    } : null,
    isPoll: Boolean(m.isPoll),
    question: m.pollQuestion || m.question || '',
    options: optionsList.length > 0 ? optionsList : m.options,
    sticker: m.stickerId || m.sticker || '',
    reactions: m.reactions || [],
  };
}

export default function ChatDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();

  const [inputText, setInputText] = useState('');
  // Standard Chronological order: index 0 = oldest (top), index last = newest (bottom)
  const [messages, setMessages] = useState([]);
  const [myUserId, setMyUserId] = useState(null);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newIncomingCount, setNewIncomingCount] = useState(0);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [attachmentVisible, setAttachmentVisible] = useState(false);
  const [stickerVisible, setStickerVisible] = useState(false);
  const [aiMenuVisible, setAiMenuVisible] = useState(false);
  const [isReactionMode, setIsReactionMode] = useState(false);
  const [createPollVisible, setCreatePollVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedPollForResults, setSelectedPollForResults] = useState(null);
  const [pollResultsVisible, setPollResultsVisible] = useState(false);

  // Audio Recording States
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef(null);
  const flatListRef = useRef(null);

  // Paid Communication States
  const balance = usePointsStore((state) => state.balance);
  const fetchBalance = usePointsStore((state) => state.fetchBalance);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [paidModalType, setPaidModalType] = useState('MESSAGE');
  const [isPaidActive, setIsPaidActive] = useState(false);
  const [activePaidSession, setActivePaidSession] = useState(null);
  const [billedMinutes, setBilledMinutes] = useState(1);
  const [coinsCharged, setCoinsCharged] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [paidLoading, setPaidLoading] = useState(false);

  const routeId = params.id;
  const recipientId = params.recipientId;
  const [otherUserId, setOtherUserId] = useState(params.recipientId || null);
  const [chatUserDisplayName, setChatUserDisplayName] = useState(
    params.name && params.name !== 'User' && params.name !== 'Rubaru User' ? params.name : ''
  );
  const [chatUserAvatarUrl, setChatUserAvatarUrl] = useState(params.avatarUrl || '');

  const displayName = chatUserDisplayName || (params.name && params.name !== 'User' && params.name !== 'Rubaru User' ? params.name : (params.name || 'User'));
  const displayAvatar = chatUserAvatarUrl
    ? getFullUrl(chatUserAvatarUrl)
    : (params.avatarUrl ? getFullUrl(params.avatarUrl) : null);

  const getTargetUserId = () => {
    if (otherUserId && /^[0-9a-fA-F]{24}$/.test(String(otherUserId))) return String(otherUserId);
    if (recipientId && /^[0-9a-fA-F]{24}$/.test(String(recipientId))) return String(recipientId);
    if (routeId && /^[0-9a-fA-F]{24}$/.test(String(routeId))) return String(routeId);
    return otherUserId || recipientId || routeId;
  };

  // Mark chat as read
  const markAsRead = useCallback(async (chatIdToMark) => {
    if (!chatIdToMark) return;
    try {
      await Promise.allSettled([
        api.put(`/chats/${chatIdToMark}/read`),
        api.post(`/v1/conversations/${chatIdToMark}/receipts/read`, { watermark: 999999 }),
      ]);
    } catch (err) {
      // Non-blocking read receipt update
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const target = activeChatId || routeId;
      if (target) {
        markAsRead(target);
      }
      if (routeId && routeId !== activeChatId) {
        markAsRead(routeId);
      }
    }, [activeChatId, routeId, markAsRead])
  );

  // --- Initial Load: Profile & Messages ---
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      try {
        setLoadingMsgs(true);
        // 1. Resolve logged-in User ID string
        const meRes = await api.get('/profiles/me');
        const rawUser = meRes.data?.user;
        const resolvedMyId = (typeof rawUser === 'object' && rawUser?._id)
          ? String(rawUser._id)
          : (rawUser ? String(rawUser) : (meRes.data?._id ? String(meRes.data._id) : ''));
        
        if (isMounted) setMyUserId(resolvedMyId);

        let chatId = routeId;
        const chatsRes = await api.get('/chats');
        const existing = chatsRes.data.find(
          (c) => !c.isGroup && c.otherParticipant?.userId?.toString() === routeId.toString()
        );

        let resolvedOtherUserId = recipientId;

        if (existing) {
          chatId = existing.id;
          if (existing.otherParticipant) {
            resolvedOtherUserId = existing.otherParticipant.userId;
            if (existing.otherParticipant.displayName && existing.otherParticipant.displayName !== 'Rubaru User' && isMounted) {
              setChatUserDisplayName(existing.otherParticipant.displayName);
            }
            if (existing.otherParticipant.avatarUri && isMounted) {
              setChatUserAvatarUrl(existing.otherParticipant.avatarUri);
            }
          }
        } else {
          const isChatId = chatsRes.data.some((c) => c.id?.toString() === routeId.toString());
          if (isChatId) {
            const currentChat = chatsRes.data.find((c) => c.id?.toString() === routeId.toString());
            if (currentChat?.otherParticipant?.displayName && currentChat.otherParticipant.displayName !== 'Rubaru User' && isMounted) {
              setChatUserDisplayName(currentChat.otherParticipant.displayName);
            }
            if (currentChat?.otherParticipant?.avatarUri && isMounted) {
              setChatUserAvatarUrl(currentChat.otherParticipant.avatarUri);
            }
            if (currentChat?.otherParticipant?.userId) {
              resolvedOtherUserId = currentChat.otherParticipant.userId;
            }
          } else {
            chatId = null;
            resolvedOtherUserId = routeId;
          }
        }

        if (resolvedOtherUserId && isMounted) {
          setOtherUserId(String(resolvedOtherUserId));
        }

        // Fetch other user profile directly if display name is still missing
        const targetUserId = resolvedOtherUserId || (routeId !== chatId ? routeId : null);
        if (targetUserId) {
          try {
            const profileRes = await api.get(`/profiles/${targetUserId}`);
            if (profileRes.data?.displayName && profileRes.data.displayName !== 'Rubaru User' && isMounted) {
              setChatUserDisplayName(profileRes.data.displayName);
            }
            if (profileRes.data?.avatarUri && isMounted) {
              setChatUserAvatarUrl(profileRes.data.avatarUri);
            }
          } catch (pErr) {
            // Ignore if profile lookup fails
          }
        }

        if (isMounted) setActiveChatId(chatId);

        if (chatId) {
          const msgsRes = await api.get(`/chats/${chatId}/messages?page=1&limit=50`);
          const serverMsgs = Array.isArray(msgsRes.data) ? msgsRes.data : [];
          
          // Chronological sort: oldest at top (index 0), newest at bottom (index last)
          const formatted = serverMsgs.map((m) => formatServerMessage(m, resolvedMyId));
          const sorted = sortMessagesChronologically(formatted);

          if (isMounted) {
            setMessages(sorted);
            setHasMore(serverMsgs.length >= 50);
            setPage(1);
          }

          // Mark conversation messages as read
          markAsRead(chatId);
        } else {
          if (isMounted) {
            setMessages([]);
            setHasMore(false);
          }
        }
      } catch (e) {
        console.log('[LOAD MESSAGES ERROR]', e.message);
      } finally {
        if (isMounted) setLoadingMsgs(false);
      }
    };

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [routeId, recipientId, markAsRead]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loadingMsgs && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [loadingMsgs]);

  // --- Upward Pagination: Load Older Messages ---
  const handleLoadMore = async () => {
    if (!activeChatId || !hasMore || loadingMore || loadingMsgs) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const msgsRes = await api.get(`/chats/${activeChatId}/messages?page=${nextPage}&limit=40`);
      const olderList = Array.isArray(msgsRes.data) ? msgsRes.data : [];
      if (olderList.length === 0) {
        setHasMore(false);
      } else {
        const formattedOlder = olderList.map((m) => formatServerMessage(m, myUserId));
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => String(m.id)));
          const filtered = formattedOlder.filter((m) => !existingIds.has(String(m.id)));
          if (filtered.length === 0) {
            setHasMore(false);
            return prev;
          }
          return sortMessagesChronologically([...filtered, ...prev]);
        });
        setPage(nextPage);
        setHasMore(olderList.length >= 40);
      }
    } catch (err) {
      console.warn('[LOAD MORE ERROR]', err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // --- Real-Time Socket Connection ---
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    if (activeChatId) {
      socket.emit('join_chat', activeChatId);
      socket.emit('conversation.subscribe', { conversationId: activeChatId });
      console.log('[SOCKET] Joined chat room:', activeChatId);
    }

    const onReceiveMessage = (rawMsg) => {
      if (!rawMsg) return;
      const msg = rawMsg.data?.message || rawMsg.message || rawMsg;
      const msgChatId = msg.chatId || msg.conversationId || msg.chat;
      const msgSenderId = String(msg.senderId?._id || msg.senderId || msg.sender?._id || msg.sender || msg.from || '');
      const targetOtherId = recipientId || routeId;

      const isMatchingChat = activeChatId && msgChatId && String(msgChatId) === String(activeChatId);
      const isFromRecipient = targetOtherId && msgSenderId && String(msgSenderId) === String(targetOtherId);

      if (!activeChatId && msgChatId && isFromRecipient) {
        setActiveChatId(String(msgChatId));
      }

      if (activeChatId && !isMatchingChat && !isFromRecipient) {
        return;
      }

      const msgId = String(msg.id || msg._id || Date.now());
      const isSentByMe = Boolean(myUserId && msgSenderId && msgSenderId === String(myUserId));
      const rawClientMsgId = msg.clientMessageId || rawMsg.clientMessageId;

      const newFormatted = formatServerMessage(msg, myUserId);

      setMessages((prev) => {
        // 1. Direct ID match
        const existsById = prev.some((m) => String(m.id) === msgId);
        if (existsById) return prev;

        // 2. Reconcile optimistic sending message
        if (isSentByMe) {
          const optIdx = prev.findIndex((m) =>
            (rawClientMsgId && m.clientMessageId === rawClientMsgId) ||
            (m.status === 'sending' && m.text === newFormatted.text && (Date.now() - new Date(m.createdAt).getTime() < 30000))
          );
          if (optIdx > -1) {
            const copy = [...prev];
            copy[optIdx] = {
              ...newFormatted,
              status: 'sent',
            };
            return sortMessagesChronologically(copy);
          }
        }

        // 3. Append to chronological list (appears at bottom)
        return sortMessagesChronologically([...prev, newFormatted]);
      });

      // If viewing incoming message, mark as read and handle auto-scroll
      if (!isSentByMe) {
        if (activeChatId) markAsRead(activeChatId);
        if (isScrolledUp) {
          setNewIncomingCount((c) => c + 1);
        } else {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    };

    const onMessagesRead = (payload) => {
      const readChatId = payload?.chatId || payload?.conversationId;
      const readerId = payload?.readerId || payload?.actorUserId;
      const targetOtherId = recipientId || routeId;
      const isMatchingChat = activeChatId && readChatId && String(readChatId) === String(activeChatId);
      const isFromOtherUser = targetOtherId && readerId && String(readerId) === String(targetOtherId);

      if (isMatchingChat || isFromOtherUser) {
        setMessages((prev) =>
          prev.map((m) => (m.isSent ? { ...m, isRead: true, status: 'read' } : m))
        );
      }
    };

    socket.on('receive_message', onReceiveMessage);
    socket.on('message.created', onReceiveMessage);
    socket.on('new_message', onReceiveMessage);
    socket.on('conversation.message.created', onReceiveMessage);
    socket.on('messages_read', onMessagesRead);
    socket.on('message_read', onMessagesRead);
    socket.on('receipt.read', onMessagesRead);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('message.created', onReceiveMessage);
      socket.off('new_message', onReceiveMessage);
      socket.off('conversation.message.created', onReceiveMessage);
      socket.off('messages_read', onMessagesRead);
      socket.off('message_read', onMessagesRead);
      socket.off('receipt.read', onMessagesRead);
      if (activeChatId) {
        socket.emit('leave_chat', activeChatId);
        socket.emit('conversation.unsubscribe', { conversationId: activeChatId });
        console.log('[SOCKET] Left chat room:', activeChatId);
      }
    };
  }, [activeChatId, myUserId, recipientId, routeId, isScrolledUp, markAsRead]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  // Clean up recording timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // --- Send Text Message ---
  const handleSend = async () => {
    if (inputText.trim() === '') return;

    // Enforce Paid Chat: cannot send if paid chat is off
    if (!isPaidActive) {
      handleOpenPaidConfirm('MESSAGE');
      return;
    }

    const text = inputText.trim();
    setInputText('');

    const replyData = replyingTo
      ? {
          senderName: replyingTo.isSent ? 'You' : displayName,
          text: replyingTo.text || replyingTo.question || (replyingTo.type === 'image' ? '📷 Photo' : 'Message'),
        }
      : null;

    const clientMsgId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempId = `temp_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimisticMsg = {
      id: tempId,
      clientMessageId: clientMsgId,
      type: 'text',
      text,
      createdAt: nowIso,
      time: formatTime(nowIso),
      isSent: true,
      isRead: false,
      status: 'sending',
      replyTo: replyData,
    };

    // Append to chronological list (appears at bottom)
    setMessages((prev) => [...prev, optimisticMsg]);
    setReplyingTo(null);

    // Keep scrolled to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      if (activeChatId) {
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit(
            'send_message',
            {
              chatId: activeChatId,
              text,
              type: 'text',
              clientMessageId: clientMsgId,
              replyTo: replyingTo?.id || undefined,
            },
            (ack) => {
              if (ack && ack.ok && ack.data?.message) {
                const confirmed = formatServerMessage(ack.data.message, myUserId);
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId || m.clientMessageId === clientMsgId ? { ...confirmed, status: 'sent' } : m))
                );
              }
            }
          );
        } else {
          const res = await api.post('/chats/message', {
            chatId: activeChatId,
            text,
            type: 'text',
            replyTo: replyingTo?.id || undefined,
          });
          const serverMsg = res.data;
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...formatServerMessage(serverMsg, myUserId), status: 'sent' } : m))
          );
        }
      } else {
        // First message in a new conversation
        const targetRecipientId = recipientId || routeId;
        const res = await api.post('/chats/message', {
          recipientId: targetRecipientId,
          text,
          type: 'text',
        });
        const newChatId = String(res.data.chat || res.data._id);
        setActiveChatId(newChatId);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...formatServerMessage(res.data, myUserId), status: 'sent' } : m))
        );
      }
    } catch (e) {
      console.log('[SEND MESSAGE ERROR]', e.message);
      // Mark optimistic message as failed
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const handleRetrySend = async (failedMsg) => {
    if (!isPaidActive) {
      handleOpenPaidConfirm('MESSAGE');
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m))
    );
    try {
      const res = await api.post('/chats/message', {
        chatId: activeChatId,
        recipientId: !activeChatId ? getTargetUserId() : undefined,
        text: failedMsg.text,
        type: failedMsg.type || 'text',
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...formatServerMessage(res.data, myUserId), status: 'sent' } : m))
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // --- Attachment Upload (Photos / Audio) ---
  const uploadAttachment = async (uri, type, duration = '') => {
    if (!uri) return;

    if (!isPaidActive) {
      handleOpenPaidConfirm('MESSAGE');
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const tempMsg = {
      id: tempId,
      type,
      text: '',
      attachmentUri: uri,
      imageUri: type === 'image' ? uri : undefined,
      voiceUri: type === 'voice' ? uri : undefined,
      duration: type === 'voice' ? duration : undefined,
      createdAt: nowIso,
      time: formatTime(nowIso),
      isSent: true,
      isRead: false,
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMsg]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      let targetChatId = activeChatId;
      if (!targetChatId) {
        const targetRecipientId = recipientId || routeId;
        const chatRes = await api.post('/chats/message', {
          recipientId: targetRecipientId,
          text: `Sent a ${type}`,
          type: 'text',
        });
        targetChatId = String(chatRes.data.chat || chatRes.data._id);
        setActiveChatId(targetChatId);
      }

      const formData = new FormData();
      formData.append('chatId', targetChatId);
      formData.append('type', type);

      const fileExtension = uri.split('.').pop() || (type === 'image' ? 'jpg' : 'm4a');
      const mimeType = type === 'image' ? 'image/jpeg' : 'audio/m4a';

      let fileToUpload;
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        fileToUpload = new File([blob], `file.${fileExtension}`, { type: mimeType });
      } else {
        fileToUpload = {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: `file.${fileExtension}`,
          type: mimeType,
        };
      }
      formData.append('attachment', fileToUpload);

      const res = await api.post('/chats/message', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const confirmed = formatServerMessage(res.data, myUserId);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...confirmed, status: 'sent' } : m))
      );
    } catch (e) {
      console.log('[ATTACHMENT UPLOAD ERROR]', e.message);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const handleSendImage = (uri) => uploadAttachment(uri, 'image');

  const handleSendSticker = async (emoji) => {
    if (!isPaidActive) {
      handleOpenPaidConfirm('MESSAGE');
      return;
    }

    const tempId = `temp_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newMsg = {
      id: tempId,
      type: 'sticker',
      sticker: emoji,
      createdAt: nowIso,
      time: formatTime(nowIso),
      isSent: true,
      isRead: false,
      status: 'sending',
    };
    setMessages((prev) => [...prev, newMsg]);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      if (activeChatId) {
        const res = await api.post('/chats/message', {
          chatId: activeChatId,
          type: 'sticker',
          stickerId: emoji,
          text: emoji,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...formatServerMessage(res.data, myUserId), status: 'sent' } : m))
        );
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const handleCreatePoll = async (pollData) => {
    if (!isPaidActive) {
      handleOpenPaidConfirm('MESSAGE');
      return;
    }

    try {
      if (activeChatId) {
        const res = await api.post('/chats/poll', {
          chatId: activeChatId,
          pollQuestion: pollData.question,
          options: pollData.options.map((o) => o.label || o),
        });
        const formatted = formatServerMessage(res.data, myUserId);
        setMessages((prev) => [...prev, formatted]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create poll');
    }
  };

  const handleVote = async (messageId, optionId) => {
    const optIndex = parseInt(optionId.replace('opt-', ''), 10);
    try {
      const res = await api.post(`/chats/poll/${messageId}/vote`, { optionIndex });
      const updated = formatServerMessage(res.data, myUserId);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    } catch (err) {
      console.warn('[VOTE ERROR]', err.message);
    }
  };

  const handleViewAllPoll = (poll) => {
    setSelectedPollForResults(poll);
    setPollResultsVisible(true);
  };

  // --- Audio Recording Handlers ---
  const startRecording = async () => {
    if (!isPaidActive) {
      handleOpenPaidConfirm('MESSAGE');
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission to access microphone was denied');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    clearInterval(timerRef.current);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      const formatRecordingSecs = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      uploadAttachment(uri, 'voice', formatRecordingSecs(recordingTime));
    } catch (err) {
      console.error('Failed to stop recording', err);
    }
  };

  // --- Message Options & Reactions ---
  const handleLongPressMessage = (msg) => {
    setSelectedMessage(msg);
    setOptionsVisible(true);
  };

  const handleSelectReaction = async (emoji) => {
    if (!selectedMessage) return;
    const msgId = selectedMessage.id;
    try {
      await api.post(`/chats/message/${msgId}/react`, { emoji });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reaction: emoji } : m))
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reaction: emoji } : m))
      );
    }
    setOptionsVisible(false);
    setPickerVisible(false);
    setSelectedMessage(null);
  };

  const handleTextEmojiSelect = (emoji) => {
    if (isReactionMode) {
      handleSelectReaction(emoji);
    } else {
      setInputText((prev) => prev + emoji);
    }
  };

  const handlePressSmileyInInput = () => {
    setIsReactionMode(false);
    setPickerVisible(true);
  };

  const handlePressPlus = () => {
    setIsReactionMode(true);
    setOptionsVisible(false);
    setTimeout(() => {
      setPickerVisible(true);
    }, 100);
  };

  const handleSelectOption = (option) => {
    if (!selectedMessage) return;
    if (option === 'delete') {
      setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
    } else if (option === 'reply') {
      setReplyingTo(selectedMessage);
    }
    setOptionsVisible(false);
    setSelectedMessage(null);
  };

  // --- Paid Chat Handlers ---
  const handleOpenPaidConfirm = (type = 'MESSAGE') => {
    const selectedType = type || 'MESSAGE';
    if (selectedType === 'AUDIO' || selectedType === 'VIDEO') {
      const currentCallStatus = useCallStore.getState().callStatus;
      if (currentCallStatus !== 'IDLE' && currentCallStatus !== 'ENDED') {
        alert('You are already in an active call. Please finish your current call first.');
        return;
      }
    }
    setPaidModalType(selectedType);
    setShowPaidModal(true);
    if (fetchBalance) fetchBalance();
  };

  const handleConfirmPaidSession = async () => {
    const targetUserId = getTargetUserId();
    if (!targetUserId) {
      alert('Unable to identify the recipient user');
      return;
    }

    if (paidModalType === 'AUDIO' || paidModalType === 'VIDEO') {
      const currentCallStatus = useCallStore.getState().callStatus;
      if (currentCallStatus !== 'IDLE' && currentCallStatus !== 'ENDED') {
        alert('You are already in an active call. Please finish your current call first.');
        setShowPaidModal(false);
        setPaidModalType('MESSAGE');
        return;
      }
      if (currentCallStatus === 'ENDED') {
        useCallStore.getState().resetToIdle();
      }

      const callTypeToPush = paidModalType === 'VIDEO' ? 'video' : 'voice';
      const rateToPush = String(paidModalType === 'VIDEO' ? 10 : 5);

      setShowPaidModal(false);
      setPaidLoading(false);
      setPaidModalType('MESSAGE');
      router.push({
        pathname: '/active-call',
        params: {
          contactName: displayName || 'User',
          avatarUri: displayAvatar || '',
          receiverId: targetUserId,
          callType: callTypeToPush,
          initialStatus: 'calling',
          isPaid: 'true',
          ratePerMinute: rateToPush,
          isInitiator: 'true',
        },
      });
      return;
    }

    try {
      setPaidLoading(true);
      const session = await paidCommunicationClient.initiateSession({
        receiverId: targetUserId,
        communicationType: 'MESSAGE',
        conversationId: activeChatId,
      });
      setShowPaidModal(false);
      setPaidLoading(false);
      setPaidModalType('MESSAGE');

      setActivePaidSession(session);
      setIsPaidActive(true);
      setBilledMinutes(1);
      setCoinsCharged(session?.ratePerMinuteSnapshot || 1);
      if (fetchBalance) fetchBalance();
    } catch (err) {
      setPaidLoading(false);
      setPaidModalType('MESSAGE');
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to initiate session';
      alert(errMsg);
    }
  };

  const handleEndPaidChat = async () => {
    if (!activePaidSession) {
      setIsPaidActive(false);
      return;
    }
    try {
      const ended = await paidCommunicationClient.endSession(activePaidSession.sessionId, 'NORMAL_COMPLETION');
      setIsPaidActive(false);
      setReceiptData({
        communicationType: 'MESSAGE',
        durationSeconds: (ended?.billedMinutes || billedMinutes) * 60,
        billedMinutes: ended?.billedMinutes || billedMinutes,
        totalCoinsCharged: ended?.totalCoinsCharged || coinsCharged,
        totalCoinsEarned: ended?.totalCoinsEarned || coinsEarned,
        isInitiator: true,
        counterpartyName: displayName,
        endReason: ended?.endReason || 'NORMAL_COMPLETION',
      });
      setShowReceiptModal(true);
      setActivePaidSession(null);
      if (fetchBalance) fetchBalance();
    } catch (err) {
      setIsPaidActive(false);
      setActivePaidSession(null);
    }
  };

  // --- Render Single Message Item in Chronological Order ---
  const renderMessageItem = ({ item, index }) => {
    // Chronological order: index 0 is oldest (top), index + 1 is newer message (below on screen)
    const prevMsg = messages[index - 1]; // older message above
    const nextMsg = messages[index + 1]; // newer message below

    // Show date separator header ABOVE item if it's the first message or date changed
    const itemDate = getDateLabel(item.createdAt);
    const prevDate = prevMsg ? getDateLabel(prevMsg.createdAt) : null;
    const showDateHeader = !prevMsg || itemDate !== prevDate;

    // Consecutive message grouping
    const isGroupedAbove = Boolean(
      prevMsg &&
      prevMsg.isSent === item.isSent &&
      Math.abs(new Date(item.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 120000
    );
    const isGroupedBelow = Boolean(
      nextMsg &&
      nextMsg.isSent === item.isSent &&
      Math.abs(new Date(nextMsg.createdAt).getTime() - new Date(item.createdAt).getTime()) < 120000
    );

    let bubbleContent = null;
    switch (item.type) {
      case 'image':
        bubbleContent = (
          <ImageBubble
            imageUri={item.imageUri || item.attachmentUri}
            time={item.time}
            isSent={item.isSent}
            isRead={item.isRead}
            reaction={item.reaction}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
        break;
      case 'voice':
      case 'audio':
        bubbleContent = (
          <VoiceMessageBubble
            uri={item.voiceUri || item.attachmentUri}
            duration={item.duration}
            time={item.time}
            isSent={item.isSent}
            isRead={item.isRead}
            reaction={item.reaction}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
        break;
      case 'sticker':
        bubbleContent = (
          <View style={item.isSent ? styles.sentStickerContainer : styles.receivedStickerContainer}>
            <Text style={styles.stickerEmojiText}>{item.sticker}</Text>
            <Text style={styles.stickerTimeText}>{item.time}</Text>
          </View>
        );
        break;
      case 'poll':
        bubbleContent = (
          <PollBubble
            poll={item}
            onVote={(optionId) => handleVote(item.id, optionId)}
            onViewAll={() => handleViewAllPoll(item)}
            onLongPress={() => handleLongPressMessage(item)}
          />
        );
        break;
      default:
        bubbleContent = (
          <MessageBubble
            text={item.text}
            time={item.time}
            isSent={item.isSent}
            isRead={item.isRead}
            status={item.status || (item.isSent ? 'sent' : undefined)}
            reaction={item.reaction}
            replyTo={item.replyTo}
            onLongPress={() => handleLongPressMessage(item)}
            onRetry={() => handleRetrySend(item)}
            isGroupedAbove={isGroupedAbove}
            isGroupedBelow={isGroupedBelow}
          />
        );
        break;
    }

    return (
      <View key={item.id}>
        {/* Date header rendered directly ABOVE the first message of each day */}
        {showDateHeader && (
          <View style={styles.dateSeparatorContainer}>
            <View style={[styles.dateSeparator, { backgroundColor: isDarkMode ? '#27272A' : '#FFFFFF' }]}>
              <Text style={[styles.dateSeparatorText, { color: colors.textSecondary || '#8E8E93' }]}>
                {itemDate}
              </Text>
            </View>
          </View>
        )}
        {bubbleContent}
      </View>
    );
  };

  return (
    <View style={[styles.safeContainer, { backgroundColor: colors.headerBg || colors.cardBackground || '#FFFFFF' }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={colors.headerBg || colors.cardBackground || '#FFFFFF'}
      />

      {/* Clean Solid Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.headerBg || colors.cardBackground || '#FFFFFF',
            borderBottomColor: colors.border || '#F2F2F7',
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 8 : 12),
          },
        ]}
      >
        {/* Main Header Top Row */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color={colors.textPrimary || '#000000'} />
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/user-profile')}
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            >
              <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              <View style={styles.headerMeta}>
                <Text style={[styles.nameText, { color: colors.textPrimary || '#000000' }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.statusText, { color: colors.statusOnline || '#10B981' }]}>Online</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7} onPress={() => handleOpenPaidConfirm('VIDEO')}>
              <Ionicons name="videocam-outline" size={24} color={colors.textPrimary || '#000000'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} activeOpacity={0.7} onPress={() => handleOpenPaidConfirm('AUDIO')}>
              <Ionicons name="call-outline" size={22} color={colors.textPrimary || '#000000'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIcon}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/call-info/1',
                  params: { contactId: '1', contactName: displayName, avatarUri: displayAvatar },
                })
              }
            >
              <Ionicons name="information-circle-outline" size={24} color={colors.textPrimary || '#000000'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Compact Paid Chat Pill Badge along bottom border */}
        <View style={styles.headerBadgeWrapper}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (isPaidActive) {
                handleEndPaidChat();
              } else {
                handleOpenPaidConfirm('MESSAGE');
              }
            }}
            style={[styles.headerPaidPill, isPaidActive && styles.headerPaidPillActive]}
          >
            <View style={styles.paidPillLeft}>
              <Ionicons
                name={isPaidActive ? 'flash' : 'sparkles'}
                size={13}
                color={isPaidActive ? '#FF2E63' : '#F59E0B'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.paidPillTitle, isPaidActive && styles.paidPillTitleActive]}>
                Paid Chat
              </Text>
              <View style={[styles.paidPillStatus, isPaidActive ? styles.paidPillStatusOn : styles.paidPillStatusOff]}>
                <Text style={[styles.paidPillStatusText, isPaidActive ? styles.paidPillStatusTextOn : styles.paidPillStatusTextOff]}>
                  {isPaidActive ? 'ON' : 'OFF'}
                </Text>
              </View>
              <Text style={styles.paidPillDivider}>•</Text>
              <Text style={[styles.paidPillRate, isPaidActive && styles.paidPillRateActive]}>
                {isPaidActive
                  ? `${coinsCharged}c spent (${billedMinutes}m)`
                  : '1 coin/min'}
              </Text>
            </View>

            <View style={styles.paidPillRight}>
              {isPaidActive && balance < (activePaidSession?.ratePerMinuteSnapshot || 1) * 2 && (
                <View style={styles.lowBalancePillSmall}>
                  <Text style={styles.lowBalancePillText}>Low Coins</Text>
                </View>
              )}
              <Switch
                value={isPaidActive}
                onValueChange={(val) => {
                  if (val) {
                    handleOpenPaidConfirm('MESSAGE');
                  } else {
                    handleEndPaidChat();
                  }
                }}
                trackColor={{ false: '#D1D5DB', true: '#FF2E63' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#D1D5DB"
                style={{ transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }], marginVertical: -4 }}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Message Thread & Composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <LinearGradient colors={['#FFF5F5', '#FFEBF0', '#FFD9E0']} style={styles.gradientBackground}>
          {/* Subtle Watermark Hearts */}
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Ionicons
              name="heart"
              size={48}
              color="#FFC9D4"
              style={[styles.heart, { top: 60, left: 10, transform: [{ rotate: '-15deg' }], opacity: 0.15 }]}
            />
            <Ionicons
              name="heart"
              size={32}
              color="#FFC9D4"
              style={[styles.heart, { top: 80, left: 80, transform: [{ rotate: '-5deg' }], opacity: 0.12 }]}
            />
          </View>

          {loadingMsgs ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#FF2E63" />
              <Text style={styles.loadingText}>Loading conversation...</Text>
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={40} color="#FF6584" />
              </View>
              <Text style={styles.emptyTitle}>Start a conversation</Text>
              <Text style={styles.emptySubtitle}>Say hello to {displayName} to begin chatting!</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => {
                if (!isScrolledUp) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              onLayout={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              onScroll={(e) => {
                const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
                const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
                setIsScrolledUp(!isNearBottom);
                if (isNearBottom) setNewIncomingCount(0);
                // Trigger load more when user scrolls to top
                if (contentOffset.y <= 30 && hasMore && !loadingMore) {
                  handleLoadMore();
                }
              }}
              scrollEventThrottle={100}
              ListHeaderComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FF2E63" />
                  </View>
                ) : null
              }
            />
          )}

          {/* Floating '↓ New Messages' Pill when Scrolled Up */}
          {isScrolledUp && (
            <TouchableOpacity
              style={styles.floatingScrollBottomBtn}
              activeOpacity={0.85}
              onPress={() => {
                flatListRef.current?.scrollToEnd({ animated: true });
                setNewIncomingCount(0);
              }}
            >
              <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
              {newIncomingCount > 0 ? (
                <Text style={styles.floatingBtnText}>
                  {newIncomingCount} new message{newIncomingCount > 1 ? 's' : ''}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}

          {/* AIAssistMenu Popover */}
          <AIAssistMenu visible={aiMenuVisible} onClose={() => setAiMenuVisible(false)} />

          {/* Recording indicator panel */}
          {isRecording && (
            <View style={styles.recordingOverlay}>
              <View style={styles.redDot} />
              <Text style={styles.recordingText}>Recording: {recordingTime}s</Text>
              <Text style={styles.recordingCancel}>Release to send</Text>
            </View>
          )}

          {/* WhatsApp-style Quoted Reply Preview Bar */}
          {replyingTo && (
            <ReplyPreviewBar replyingTo={replyingTo} displayName={displayName} onClose={() => setReplyingTo(null)} />
          )}

          {/* Bottom Chat Input Composer */}
          <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            {!isPaidActive && (
              <TouchableOpacity
                style={styles.paidChatOffBanner}
                activeOpacity={0.8}
                onPress={() => handleOpenPaidConfirm('MESSAGE')}
              >
                <View style={styles.paidChatOffBannerLeft}>
                  <Ionicons name="lock-closed" size={13} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.paidChatOffBannerText}>
                    Paid Chat is OFF • Turn ON to send messages (1 coin/min)
                  </Text>
                </View>
                <View style={styles.paidChatOffStartBtn}>
                  <Text style={styles.paidChatOffStartBtnText}>Turn ON</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={[styles.inputContainer, { backgroundColor: colors.surface || '#FFFFFF', borderColor: colors.border || '#F2F2F7' }]}>
              <View style={styles.inputLeftColumn}>
                <TextInput
                  placeholder={isPaidActive ? 'Type your message...' : 'Turn ON Paid Chat to message...'}
                  placeholderTextColor={colors.inputPlaceholder || '#AEAEB2'}
                  style={[styles.textInput, { color: colors.inputText || colors.textPrimary || '#000000' }]}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxHeight={100}
                />
                <View style={[styles.iconRow, { borderTopColor: isDarkMode ? '#3F3F46' : '#F3F4F6' }]}>
                  <TouchableOpacity style={styles.inputIcon} onPress={() => {
                    if (!isPaidActive) {
                      handleOpenPaidConfirm('MESSAGE');
                      return;
                    }
                    setAttachmentVisible(true);
                  }}>
                    <Ionicons name="add-circle-outline" size={22} color={colors.inputIcon || '#8E8E93'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.inputIcon}
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                  >
                    <Ionicons name="mic-outline" size={22} color={colors.inputIcon || '#8E8E93'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIcon} onPress={handlePressSmileyInInput}>
                    <Ionicons name="happy-outline" size={22} color={colors.inputIcon || '#8E8E93'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIcon} onPress={() => {
                    if (!isPaidActive) {
                      handleOpenPaidConfirm('MESSAGE');
                      return;
                    }
                    setStickerVisible(true);
                  }}>
                    <Ionicons name="copy-outline" size={20} color={colors.inputIcon || '#8E8E93'} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIcon} onPress={() => setAiMenuVisible(true)}>
                    <Ionicons name="sparkles" size={18} color={colors.inputIcon || '#8E8E93'} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  { backgroundColor: inputText.trim() === '' ? (colors.sendButtonEmptyBg || '#F2F2F7') : (!isPaidActive ? '#F59E0B' : (colors.sendButtonBg || '#1C1C1E')) },
                ]}
                activeOpacity={0.8}
                onPress={handleSend}
                disabled={inputText.trim() === ''}
              >
                <Ionicons
                  name={!isPaidActive && inputText.trim() !== '' ? 'lock-closed' : 'send'}
                  size={!isPaidActive && inputText.trim() !== '' ? 17 : 20}
                  color={inputText.trim() === '' ? (colors.inputIcon || '#8E8E93') : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </KeyboardAvoidingView>

      {/* Message Options Overlay Menu */}
      <MessageOptionsMenu
        visible={optionsVisible}
        onClose={() => {
          setOptionsVisible(false);
          setSelectedMessage(null);
        }}
        onSelectReaction={handleSelectReaction}
        onPressPlus={handlePressPlus}
        onSelectOption={handleSelectOption}
        message={selectedMessage}
      />

      {/* Full Emoji Picker Sheet */}
      <EmojiPickerSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelectEmoji={isReactionMode ? handleSelectReaction : handleTextEmojiSelect}
      />

      {/* Attachment Bottom Sheet picker */}
      <AttachmentSheet
        visible={attachmentVisible}
        onClose={() => setAttachmentVisible(false)}
        onSelectImage={handleSendImage}
        onOpenPoll={() => setCreatePollVisible(true)}
      />

      {/* Create Poll Modal */}
      <CreatePollModal
        visible={createPollVisible}
        onClose={() => setCreatePollVisible(false)}
        onCreatePoll={handleCreatePoll}
      />

      {/* Sticker Bottom Sheet grid */}
      <StickerPicker
        visible={stickerVisible}
        onClose={() => setStickerVisible(false)}
        onSelectSticker={handleSendSticker}
      />

      {/* Poll Results Modal */}
      <PollResultsModal
        visible={pollResultsVisible}
        onClose={() => {
          setPollResultsVisible(false);
          setSelectedPollForResults(null);
        }}
        poll={selectedPollForResults}
      />

      {/* Paid Communication Confirmation Modal */}
      <PaidCommunicationConfirmModal
        visible={showPaidModal}
        communicationType={paidModalType}
        ratePerMinute={paidModalType === 'VIDEO' ? 10 : paidModalType === 'AUDIO' ? 5 : 1}
        currentBalance={balance}
        recipientName={displayName}
        onConfirm={handleConfirmPaidSession}
        onCancel={() => {
          setShowPaidModal(false);
          setPaidModalType('MESSAGE');
        }}
        loading={paidLoading}
      />

      {/* Paid Communication Receipt Modal */}
      <PaidSessionReceiptModal
        visible={showReceiptModal}
        sessionData={receiptData}
        onClose={() => setShowReceiptModal(false)}
        onViewTransactions={() => {
          setShowReceiptModal(false);
          router.push('/transactions');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradientBackground: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heart: {
    position: 'absolute',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 3,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  headerBadgeWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 0,
  },
  headerPaidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerPaidPillActive: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  paidPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paidPillTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginRight: 6,
  },
  paidPillTitleActive: {
    color: '#E11D48',
  },
  paidPillStatus: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  paidPillStatusOff: {
    backgroundColor: '#E2E8F0',
  },
  paidPillStatusOn: {
    backgroundColor: '#10B981',
  },
  paidPillStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  paidPillStatusTextOff: {
    color: '#64748B',
  },
  paidPillStatusTextOn: {
    color: '#FFFFFF',
  },
  paidPillDivider: {
    fontSize: 10,
    color: '#94A3B8',
    marginHorizontal: 6,
  },
  paidPillRate: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  paidPillRateActive: {
    color: '#BE123C',
    fontWeight: '600',
  },
  paidPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lowBalancePillSmall: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  lowBalancePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    paddingRight: 8,
    marginLeft: -4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E1E1E1',
  },
  headerMeta: {
    marginLeft: 10,
    justifyContent: 'center',
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 6,
    marginLeft: 6,
  },
  keyboardView: {
    flex: 1,
    zIndex: 1,
  },
  messageList: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE5EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  dateSeparatorContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateSeparator: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  dateSeparatorText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  floatingScrollBottomBtn: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    backgroundColor: '#FF2E63',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 99,
  },
  floatingBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  paidChatOffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  paidChatOffBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  paidChatOffBannerText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  paidChatOffStartBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  paidChatOffStartBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  inputLeftColumn: {
    flex: 1,
    marginRight: 10,
  },
  textInput: {
    fontSize: 15,
    color: '#000000',
    minHeight: 24,
    padding: 0,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#F2F2F7',
    paddingTop: 6,
  },
  inputIcon: {
    padding: 3,
    marginRight: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sentStickerContainer: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    marginRight: 16,
    alignItems: 'flex-end',
  },
  receivedStickerContainer: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginLeft: 16,
    alignItems: 'flex-start',
  },
  stickerEmojiText: {
    fontSize: 64,
  },
  stickerTimeText: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
  },
  recordingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
    flex: 1,
  },
  recordingCancel: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
