import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SERIF_FONT = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export default function ProfileStatColumn({ icon, value, label, showDivider = true }) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.valueText}>{value}</Text>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      {showDivider && <View style={styles.verticalDivider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  iconWrapper: {
    marginBottom: 4,
  },
  valueText: {
    fontFamily: SERIF_FONT,
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginTop: 2,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#111827',
    marginTop: 2,
  },
  verticalDivider: {
    width: 1,
    height: '65%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
