import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function StoryModeTab({ title, isActive, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.container}
      onPress={onPress}
    >
      <Text style={[styles.text, isActive && styles.activeText]}>
        {title}
      </Text>
      {isActive && <View style={styles.underline} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  activeText: {
    color: '#FFFFFF',
  },
  underline: {
    marginTop: 6,
    height: 2,
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 1,
  },
});
