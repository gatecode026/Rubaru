import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

export default function HistoryRow({ item }) {
  const { type, callType, date, duration } = item;

  const isOutgoing = callType === 'outgoing';
  const isMissed = callType === 'missed' || callType === 'missed-x';

  const renderIcon = () => {
    if (isOutgoing) {
      return <Feather name="arrow-up-right" size={20} color="#34C759" style={styles.icon} />;
    } else if (isMissed) {
      return <Feather name="arrow-down-left" size={20} color="#FF3B30" style={styles.icon} />;
    } else {
      // Incoming
      return <Feather name="arrow-down-left" size={20} color="#FF3B30" style={styles.icon} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {renderIcon()}
        <View style={styles.textColumn}>
          <Text style={styles.typeText}>{type}</Text>
          <Text style={styles.dateText}>{date}</Text>
        </View>
      </View>
      <Text style={styles.durationText}>{duration}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 14,
  },
  textColumn: {
    justifyContent: 'center',
  },
  typeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  durationText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
});
