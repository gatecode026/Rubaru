import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, Platform, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
 
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
const CORAL = '#F04452';
 
// Tune these two if the scoop doesn't sit exactly right on your device —
// measured from the reference: the LEFT corner cuts in deeper/wider,
// the RIGHT corner is a shallower, smaller scoop.
const RADIUS_LEFT_RATIO = 0.19;
const RADIUS_RIGHT_RATIO = 0.13;
const HERO_ASPECT_RATIO = 1.25; // hero height = screenWidth * this - taller to prevent title overlap
const CARD_OVERLAP_RATIO = 0.135; // how far the quote card overlaps up into the hero
 
export default function HeroCurvedHeader({
  uri,
  name,
  age,
  location,
  distance,
  tags = [],
  insets = { top: 0 },
  onBack,
  onSettings,
}) {
  const { width: SCREEN_WIDTH } = useWindowDimensions();
  const [imageError, setImageError] = React.useState(false);

  const heroHeight = Math.round(SCREEN_WIDTH * HERO_ASPECT_RATIO);
  const radiusLeft = Math.round(SCREEN_WIDTH * RADIUS_LEFT_RATIO);
  const radiusRight = Math.round(SCREEN_WIDTH * RADIUS_RIGHT_RATIO);
  const cardOverlap = Math.round(SCREEN_WIDTH * CARD_OVERLAP_RATIO);

  let imageSource;
  if (imageError || !uri) {
    imageSource = require('../../assets/images/profile-hero.jpg');
  } else if (typeof uri === 'string') {
    imageSource = { uri };
  } else {
    imageSource = uri;
  }
 
  return (
    <View
      style={[
        styles.container,
        {
          height: heroHeight,
          borderBottomLeftRadius: radiusLeft,
          borderBottomRightRadius: radiusRight,
        },
      ]}
    >
      <Image
        source={imageSource}
        onError={() => setImageError(true)}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
 
      {/* Dark scrim so overlay text stays legible over any photo */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.6)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
 
      {/* Header row */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => [styles.circleBtn, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>
 
        <Text style={styles.headerTitle}>About Me</Text>
 
        <Pressable
          onPress={onSettings}
          hitSlop={10}
          style={({ pressed }) => [styles.circleBtn, pressed && styles.pressed]}
        >
          <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
        </Pressable>
      </View>
 
      {/* Overlay text block — sits well above the corner scoops, clear of the quote card */}
      <View style={[styles.overlayBlock, { bottom: cardOverlap + 44 }]}>
        <View style={styles.nameRow}>
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
        </View>
 
        <Text style={styles.subText}>
          {age} • {location}
        </Text>
 
        <View style={styles.distanceRow}>
          <Ionicons name="location" size={13} color={CORAL} />
          <Text style={styles.distanceText}>{distance}</Text>
        </View>
 
        <View style={styles.tagsRow}>
          {tags.map((tag, idx) => (
            <View key={idx} style={styles.tagPill}>
              <Ionicons name={tag.icon} size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.tagText}>{tag.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
 
const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1A1414',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
  headerTitle: {
    fontFamily: SERIF,
    fontSize: 19,
    color: '#FFFFFF',
  },
  overlayBlock: {
    position: 'absolute',
    left: 22,
    right: 22,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontFamily: SERIF,
    fontSize: 29,
    fontWeight: '700',
    color: '#FFFFFF',
    maxWidth: '75%',
  },
  verifiedBadge: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: CORAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  subText: {
    fontSize: 15,
    color: '#F2F2F2',
    marginTop: 6,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  distanceText: {
    fontSize: 13,
    color: CORAL,
    fontWeight: '600',
    marginLeft: 3,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12.5,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
