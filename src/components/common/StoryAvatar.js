import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function StoryAvatar({ name, imageUrl, isFirst }) {
  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.8}>
      <View style={styles.avatarWrapper}>
        <View style={styles.ringBorder}>
          <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
        </View>
        {isFirst && (
          <View style={styles.plusBadge}>
            <Ionicons name="add" size={14} color="#FFF" />
          </View>
        )}
      </View>
      <Text style={styles.nameText} numberOfLines={1} ellipsizeMode="tail">
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
    borderColor: '#FF8A65', // Rose-gold / peach ring color matching the reference image
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
    bottom: 2,
    right: 2,
    backgroundColor: '#FF3B30', // iOS Red
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameText: {
    marginTop: 6,
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
    width: '100%',
  },
});
