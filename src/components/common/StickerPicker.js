import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  FlatList,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Standard emoji sticker pack
const STICKER_PACK = [
  '🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁',
  '🐸', '🐵', '🦄', '🐝', '🦖', '🐙', '🦈', '🦉',
  '🍎', '🍋', '🍔', '🍟', '🍕', '🍩', '🍪', '☕️',
  '⚽️', '🏀', '🎮', '🛹', '🎸', '🎨', '🚀', '💡',
  '❤️', '🔥', '🎉', '🌈', '💯', '✨', '💩', '👻',
];

export default function StickerPicker({ visible, onClose, onSelectSticker }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              <View style={styles.dragHandle} />
              
              <Text style={styles.sheetTitle}>Send Sticker</Text>

              <FlatList
                data={STICKER_PACK}
                keyExtractor={(item, index) => `${item}-${index}`}
                numColumns={5}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.stickerCell}
                    onPress={() => {
                      onSelectSticker(item);
                      onClose();
                    }}
                  >
                    <Text style={styles.stickerEmoji}>{item}</Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 380,
    paddingTop: 12,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 32,
  },
  stickerCell: {
    width: `${100 / 5}%`, // 5 column grid
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  stickerEmoji: {
    fontSize: 48, // Large scale emoji as stickers
  },
});
