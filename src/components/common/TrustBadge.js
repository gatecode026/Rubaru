import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TrustBadge({ icon, title, subtext, iconColor, bgColor }) {
  return (
    <View style={styles.badgeContainer}>
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.titleText}>{title}</Text>
      <Text style={styles.subtextText}>{subtext}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtextText: {
    fontSize: 9,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 12,
  },
});
