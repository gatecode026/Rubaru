import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function QuickActionAvatar({ label, imageUri, showPlus, onPress }) {
  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.8} onPress={onPress}>
      <View style={styles.avatarWrapper}>
        <Image source={{ uri: imageUri }} style={styles.avatarImage} resizeMode="cover" />
        {showPlus && (
          <View style={styles.plusBadge}>
            <Ionicons name="add" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text style={styles.labelText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 18,
  },
  avatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#F0D8E3',
    padding: 2,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  plusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E63956',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 11,
    color: '#4A1528',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
