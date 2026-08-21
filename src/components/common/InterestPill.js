import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InterestPill({ icon, label }) {
  return (
    <View style={styles.chipContainer}>
      <Ionicons name={icon} size={16} color="#F04452" style={styles.icon} />
      <Text style={styles.labelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F4A9B5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  icon: {
    marginRight: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
});
