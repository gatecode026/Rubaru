import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function QuickActionAvatar({ label, imageUri, showPlus, onPress }) {
  const { isDarkMode } = useTheme();

  const ringColors = showPlus
    ? isDarkMode
      ? ['#1C1C1E', '#3A3A3C']
      : ['#FF2E63', '#FF758F']
    : ['#E2E8F0', '#CBD5E1'];

  const plusBadgeColors = isDarkMode ? ['#1C1C1E', '#000000'] : ['#FF2E63', '#E63956'];

  return (
    <TouchableOpacity style={styles.container} activeOpacity={0.82} onPress={onPress}>
      <LinearGradient
        colors={ringColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradientRing,
          isDarkMode && showPlus && styles.gradientRingDark,
        ]}
      >
        <View style={styles.avatarInner}>
          <Image source={{ uri: imageUri }} style={styles.avatarImage} resizeMode="cover" />
          {showPlus && (
            <LinearGradient
              colors={plusBadgeColors}
              style={styles.plusBadge}
            >
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </LinearGradient>
          )}
        </View>
      </LinearGradient>
      <Text style={[styles.labelText, isDarkMode && styles.labelTextDark]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginRight: 18,
    width: 72,
  },
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  gradientRingDark: {
    shadowColor: '#000000',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  plusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  labelText: {
    fontSize: 11.5,
    color: '#340E1B',
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  labelTextDark: {
    color: '#000000',
  },
});
