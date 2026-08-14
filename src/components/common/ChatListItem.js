import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ChatListItem({ item }) {
  const router = useRouter();
  const {
    name,
    avatarUrl,
    initials,
    isUber,
    onlineStatus, // 'green' | 'orange' | null
    time,
    sender,
    unreadCount,
    hasMention,
    messageType, // 'text' | 'video' | 'photo' | 'audio' | 'emoji' | 'thread'
    messageText,
    mentionUser, // e.g. "Robert"
    hasAlert,
  } = item;

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
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        {onlineStatus === 'green' && <View style={[styles.statusDot, styles.greenDot]} />}
        {onlineStatus === 'orange' && <View style={[styles.statusDot, styles.orangeDot]} />}
      </View>
    );
  };

  const renderMessageContent = () => {
    const content = [];

    if (sender) {
      content.push(
        <Text key="sender" style={styles.senderText}>
          {sender}:{' '}
        </Text>
      );
    }

    if (hasAlert) {
      content.push(
        <Ionicons
          key="alert"
          name="alert-circle"
          size={16}
          color="#FF3B30"
          style={styles.inlineIcon}
        />
      );
    }

    if (messageType === 'video') {
      content.push(
        <Ionicons
          key="video-icon"
          name="videocam"
          size={16}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'photo') {
      content.push(
        <Ionicons
          key="check-icon"
          name="checkmark-done"
          size={16}
          color="#5856D6" // Indigo/blue read checkmark
          style={styles.inlineIcon}
        />
      );
      content.push(
        <Ionicons
          key="photo-icon"
          name="image"
          size={16}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'audio') {
      content.push(
        <Ionicons
          key="mic-icon"
          name="mic"
          size={16}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    } else if (messageType === 'emoji') {
      content.push(
        <Ionicons
          key="check-icon"
          name="checkmark-done"
          size={16}
          color="#5856D6"
          style={styles.inlineIcon}
        />
      );
      content.push(
        <Text key="emoji-face" style={styles.emojiText}>
          😍{' '}
        </Text>
      );
    } else if (messageType === 'thread') {
      content.push(
        <Ionicons
          key="thread-icon"
          name="return-down-forward"
          size={16}
          color="#8E8E93"
          style={styles.inlineIcon}
        />
      );
    }

    if (mentionUser) {
      content.push(
        <View key="mention" style={styles.mentionPill}>
          <Text style={styles.mentionText}>@{mentionUser}</Text>
        </View>
      );
    }

    content.push(
      <Text key="main-text" style={styles.messageText} numberOfLines={1}>
        {messageText}
      </Text>
    );

    return <View style={styles.messageRow}>{content}</View>;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: `/chat/${item.id}`,
          params: { name: item.name, avatarUrl: item.avatarUrl || '' },
        });
      }}
    >
      {renderAvatar()}
      <View style={styles.middleContainer}>
        <Text style={styles.nameText} numberOfLines={1}>
          {name}
        </Text>
        {renderMessageContent()}
      </View>
      <View style={styles.rightContainer}>
        <Text style={styles.timeText}>{time}</Text>
        <View style={styles.badgeRow}>
          {hasMention && (
            <View style={styles.mentionBadge}>
              <Ionicons name="at" size={14} color="#5856D6" />
            </View>
          )}
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20, // Added to fix edge congestion
    alignItems: 'flex-start', // Align to top of cell for standard look
  },
  avatarWrapper: {
    position: 'relative',
    width: 56,
    height: 56,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E1E1E1',
  },
  uberAvatar: {
    backgroundColor: '#000000',
  },
  uberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  initialsAvatar: {
    backgroundColor: '#B19FFB', // Soft violet purple
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 18,
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  greenDot: {
    backgroundColor: '#34C759',
  },
  orangeDot: {
    backgroundColor: '#FF9500',
  },
  middleContainer: {
    flex: 1,
    marginLeft: 16,
    paddingTop: 2, // Aligns text height with avatar top
  },
  nameText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8E8E93',
  },
  inlineIcon: {
    marginRight: 4,
  },
  emojiText: {
    fontSize: 14,
    marginRight: 2,
  },
  mentionPill: {
    backgroundColor: '#FFE8CC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },
  mentionText: {
    color: '#FF9500',
    fontSize: 12,
    fontWeight: '600',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
  },
  rightContainer: {
    alignItems: 'flex-end',
    marginLeft: 12,
    minWidth: 60,
    paddingTop: 2, // Aligns time height with avatar top
  },
  timeText: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mentionBadge: {
    marginRight: 6,
    backgroundColor: '#E8E6FF',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
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
    fontWeight: 'bold',
  },
});
