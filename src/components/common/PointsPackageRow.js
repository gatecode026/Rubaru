import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

export default function PointsPackageRow({ points, price, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={styles.container} onPress={onPress}>
      <View style={styles.leftSection}>
        <View style={styles.iconBadge}>
          <Image
            source={require('@assets/images/glyphs-poly_heart.png')}
            style={styles.heartIcon}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.pointsText}>{points} Points</Text>
      </View>
      <View style={styles.pricePill}>
        <Text style={styles.priceText}>{price}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFEBF0',
    borderWidth: 1,
    borderColor: '#FFC5D3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  pointsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  pricePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFC5D3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  heartIcon: {
    width: 16,
    height: 16,
  },
});
