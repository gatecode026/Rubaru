import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

export default function NewUserCard({ item }) {
  const { isDarkMode } = useTheme();
  const { name, age, city, distance, imageUri, isNew = true, isOnline = false } = item;

  return (
    <TouchableOpacity style={styles.cardContainer} activeOpacity={0.9}>
      {/* Background Image */}
      <Image source={{ uri: imageUri }} style={styles.cardImage} resizeMode="cover" />

      {/* "NEW" Badge */}
      {isNew && (
        <View style={[styles.newBadge, isDarkMode && styles.newBadgeDark]}>
          <Text style={styles.newBadgeText}>NEW</Text>
        </View>
      )}

      {/* Bottom Scrim & Info Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.85)']}
        style={styles.scrimOverlay}
      >
        {/* Distance Pill */}
        <View style={styles.distancePill}>
          <Text style={styles.distanceText}>{distance}</Text>
        </View>

        {/* Name, Age & Online Status Dot */}
        <View style={styles.nameRow}>
          <Text style={styles.nameText}>
            {name}, {age}
          </Text>
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        {/* City Name */}
        <Text style={styles.cityText}>{city}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: 135,
    height: 185,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: '#E1E1E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: '#E63956', // Vibrant crimson-pink badge
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeDark: {
    backgroundColor: '#000000', // Black badge in dark mode
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  scrimOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 40,
    justifyContent: 'flex-end',
  },
  distancePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  distanceText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#34C759',
    marginLeft: 5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  cityText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
