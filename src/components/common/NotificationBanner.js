import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getSocket } from '../../services/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NotificationBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [currentNotif, setCurrentNotif] = useState(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewNotification = (data) => {
      if (!data) return;
      showNotification(data);
    };

    const handleIncomingChatMessage = (rawMsg) => {
      if (!rawMsg) return;
      const msg = rawMsg.data?.message || rawMsg.message || rawMsg;
      const chatId = msg.chatId || msg.conversationId || msg.chat;
      const senderName = msg.senderName || msg.sender?.displayName || msg.sender?.name || 'Rubaru User';
      const avatarUri = msg.senderAvatar || msg.sender?.avatarUri || '';
      const text = msg.text || (msg.type === 'image' || msg.type === 'IMAGE' ? '📷 Sent a photo' : (msg.type === 'voice' || msg.type === 'VOICE_NOTE' ? '🎤 Sent a voice message' : 'Sent a message'));

      showNotification({
        id: `banner_msg_${msg.id || msg._id || Date.now()}`,
        type: 'CHAT_MESSAGE',
        sender: {
          displayName: senderName,
          avatarUri,
        },
        message: text,
        deepLink: `rubaru://chat/${chatId}`,
      });
    };

    socket.on('notification:new', handleNewNotification);
    socket.on('receive_message', handleIncomingChatMessage);
    socket.on('new_message', handleIncomingChatMessage);

    return () => {
      socket.off('notification:new', handleNewNotification);
      socket.off('receive_message', handleIncomingChatMessage);
      socket.off('new_message', handleIncomingChatMessage);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const showNotification = (notif) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    setCurrentNotif(notif);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
        stiffness: 120,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      hideNotification();
    }, 4500);
  };

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentNotif(null);
    });
  };

  const handlePress = () => {
    if (!currentNotif) return;
    const notif = currentNotif;
    hideNotification();

    if (notif.deepLink) {
      const route = notif.deepLink.replace('rubaru://', '/');
      try {
        router.push(route);
        return;
      } catch (e) {
        console.warn('[NOTIF BANNER] Failed to route to deepLink:', route);
      }
    }
    router.push('/notification');
  };

  if (!currentNotif) return null;

  const senderName = currentNotif.sender?.displayName || currentNotif.sender?.username || 'Rubaru';
  const avatarUri = currentNotif.sender?.avatarUri;
  const message = currentNotif.message || 'You have a new notification';
  const previewThumbnail = currentNotif.previewThumbnailUri;

  const getIconForType = () => {
    const type = currentNotif.type;
    if (type === 'call' || type === 'CALL') return 'call';
    if (type === 'missed_call' || type === 'MISSED_CALL') return 'call-outline';
    if (type?.includes('LIKE')) return 'heart';
    if (type?.includes('COMMENT')) return 'chatbubble';
    if (type?.includes('MESSAGE') || type?.includes('CHAT')) return 'chatbubble-ellipses';
    if (type?.includes('FOLLOW')) return 'person-add';
    return 'notifications';
  };

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          top: Math.max(insets.top, 12),
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchableCard}
        activeOpacity={0.9}
        onPress={handlePress}
      >
        {/* Left: Avatar with Type Badge */}
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Ionicons name="person" size={20} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.badgePill}>
            <Ionicons name={getIconForType()} size={11} color="#FFFFFF" />
          </View>
        </View>

        {/* Center: Text Details */}
        <View style={styles.textContainer}>
          <Text style={styles.senderTitle} numberOfLines={1}>
            {senderName}
          </Text>
          <Text style={styles.messageBody} numberOfLines={2}>
            {message}
          </Text>
        </View>

        {/* Right: Content Thumbnail or Close */}
        {previewThumbnail ? (
          <Image source={{ uri: previewThumbnail }} style={styles.thumbnailPreview} />
        ) : (
          <TouchableOpacity
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={hideNotification}
          >
            <Ionicons name="close" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 99999,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  touchableCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  defaultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePill: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF2E63',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  senderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  messageBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  thumbnailPreview: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  closeBtn: {
    padding: 4,
  },
});
