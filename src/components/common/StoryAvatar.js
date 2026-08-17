import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function StoryAvatar({ name, imageUrl, isFirst }) {
  const { colors, isDarkMode } = useTheme();

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.8}>
      <View style={styles.avatarWrapper}>
        <View style={[styles.ringBorder, { borderColor: colors.storyRing || (isDarkMode ? '#FF8A65' : '#FF2E63') }]}>
          <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
        </View>
        {isFirst && (
          <View style={[styles.plusBadge, { backgroundColor: colors.storyPlusBg || (isDarkMode ? '#FF3B30' : '#FF2E63') }]}>
            <Ionicons name="add" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text style={[styles.nameText, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 16,
    width: 72,
  },
  avatarWrapper: {
    position: 'relative',
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringBorder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#FF8A65',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E1E1E1',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  nameText: {
    marginTop: 6,
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    width: '100%',
    fontWeight: '500',
  },
});
