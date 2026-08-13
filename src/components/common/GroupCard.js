import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 52) / 2;  // 2 columns, 16px side padding + 20px gap
const CARD_HEIGHT = 250;

export default function GroupCard({ item }) {
  const { badgeLabel, imageUri, name, statusColor = '#34C759', adminName } = item;

  return (
    <TouchableOpacity
      style={styles.cardWrapper}
      activeOpacity={0.88}
    >
      {/* Outer border/glow ring */}
      <View style={styles.cardContainer}>

        {/* Background Image */}
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />

        {/* Top badge — dark frosted pill centered at top */}
        <View style={styles.topBadge}>
          <Text style={styles.topBadgeText}>{badgeLabel}</Text>
        </View>

        {/* Middle "+Add in Group" frosted pill */}
        <View style={styles.addBtnWrap}>
          <TouchableOpacity style={styles.addInGroupBtn} activeOpacity={0.8}>
            <Text style={styles.addInGroupText}>+Add in Group</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom dark gradient scrim */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.88)']}
          style={styles.scrim}
        >
          {/* Name + status dot row */}
          <View style={styles.nameRow}>
            <Text style={styles.nameText} numberOfLines={1}>
              {name}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>

          {/* Admin name */}
          <Text style={styles.adminText} numberOfLines={1}>
            {adminName}
          </Text>
        </LinearGradient>

      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: CARD_WIDTH,
    marginBottom: 18,
    // Shadow sits on the wrapper so it's not clipped
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  cardContainer: {
    width: '100%',
    height: CARD_HEIGHT,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#C8C8D0',
    // Thin light border matching the screenshot's card edge glow
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },

  /* ── Top badge ── */
  topBadge: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(10,10,10,0.80)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  topBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* ── +Add in Group button (middle) ── */
  addBtnWrap: {
    position: 'absolute',
    bottom: 80,          // sits roughly in the middle of the image area above the scrim
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  addInGroupBtn: {
    backgroundColor: 'rgba(255,255,255,0.30)',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.50)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  addInGroupText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  /* ── Bottom scrim + text ── */
  scrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  adminText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
