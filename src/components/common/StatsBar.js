import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

function StatColumn({ icon, value, label, showDivider }) {
  return (
    <View style={styles.columnContainer}>
      <View style={styles.columnContent}>
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

export default function StatsBar({ likes, connections, views }) {
  return (
    <LinearGradient
      colors={['#FFD9E0', '#FFB8C6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.statsBanner}
    >
      <StatColumn
        icon="heart-outline"
        value={likes}
        label="Likes"
        showDivider={true}
      />
      <StatColumn
        icon="people-outline"
        value={connections}
        label="Connections"
        showDivider={true}
      />
      <StatColumn
        icon="eye-outline"
        value={views}
        label="Profile Views"
        showDivider={false}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  statsBanner: {
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 24,
    shadowColor: '#F04452',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  columnContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  columnContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  iconWrapper: {
    marginBottom: 4,
  },
  valueText: {
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
    marginTop: 2,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#211C1E',
    marginTop: 2,
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1.5,
    height: '65%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});
