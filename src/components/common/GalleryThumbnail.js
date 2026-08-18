import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GalleryThumbnail({
  imageUri,
  duration,
  isSelected,
  selectionMode,
  onPress,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={styles.container}
      onPress={onPress}
    >
      <Image source={{ uri: imageUri }} style={styles.image} />
      
      {/* Video Duration Badge */}
      {duration && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{duration}</Text>
        </View>
      )}

      {/* Selection Indicator */}
      {selectionMode && (
        <View style={styles.selectionIndicatorWrapper}>
          <View
            style={[
              styles.selectionIndicator,
              isSelected && styles.selectionIndicatorActive,
            ]}
          >
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        </View>
      )}
      
      {/* Dim overlay when selected */}
      {selectionMode && isSelected && <View style={styles.selectedOverlay} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    aspectRatio: 3 / 4,
    margin: 1.5,
    backgroundColor: '#2A2424',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  selectionIndicatorWrapper: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
  selectionIndicator: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorActive: {
    backgroundColor: '#F04452',
    borderColor: '#F04452',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
