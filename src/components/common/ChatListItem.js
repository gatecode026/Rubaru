import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../theme';

export default function ChatListItem({ item }) {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const {
    name,
    avatarUrl,
    initials,
    isUber,
    onlineStatus, // 'green' | 'orange' | null
    time,
    sender,
    unreadCount = 0,
    hasMention,
    messageType, // 'text' | 'video' | 'photo' | 'audio' | 'poll' | 'emoji' | 'thread'
    messageText,
    mentionUser,
    hasAlert,
    isFromMe,
    status, // 'SENT' | 'DELIVERED' | 'READ'
    hasLastMessage = true,
  } = item;

  const hasUnread = unreadCount > 0;

  const renderAvatar = () => {
    if (isUber) {
      return (
        <View style={[styles.avatarContainer, styles.uberAvatar]}>
          <Text style={styles.uberText}>Uber</Text>
        </View>
      );
    }
    if (initials) {
      return (
        <View style={[styles.avatarContainer, styles.initialsAvatar]}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
      );
    }
    return (
      <View style={styles.avatarWrapper}>
        {avatarUrl && avatarUrl.trim() !== '' ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={[styles.avatarImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={22} color="#9CA3AF" />
          </View>
        )}
        {onlineStatus === 'green' && (
          <View style={[styles.statusDot, styles.greenDot, { borderColor: colors.background }]} />
        )}
        {onlineStatus === 'orange' && (
          <View style={[styles.statusDot, styles.orangeDot, { borderColor: colors.background }]} />
        )}
      </View>
    );
  };

  const renderStatusTick = () => {
    if (!isFromMe) return null;

    if (status === 'READ') {
      return (
        <Ionicons
          key="status-tick"
          name="checkmark-done"
          size={16}
          color="#34B7F1"
          style={styles.inlineTick}
        />
      );
    }
    if (status === 'DELIVERED') {
      return (
        <Ionicons
          key="status-tick"
          name="checkmark-done"
          size={16}
          color="#8E8E93"
          style={styles.inlineTick}
        />
      );
    }
    // SENT or default
    return (
      <Ionicons
        key="status-tick"
        name="checkmark"
        size={16}
        color="#8E8E93"
        style={styles.inlineTick}
      />
    );
  };

  const renderMessageContent = () => {
    if (!hasLastMessage && !messageText) {
      return (
        <View style={styles.messageRow}>
          <Text style={[styles.emptyPreviewText, { color: colors.textSecondary || '#8E8E93' }]}>
            Start a conversation
          </Text>
        </View>
      );
    }

    const content = [];

    // Outgoing status tick (Single/Double check)
    const tickElement = renderStatusTick();
    if (tickElement) {
      content.push(tickElement);
    }

    if (sender && !isFromMe) {
      content.push(
        <Text key="sender" style={[styles.senderText, { color: colors.textSecondary }]}>
          {sender}:{' '}
        </Text>
      );
    }

    if (hasAlert) {
      content.push(
        <Ionicons
          key="alert"
          name="alert-circle"
          size={15}
          color="#FF3B30"
          style={styles.inlineIcon}
        />
      );
    }

    // Media type icons
    if (messageType === 'photo' || messageType === 'image') {
      content.push(
        <Ionicons
          key="photo-icon"
          name="camera"
          size={15}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'video') {
      content.push(
        <Ionicons
          key="video-icon"
          name="videocam"
          size={15}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'audio' || messageType === 'voice') {
      content.push(
        <Ionicons
          key="mic-icon"
          name="mic"
          size={15}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'poll') {
      content.push(
        <Ionicons
          key="poll-icon"
          name="stats-chart"
          size={14}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'thread') {
      content.push(
        <Ionicons
          key="thread-icon"
          name="return-down-forward"
          size={15}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    }

    if (mentionUser) {
      content.push(
        <View key="mention" style={[styles.mentionPill, { backgroundColor: isDarkMode ? '#3B2A1E' : '#FFE8CC' }]}>
          <Text style={styles.mentionText}>@{mentionUser}</Text>
        </View>
      );
    }

    const previewColor = hasUnread
      ? (isDarkMode ? '#F2F2F7' : '#1F2937')
      : (colors.textSecondary || '#8E8E93');

    content.push(
      <Text
        key="main-text"
        style={[
          styles.messageText,
          { color: previewColor, fontWeight: hasUnread ? '600' : '400' },
        ]}
        numberOfLines={1}
      >
        {messageText || (messageType === 'photo' ? 'Photo' : messageType === 'video' ? 'Video' : messageType === 'audio' ? 'Voice message' : 'Start a conversation')}
      </Text>
    );

    return <View style={styles.messageRow}>{content}</View>;
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.background }]}
      activeOpacity={0.65}
      onPress={() => {
        if (typeof item.onOpen === 'function') {
          item.onOpen(item.id);
        }
        router.push({
          pathname: `/chat/${item.id}`,
          params: {
            name: item.name,
            avatarUrl: item.avatarUrl || '',
            recipientId: item.recipientId ? String(item.recipientId) : '',
          },
        });
      }}
    >
      {renderAvatar()}
      <View style={styles.middleContainer}>
        <View style={styles.topNameRow}>
          <Text style={[styles.nameText, { color: colors.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          <Text
            style={[
              styles.timeText,
              { color: hasUnread ? '#25D366' : (colors.textSecondary || '#8E8E93'), fontWeight: hasUnread ? '700' : '400' },
            ]}
          >
            {time}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.messageContentWrapper}>{renderMessageContent()}</View>
          <View style={styles.badgeRow}>
            {hasMention && (
              <View style={[styles.mentionBadge, { backgroundColor: isDarkMode ? '#2B2745' : '#E8E6FF' }]}>
                <Ionicons name="at" size={13} color="#7C3AED" />
              </View>
            )}
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    width: 52,
    height: 52,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
  },
  uberAvatar: {
    backgroundColor: '#000000',
  },
  uberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  initialsAvatar: {
    backgroundColor: '#B19FFB',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  greenDot: {
    backgroundColor: '#25D366',
  },
  orangeDot: {
    backgroundColor: '#FF9500',
  },
  middleContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  topNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageContentWrapper: {
    flex: 1,
    marginRight: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  inlineTick: {
    marginRight: 4,
    alignSelf: 'center',
  },
  inlineIcon: {
    marginRight: 4,
    alignSelf: 'center',
  },
  mentionPill: {
    backgroundColor: '#FFE8CC',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
    marginRight: 4,
  },
  mentionText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyPreviewText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  mentionBadge: {
    marginRight: 4,
    backgroundColor: '#E8E6FF',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#25D366', // WhatsApp green badge
    paddingHorizontal: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
