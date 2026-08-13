import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function EmptyCallLogsView() {
  return (
    <LinearGradient
      colors={['#FFF5F5', '#FFEBF0', '#FFD9E0']}
      style={styles.gradientContainer}
    >
      {/* Decorative faint watermark hearts on top-left */}
      <View style={styles.watermarkContainer} pointerEvents="none">
        <Ionicons
          name="heart"
          size={36}
          color="#FFC9D4"
          style={[styles.heart, { top: 20, left: 12, transform: [{ rotate: '-15deg' }], opacity: 0.2 }]}
        />
        <Ionicons
          name="heart"
          size={22}
          color="#FFC9D4"
          style={[styles.heart, { top: 60, left: 6, transform: [{ rotate: '15deg' }], opacity: 0.15 }]}
        />
        <Ionicons
          name="heart"
          size={28}
          color="#FFC9D4"
          style={[styles.heart, { top: 40, left: 45, transform: [{ rotate: '-5deg' }], opacity: 0.18 }]}
        />
      </View>

      <View style={styles.centeredContent}>
        <Ionicons name="call" size={54} color="#000000" style={styles.phoneIcon} />
        <Text style={styles.titleText}>No Call Logs Yet</Text>
        <Text style={styles.subtitleText}>
          Make or receive calls to see your call history listed here
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
    position: 'relative',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  heart: {
    position: 'absolute',
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: -40, // Visual centering adjustment
  },
  phoneIcon: {
    marginBottom: 24,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
});
