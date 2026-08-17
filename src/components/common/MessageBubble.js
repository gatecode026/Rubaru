import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function MessageBubble({ text, time, isSent, isRead, onLongPress, reaction, replyTo }) {
  const { isDarkMode, colors } = useTheme();

  if (isSent) {
    return (
      <View style={styles.sentContainer}>
        <TouchableOpacity
          style={[
            styles.sentBubble,
            { backgroundColor: colors.bubbleSent || '#FF6584' },
          ]}
          activeOpacity={0.9}
          onLongPress={onLongPress}
        >
          {/* Quoted Reply Box */}
          {replyTo && (
            <View style={[styles.quotedBox, styles.quotedBoxSent]}>
              <View style={[styles.quotedAccent, styles.quotedAccentSent]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.quotedSender, styles.quotedSenderSent]}>{replyTo.senderName}</Text>
                <Text style={[styles.quotedText, styles.quotedTextSent]} numberOfLines={1}>
                  {replyTo.text}
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.sentText, { color: colors.bubbleSentText || '#FFFFFF' }]}>{text}</Text>
          <View style={styles.sentInfoRow}>
            <Text style={[styles.sentTimeText, { color: colors.bubbleSentTime || '#FFF0F3' }]}>{time}</Text>
            {isRead && (
              <Ionicons
                name="checkmark-done"
                size={16}
                color="#10B981" // Green read receipt checkmark as in reference image
                style={styles.checkIcon}
              />
            )}
          </View>
        </TouchableOpacity>
        {reaction && (
          <View style={[styles.reactionBadge, styles.sentReaction, { backgroundColor: isDarkMode ? '#27272A' : '#FFFFFF' }]}>
            <Text style={styles.reactionBadgeText}>{reaction}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.receivedContainer}>
      <TouchableOpacity
        style={[
          styles.receivedBubble,
          {
            backgroundColor: colors.bubbleReceived || '#FFFFFF',
            borderColor: isDarkMode ? '#3F3F46' : '#F3F4F6',
          },
        ]}
        activeOpacity={0.9}
        onLongPress={onLongPress}
      >
        {/* Quoted Reply Box */}
        {replyTo && (
          <View style={[styles.quotedBox, { backgroundColor: isDarkMode ? '#2D2D32' : '#F2F2F7' }]}>
            <View style={[styles.quotedAccent, { backgroundColor: '#FF2E63' }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.quotedSender, { color: '#FF2E63' }]}>{replyTo.senderName}</Text>
              <Text style={[styles.quotedText, { color: colors.textSecondary }]} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.receivedText, { color: colors.bubbleReceivedText || '#111827' }]}>{text}</Text>
        <Text style={[styles.receivedTimeText, { color: colors.bubbleReceivedTime || '#9CA3AF' }]}>{time}</Text>
      </TouchableOpacity>
      {reaction && (
        <View style={[styles.reactionBadge, styles.receivedReaction, { backgroundColor: isDarkMode ? '#27272A' : '#FFFFFF' }]}>
          <Text style={styles.reactionBadgeText}>{reaction}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sentContainer: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    marginBottom: 12,
    marginRight: 16,
  },
  sentBubble: {
    backgroundColor: '#FF6584',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 6, // sharper corner tail
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  sentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  sentTimeText: {
    color: '#FFE4E8',
    fontSize: 11,
    marginRight: 2,
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 2,
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginBottom: 12,
    marginLeft: 16,
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  receivedText: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  receivedTimeText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
    fontWeight: '500',
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -8,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F2F2F7',
  },
  sentReaction: {
    right: 12,
  },
  receivedReaction: {
    left: 12,
  },
  reactionBadgeText: {
    fontSize: 12,
  },
  quotedBox: {
    flexDirection: 'row',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  quotedBoxSent: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  quotedAccent: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  quotedAccentSent: {
    backgroundColor: '#FFFFFF',
  },
  quotedSender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  quotedSenderSent: {
    color: '#FFFFFF',
  },
  quotedText: {
    fontSize: 12,
  },
  quotedTextSent: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
