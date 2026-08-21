import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DetailChip({ icon, label }) {
  return (
    <View style={styles.chipContainer}>
      <Ionicons name={icon} size={20} color="#F04452" style={styles.icon} />
      <Text style={styles.labelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F6',
    borderWidth: 1,
    borderColor: '#F9C2CB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    margin: 4,
    minWidth: '46%',
  },
  icon: {
    marginRight: 12,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
});
