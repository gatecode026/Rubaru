import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';

export default function PlanCard({
  points,
  price,
  originalPrice,
  discount,
  description,
  features,
  isMostPopular,
  onPress,
}) {
  const [expanded, setExpanded] = useState(false);
  const { colors, isDarkMode } = useTheme();
  const accentColor = isDarkMode ? '#000000' : '#F04452';

  const getFeatureIcon = (iconName) => {
    switch (iconName) {
      case 'heart':
        return { name: 'heart', color: isDarkMode ? '#000000' : '#F04452', bgColor: isDarkMode ? 'rgba(0,0,0,0.06)' : '#FFE1E8' };
      case 'chatbubble-ellipses':
        return { name: 'chatbubble-ellipses', color: '#8B5CF6', bgColor: '#E5D5F5' };
      case 'eye':
        return { name: 'eye', color: '#EF4444', bgColor: '#F5D5D5' };
      case 'star':
        return { name: 'star', color: '#FBBF24', bgColor: '#F5E5D5' };
      default:
        return { name: 'star', color: '#B0B0B0', bgColor: '#F3F4F6' };
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => setExpanded(!expanded)}
    >
      {/* Top Row: Icon + Points + Pricing */}
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          <View style={[styles.heartBadge, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.06)' : '#FFE1E8' }]}>
            <Image
              source={require('@assets/images/glyphs-poly_heart.png')}
              style={styles.heartIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.pointsInfo}>
            <Text style={[styles.pointsNumber, { color: colors.textPrimary }]}>{points}</Text>
            <Text style={[styles.pointsSubtext, { color: colors.textMuted }]}> My Points</Text>
          </View>
        </View>

        <View style={styles.rightSection}>
          {isMostPopular && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>🔥 Most Popular</Text>
            </View>
          )}
          <View style={styles.pricingRow}>
            <Text style={[styles.priceText, { color: accentColor }]}>{price}</Text>
            <Text style={[styles.originalPriceText, { color: colors.textMuted }]}>{originalPrice}</Text>
            <View style={[styles.discountBadge, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.06)' : '#FFE1E8' }]}>
              <Text style={[styles.discountText, { color: accentColor }]}>{discount}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Description Text */}
      <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{description}</Text>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      {/* Collapsible Features Section */}
      {expanded && (
        <View style={styles.expandedWrapper}>
          <View style={styles.featuresList}>
            {features.map((feat, index) => {
              const iconConfig = getFeatureIcon(feat.icon);
              return (
                <View key={index} style={styles.featureItem}>
                  <View style={[styles.featureCircle, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : iconConfig.bgColor }]}>
                    <Ionicons name={iconConfig.name} size={15} color={isDarkMode ? '#FFFFFF' : iconConfig.color} />
                  </View>
                  <View>
                    <Text style={[styles.featureLabel, { color: colors.textPrimary }]}>{feat.label}</Text>
                    <Text style={[styles.featureValue, { color: colors.textMuted }]}>{feat.value}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={[styles.innerDivider, { backgroundColor: colors.divider }]} />
        </View>
      )}

      {/* Bottom Row: View Details Link (Left) & Buy Now Button (Right) */}
      <View style={styles.bottomRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.detailsLink}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={[styles.detailsText, { color: accentColor }]}>{expanded ? 'Hide Details' : 'View Details'}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-forward'}
            size={14}
            color={accentColor}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.buyNowButton, { backgroundColor: accentColor }]}
          onPress={(e) => {
            // Prevent triggering the card's expanded state toggle
            e.stopPropagation();
            onPress();
          }}
        >
          <Text style={styles.buyNowText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE1E8',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFE1E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  heartIcon: {
    width: 22,
    height: 22,
  },
  pointsInfo: {
    justifyContent: 'center',
  },
  pointsNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    lineHeight: 28,
  },
  pointsSubtext: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  popularBadge: {
    backgroundColor: '#FFE8CC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FF9500',
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F04452',
    marginRight: 6,
  },
  originalPriceText: {
    fontSize: 12,
    color: '#B0B0B0',
    textDecorationLine: 'line-through',
    marginRight: 6,
  },
  discountBadge: {
    backgroundColor: '#FFE1E8',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F04452',
  },
  descriptionText: {
    fontSize: 12,
    color: '#636E72',
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 12,
  },
  expandedWrapper: {
    width: '100%',
  },
  featuresList: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  featureLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#000000',
  },
  featureValue: {
    fontSize: 9,
    color: '#8E8E93',
    marginTop: 1,
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#F5F5F5',
    marginVertical: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  detailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F04452',
    marginRight: 4,
  },
  buyNowButton: {
    backgroundColor: '#F04452',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F04452',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buyNowText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
