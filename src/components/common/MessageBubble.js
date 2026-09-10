import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function MessageBubble({
  text,
  time,
  isSent,
  isRead,
  status = 'sent', // 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  onLongPress,
  onRetry,
  reaction,
  replyTo,
  isGroupedAbove = false,
  isGroupedBelow = false,
}) {
  const { isDarkMode, colors } = useTheme();

  const isFailed = status === 'failed';
  const isSending = status === 'sending';
  const isReadReceipt = status === 'read' || status === 'READ' || isRead;
  const isDeliveredReceipt = status === 'delivered' || status === 'DELIVERED';

  if (isSent) {
    return (
      <View
        style={[
          styles.sentContainer,
          isGroupedBelow ? styles.groupedBelowContainer : null,
        ]}
      >
        <TouchableOpacity
          style={[
            styles.sentBubble,
            { backgroundColor: isFailed ? '#EF4444' : (colors.bubbleSent || '#FF6584') },
            isGroupedAbove && styles.sentGroupedAbove,
            isGroupedBelow && styles.sentGroupedBelow,
          ]}
          activeOpacity={0.9}
          onLongPress={onLongPress}
          onPress={isFailed && onRetry ? onRetry : undefined}
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
            
            {/* Status indicators */}
            {isSending && (
              <Ionicons
                name="time-outline"
                size={14}
                color="#FFF0F3"
                style={styles.statusIcon}
              />
            )}
            
            {isFailed && (
              <Ionicons
                name="alert-circle"
                size={14}
                color="#FFFFFF"
                style={styles.statusIcon}
              />
            )}

            {!isSending && !isFailed && isReadReceipt && (
              <Ionicons
                name="checkmark-done"
                size={15}
                color="#34D399" // Bright teal-green read receipt
                style={styles.statusIcon}
              />
            )}

            {!isSending && !isFailed && !isReadReceipt && isDeliveredReceipt && (
              <Ionicons
                name="checkmark-done"
                size={15}
                color="#FFF0F3" // Double white/grey tick for delivered
                style={styles.statusIcon}
              />
            )}

            {!isSending && !isFailed && !isReadReceipt && !isDeliveredReceipt && (
              <Ionicons
                name="checkmark"
                size={15}
                color="#FFF0F3" // Server acknowledged sent
                style={styles.statusIcon}
              />
            )}
          </View>

          {isFailed && (
            <Text style={styles.retryText}>Failed. Tap to retry.</Text>
          )}
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
    <View
      style={[
        styles.receivedContainer,
        isGroupedBelow ? styles.groupedBelowContainer : null,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.receivedBubble,
          {
            backgroundColor: colors.bubbleReceived || '#FFFFFF',
            borderColor: isDarkMode ? '#3F3F46' : '#F3F4F6',
          },
          isGroupedAbove && styles.receivedGroupedAbove,
          isGroupedBelow && styles.receivedGroupedBelow,
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
    marginBottom: 8,
    marginRight: 16,
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    marginBottom: 8,
    marginLeft: 16,
  },
  groupedBelowContainer: {
    marginBottom: 3,
  },
  sentBubble: {
    backgroundColor: '#FF6584',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4, // sharper tail
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  sentGroupedAbove: {
    borderTopRightRadius: 8,
  },
  sentGroupedBelow: {
    borderBottomRightRadius: 8,
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4, // sharper tail
    borderBottomRightRadius: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  receivedGroupedAbove: {
    borderTopLeftRadius: 8,
  },
  receivedGroupedBelow: {
    borderBottomLeftRadius: 8,
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  sentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  sentTimeText: {
    color: '#FFE4E8',
    fontSize: 11,
    marginRight: 2,
    fontWeight: '400',
  },
  statusIcon: {
    marginLeft: 3,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
    textDecorationLine: 'underline',
  },
  receivedText: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  receivedTimeText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'right',
    fontWeight: '400',
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
    marginBottom: 6,
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
