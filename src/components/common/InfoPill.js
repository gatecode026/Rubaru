import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InfoPill({ icon, label }) {
  return (
    <View style={styles.chipContainer}>
      <Ionicons name={icon} size={20} color="#F04452" style={styles.icon} />
      <Text style={styles.labelText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chipContainer: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1.2,
    borderColor: '#F4A9B5',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 5,
  },
  icon: {
    marginRight: 12,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
});
