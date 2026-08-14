import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function InterestChip({ label, emoji, isSelected, onPress }) {
  return (
    <TouchableOpacity
      style={[
        styles.chipContainer,
        isSelected ? styles.selectedChip : styles.unselectedChip,
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Text style={styles.emojiText}>{emoji}</Text>
      <Text
        style={[
          styles.labelText,
          isSelected ? styles.selectedText : styles.unselectedText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 22,
    marginRight: 8,
    marginBottom: 10,
  },
  unselectedChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6C6D6', // Lavender-pink thin border matching screenshot
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedChip: {
    backgroundColor: '#FF2A55', // Vibrant hot pink fill matching screenshot
    borderWidth: 1,
    borderColor: '#FF2A55',
    shadowColor: '#FF2A55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  emojiText: {
    fontSize: 14,
    marginRight: 6,
  },
  labelText: {
    fontSize: 14,
  },
  unselectedText: {
    color: '#4B182B', // Dark purple-maroon font color
    fontWeight: '600',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
