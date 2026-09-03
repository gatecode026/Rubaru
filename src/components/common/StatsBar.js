import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

function formatStatValue(val) {
  if (val === undefined || val === null) return '0';
  if (typeof val === 'string') return val;
  const n = Number(val);
  if (isNaN(n) || n <= 0) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function StatColumn({ icon, value, label, showDivider, onPress }) {
  const content = (
    <View style={styles.columnContent}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>
      <Text style={styles.valueText}>{formatStatValue(value)}</Text>
      <Text style={styles.labelText}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.columnContainer}>
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onPress}
          style={{ flex: 1 }}
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
      {showDivider && <View style={styles.verticalDivider} />}
    </View>
  );
}

export default function StatsBar({
  likes = 0,
  connections = 0,
  views = 0,
  onLikesPress,
  onConnectionsPress,
  onViewsPress,
}) {
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
        onPress={onLikesPress}
      />
      <StatColumn
        icon="people-outline"
        value={connections}
        label="Connections"
        showDivider={true}
        onPress={onConnectionsPress}
      />
      <StatColumn
        icon="eye-outline"
        value={views}
        label="Profile Views"
        showDivider={false}
        onPress={onViewsPress}
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
