import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MessageBubble({ text, time, isSent, isRead, onLongPress, reaction, replyTo }) {
  if (isSent) {
    return (
      <View style={styles.sentContainer}>
        <TouchableOpacity
          style={styles.sentBubble}
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

          <Text style={styles.sentText}>{text}</Text>
          <View style={styles.sentInfoRow}>
            <Text style={styles.sentTimeText}>{time}</Text>
            {isRead && (
              <Ionicons
                name="checkmark-done"
                size={16}
                color="#34C759" // Green read receipt checkmark
                style={styles.checkIcon}
              />
            )}
          </View>
        </TouchableOpacity>
        {reaction && (
          <View style={[styles.reactionBadge, styles.sentReaction]}>
            <Text style={styles.reactionBadgeText}>{reaction}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.receivedContainer}>
      <TouchableOpacity
        style={styles.receivedBubble}
        activeOpacity={0.9}
        onLongPress={onLongPress}
      >
        {/* Quoted Reply Box */}
        {replyTo && (
          <View style={[styles.quotedBox, styles.quotedBoxReceived]}>
            <View style={[styles.quotedAccent, styles.quotedAccentReceived]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.quotedSender, styles.quotedSenderReceived]}>{replyTo.senderName}</Text>
              <Text style={[styles.quotedText, styles.quotedTextReceived]} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.receivedText}>{text}</Text>
      </TouchableOpacity>
      {reaction && (
        <View style={[styles.reactionBadge, styles.receivedReaction]}>
          <Text style={styles.reactionBadgeText}>{reaction}</Text>
        </View>
      )}
      <Text style={styles.receivedTimeText}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sentContainer: {
    alignSelf: 'flex-end',
    maxWidth: '78%',
    marginBottom: 10,
    marginRight: 16,
  },
  sentBubble: {
    backgroundColor: '#1C1C1E', // Dark slate black
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4, // sharper corner tail
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  sentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  sentTimeText: {
    color: '#AEAEB2',
    fontSize: 10,
    marginRight: 2,
  },
  checkIcon: {
    marginLeft: 2,
  },
  receivedContainer: {
    alignSelf: 'flex-start',
    maxWidth: '78%',
    marginBottom: 10,
    marginLeft: 16,
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  receivedText: {
    color: '#000000',
    fontSize: 15,
    lineHeight: 20,
  },
  receivedTimeText: {
    color: '#8E8E93',
    fontSize: 10,
    marginTop: 4,
    marginLeft: 4,
  },
  reactionBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  quotedBoxReceived: {
    backgroundColor: '#F2F2F7',
  },
  quotedAccent: {
    width: 3,
    borderRadius: 1.5,
    marginRight: 8,
  },
  quotedAccentSent: {
    backgroundColor: '#FF2D55',
  },
  quotedAccentReceived: {
    backgroundColor: '#FF2D55',
  },
  quotedSender: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  quotedSenderSent: {
    color: '#FF2D55',
  },
  quotedSenderReceived: {
    color: '#FF2D55',
  },
  quotedText: {
    fontSize: 12,
  },
  quotedTextSent: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quotedTextReceived: {
    color: '#636366',
  },
});
