import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const QUICK_REACTIONS = ['😍', '🔥', '🥳', '👍', '❤️'];

export default function MessageOptionsMenu({
  visible,
  onClose,
  onSelectReaction,
  
  onPressPlus,
  onSelectOption,
  message,
}) {
  if (!visible || !message) return null;
  const isSent = message.isSent;

  const getPreviewText = () => {
    if (message.text) return message.text;
    if (message.type === 'image') return '📷 Photo';
    if (message.type === 'voice') return `🎤 Voice Note (${message.duration || '00:32'})`;
    if (message.type === 'sticker') return `Sticker ${message.sticker}`;
    if (message.type === 'poll') return `📊 Poll: ${message.question}`;
    return 'Message';
  };

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <View style={styles.modalOverlay}>
        <BlurView intensity={75} style={StyleSheet.absoluteFill} tint="light" />
        <TouchableWithoutFeedback>
          <View style={styles.menuContainer}>
            {/* Quick Reactions Bar (Top) */}
            <View style={styles.reactionsBar}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionButton}
                  onPress={() => onSelectReaction(emoji)}
                >
                  <Text style={styles.reactionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.reactionButton, styles.plusButton]}
                onPress={onPressPlus}
              >
                <Ionicons name="add" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            {/* Highlighted message bubble preview (Middle) */}
            <View style={isSent ? styles.previewBubbleSent : styles.previewBubbleReceived}>
              <Text style={isSent ? styles.previewTextSent : styles.previewTextReceived}>
                {getPreviewText()}
              </Text>
            </View>

            {/* Options list card (Bottom) */}
            <View style={styles.optionsCard}>
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => onSelectOption('info')}
              >
                <Text style={styles.optionLabel}>Info</Text>
                <Ionicons name="information-circle-outline" size={22} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => onSelectOption('copy')}
              >
                <Text style={styles.optionLabel}>Copy</Text>
                <Ionicons name="copy-outline" size={20} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => onSelectOption('edit')}
              >
                <Text style={styles.optionLabel}>Edit</Text>
                <Ionicons name="pencil-outline" size={20} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => onSelectOption('reply')}
              >
                <Text style={styles.optionLabel}>Reply in Thread</Text>
                <Ionicons name="return-down-forward" size={22} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionItem, styles.lastOptionItem]}
                onPress={() => onSelectOption('delete')}
              >
                <Text style={[styles.optionLabel, styles.deleteLabel]}>Delete</Text>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // light background overlay for blur
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999, // sits on top of everything
  },
  menuContainer: {
    width: SCREEN_WIDTH * 0.85,
  },
  previewBubbleSent: {
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewBubbleReceived: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTextSent: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  previewTextReceived: {
    color: '#000000',
    fontSize: 15,
    lineHeight: 20,
  },
  reactionsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  reactionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  reactionText: {
    fontSize: 24,
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F2F2F7',
  },
  lastOptionItem: {
    borderBottomWidth: 0,
  },
  optionLabel: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  deleteLabel: {
    color: '#FF3B30',
  },
});
