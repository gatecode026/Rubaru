import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ReplyPreviewBar({ replyingTo, displayName, onClose }) {
  if (!replyingTo) return null;

  const senderName = replyingTo.isSent ? 'You' : (displayName || 'Rahul Kumawat');

  const getSnippetText = () => {
    if (replyingTo.text) return replyingTo.text;
    if (replyingTo.type === 'image') return '📷 Photo';
    if (replyingTo.type === 'voice') return '🎤 Voice message';
    if (replyingTo.type === 'sticker') return `Sticker ${replyingTo.sticker || ''}`;
    if (replyingTo.type === 'poll') return `📊 Poll: ${replyingTo.question}`;
    return 'Message';
  };

  return (
    <View style={styles.container}>
      {/* Left accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.contentColumn}>
        <Text style={styles.senderName}>{senderName}</Text>
        <Text style={styles.snippetText} numberOfLines={1}>
          {getSnippetText()}
        </Text>
      </View>

      {/* Dismiss / cancel reply button */}
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close-circle" size={20} color="#8E8E93" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9FB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  accentBar: {
    width: 3.5,
    height: '100%',
    minHeight: 34,
    backgroundColor: '#FF2D55', // Vibrant WhatsApp-style pink accent bar
    borderRadius: 2,
    marginRight: 10,
  },
  contentColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2D55',
    marginBottom: 2,
  },
  snippetText: {
    fontSize: 13,
    color: '#3A3A3C',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
