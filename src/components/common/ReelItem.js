import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;

export default function ReelItem({ item, height, onBackPress }) {
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [likeCount, setLikeCount] = useState(item.likeCount || 8223);
  const [isFollowing, setIsFollowing] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleLikeToggle = () => {
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const imageSource = imageError
    ? { uri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800' }
    : { uri: item.imageUri };

  const formatCount = (n) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Gradient colour fallback shown behind image */}
      <LinearGradient
        colors={item.bgGradient || ['#3A1A2E', '#0D0509']}
        style={StyleSheet.absoluteFill}
      />

      {/* Full-bleed background photo */}
      <Image
        source={imageSource}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => setImageError(true)}
      />

      {/* ── Top dark-to-transparent scrim so header text is legible ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.10)', 'transparent']}
        style={styles.topScrim}
        pointerEvents="none"
      />

      {/* ── Bottom transparent-to-dark scrim so info text is legible ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.78)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* ═══════════════════  HEADER  ═══════════════════ */}
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 6 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.75}
          onPress={onBackPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Reels</Text>

        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="camera-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* ═══════════════════  RIGHT ACTION RAIL  ═══════════════════ */}
      <View style={styles.actionRail}>
        {/* Like */}
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={handleLikeToggle}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={32}
            color={isLiked ? '#FF3B30' : '#FFFFFF'}
          />
          <Text style={styles.actionLabel}>{likeCount.toLocaleString()}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{item.commentCount ?? 82}</Text>
        </TouchableOpacity>

        {/* Call / Share */}
        <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={28} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{item.shareCount ?? 23}</Text>
        </TouchableOpacity>

        {/* Three-dot more */}
        <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
          <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Mini audio square thumbnail */}
        <TouchableOpacity style={styles.audioThumb} activeOpacity={0.8}>
          <Image
            source={{ uri: item.audioThumbnail || item.userAvatar }}
            style={styles.audioThumbImg}
          />
          <View style={styles.audioRedDot} />
        </TouchableOpacity>
      </View>

      {/* ═══════════════════  BOTTOM INFO  ═══════════════════ */}
      <View style={styles.bottomInfo}>
        {/* User row */}
        <View style={styles.userRow}>
          <Image source={{ uri: item.userAvatar }} style={styles.userAvatar} />
          <Text style={styles.userName} numberOfLines={1}>
            {item.userName}
          </Text>
          {item.isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={16}
              color="#3897F0"
              style={styles.verifiedIcon}
            />
          )}
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            activeOpacity={0.8}
            onPress={() => setIsFollowing((f) => !f)}
          >
            <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <Text style={styles.caption} numberOfLines={2}>
          {item.caption}
        </Text>

        {/* Liked-by */}
        <Text style={styles.likedBy}>
          {'Liked by '}
          <Text style={styles.likedByBold}>{item.likedBy}</Text>
        </Text>

        {/* Tag pills */}
        <View style={styles.pillsRow}>
          <View style={styles.pill}>
            <Ionicons name="musical-note" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.pillText}>{item.audioTrack || 'zanderwhitehu'}</Text>
          </View>

          <View style={styles.pill}>
            <Ionicons name="person" size={11} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.pillText}>3 people</Text>
          </View>

          <View style={styles.pillSmall}>
            <Text style={styles.pillText}>+1</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },

  /* ── Scrim overlays ── */
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 1,
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
    zIndex: 1,
  },

  /* ── Header ── */
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* ── Right action rail ── */
  actionRail: {
    position: 'absolute',
    right: 10,
    bottom: 40,
    zIndex: 10,
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    marginBottom: 22,
  },

  actionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  audioThumb: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    marginTop: 4,
  },
  audioThumbImg: {
    width: '100%',
    height: '100%',
  },
  audioRedDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },

  /* ── Bottom info block ── */
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 68,
    bottom: 40,
    zIndex: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginRight: 8,
    backgroundColor: '#555',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  verifiedIcon: {
    marginLeft: 4,
    marginRight: 2,
  },
  followBtn: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 16,
    marginLeft: 8,
  },
  followingBtn: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtnText: {
    color: '#000000',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  likedBy: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 12,
    marginBottom: 10,
  },
  likedByBold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 7,
    marginBottom: 4,
  },
  pillSmall: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 4,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
