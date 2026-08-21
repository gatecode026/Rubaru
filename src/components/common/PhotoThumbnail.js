import React from 'react';
import { Image, StyleSheet, Pressable } from 'react-native';

export default function PhotoThumbnail({ uri, fallback, onPress }) {
  const source = uri ? { uri } : fallback;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.thumbnailContainer, pressed && styles.pressed]}
    >
      <Image
        source={source}
        style={styles.image}
        resizeMode="cover"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumbnailContainer: {
    width: 115,
    height: 145,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
