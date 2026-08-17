import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

export default function PointsUsageIcon({ icon, borderColor, borderWidth = 1, label, cost, IconComponent, iconSize = 24, iconColor, imageSource }) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { borderColor: borderColor, borderWidth: borderWidth }]}>
        {imageSource ? (
          <Image source={imageSource} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
        ) : IconComponent ? (
          <IconComponent name={icon} size={iconSize} color={iconColor} />
        ) : null}
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={styles.cost}>{cost}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 62,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  cost: {
    fontSize: 11,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 2,
  },
});
