import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function EmptyStateIllustration() {
  return (
    <View style={styles.container}>
      {/* Row 1 (Top Left) */}
      <View style={[styles.cardRow, styles.rowTop]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.initialsText}>SF</Text>
        </View>
        <View style={styles.linesContainer}>
          <View style={[styles.lineShort, { width: 55 }]} />
          <View style={[styles.lineLong, { width: 135 }]} />
        </View>
      </View>

      {/* Row 2 (Middle Right Staggered) */}
      <View style={[styles.cardRow, styles.rowMiddle]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.initialsText}>VN</Text>
        </View>
        <View style={styles.linesContainer}>
          <View style={[styles.lineShort, { width: 60 }]} />
          <View style={[styles.lineLong, { width: 145 }]} />
        </View>
      </View>

      {/* Row 3 (Bottom Left) */}
      <View style={[styles.cardRow, styles.rowBottom]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.initialsText}>MS</Text>
        </View>
        <View style={styles.linesContainer}>
          <View style={[styles.lineShort, { width: 50 }]} />
          <View style={[styles.lineLong, { width: 130 }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    width: 280,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  rowTop: {
    alignSelf: 'flex-start',
    marginLeft: 10,
  },
  rowMiddle: {
    alignSelf: 'flex-end',
    marginRight: 10,
    marginTop: 10,
  },
  rowBottom: {
    alignSelf: 'flex-start',
    marginLeft: 10,
    marginTop: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#545456',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  linesContainer: {
    justifyContent: 'center',
  },
  lineShort: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D1D1D6',
    marginBottom: 5,
  },
  lineLong: {
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#8E8E93',
  },
});
