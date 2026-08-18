import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PostCommentsModal from './PostCommentsModal';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;

export default function ReelItem({ item, height, onBackPress }) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [likeCount, setLikeCount] = useState(item.likeCount || 8223);
  const [isFollowing, setIsFollowing] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleReport = () => {
    setOptionsVisible(false);
    showToast('🚩 Reel reported for review. Thank you!');
  };

  const handleInterested = () => {
    setOptionsVisible(false);
    showToast("✨ Marked as Interested. We'll show more reels like this.");
  };

  const handleNotInterested = () => {
    setOptionsVisible(false);
    showToast("🚫 Marked as Not Interested. We'll tune your feed.");
  };

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
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={() => setCommentsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="View comments"
        >
          <Ionicons name="chatbubble-ellipses-outline" size={30} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{item.commentCount ?? 82}</Text>
        </TouchableOpacity>

        {/* Call / Share */}
        <TouchableOpacity style={styles.actionItem} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={28} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{item.shareCount ?? 23}</Text>
        </TouchableOpacity>

        {/* Three-dot more */}
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={() => setOptionsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="More reel options"
        >
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
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/user-profile')}
            style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}
          >
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
          </TouchableOpacity>
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

      {/* Post Comments Bottom Sheet Modal */}
      <PostCommentsModal
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
        postAuthor={item.userName}
        postAuthorAvatar={item.userAvatar}
        postCaption={item.caption || 'Watch full reel and leave a comment!'}
        postImageUri={item.imageUri}
      />

      {/* 3-Dot More Options Bottom Sheet Modal */}
      <Modal
        visible={optionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <View style={styles.optionsModalOverlay}>
          {/* Backdrop Tap to Close */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setOptionsVisible(false)}
          />

          <View style={[styles.optionsSheet, isDarkMode && styles.optionsSheetDark]}>
            {/* Grab Handle */}
            <View style={styles.optionsGrabHandle} />

            {/* Option 1: Report */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={handleReport}
              accessibilityRole="button"
              accessibilityLabel="Report Reel"
            >
              <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="flag-outline" size={20} color="#EF4444" />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, { color: '#EF4444' }]}>Report</Text>
                <Text style={styles.optionSub}>Report inappropriate or offensive content</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            {/* Option 2: Interested */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={handleInterested}
              accessibilityRole="button"
              accessibilityLabel="Interested in Reel"
            >
              <View
                style={[
                  styles.optionIconWrap,
                  { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 46, 99, 0.1)' },
                ]}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={20}
                  color={isDarkMode ? '#000000' : '#FF2E63'}
                />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, isDarkMode && { color: '#111827' }]}>Interested</Text>
                <Text style={styles.optionSub}>We'll show you more reels like this</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            {/* Option 3: Not Interested */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={handleNotInterested}
              accessibilityRole="button"
              accessibilityLabel="Not Interested in Reel"
            >
              <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(107, 114, 128, 0.1)' }]}>
                <Ionicons name="eye-off-outline" size={20} color="#4B5563" />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, isDarkMode && { color: '#111827' }]}>Not Interested</Text>
                <Text style={styles.optionSub}>Hide this reel and show fewer like it</Text>
              </View>
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelBtn}
              activeOpacity={0.8}
              onPress={() => setOptionsVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
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
    bottom: 90,
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
    bottom: 90,
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

  /* ── 3-Dot Options Bottom Sheet Modal ── */
  optionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  optionsSheetDark: {
    backgroundColor: '#FFFFFF',
  },
  optionsGrabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionIconWrapLight: {
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
  },
  optionIconWrapDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  optionSub: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(229, 231, 235, 0.8)',
    marginLeft: 56,
  },
  cancelBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },

  /* ── Floating Toast ── */
  toastContainer: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    maxWidth: SCREEN_WIDTH - 48,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
