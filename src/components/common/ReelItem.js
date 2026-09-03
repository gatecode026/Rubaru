import React, { useState, useRef, useEffect, Component } from 'react';
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
  ActivityIndicator,
  Share,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import PostCommentsModal from './PostCommentsModal';
import { useTheme } from '../../theme';
import api from '../../services/api';
import interactionService from '../../services/interactionService';
import { getSocket } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;

class VideoErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.log('[VIDEO PLAYER SAFE RECOVERY]', error.message || error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function ReelVideoPlayer({ videoUri, isMuted, style }) {
  const player = useVideoPlayer(videoUri, (p) => {
    try {
      p.loop = true;
      p.muted = Boolean(isMuted);
      p.play();
    } catch (e) {}
  });

  useEffect(() => {
    if (!player) return;
    try {
      player.muted = Boolean(isMuted);
      player.play();
    } catch (e) {}

    return () => {
      try {
        player.pause();
        player.muted = true;
      } catch (e) {}
    };
  }, [player, isMuted]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

function SafeVideoPlayer({ videoUri, isActive, isPlaying, isMuted, style, fallback }) {
  // If not actively focused on screen or playback is paused, only render the static image fallback
  if (!isActive || !isPlaying || !videoUri || typeof videoUri !== 'string') {
    return fallback;
  }

  return (
    <VideoErrorBoundary fallback={fallback}>
      <ReelVideoPlayer
        videoUri={videoUri}
        isMuted={isMuted}
        style={style}
      />
    </VideoErrorBoundary>
  );
}

export default function ReelItem({ item, height, isActive = true, onBackPress }) {
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlayIconBadge, setShowPlayIconBadge] = useState(false);
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [likeCount, setLikeCount] = useState(item.likeCount || 0);
  const [commentCount, setCommentCount] = useState(item.commentCount || 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isSaved, setIsSaved] = useState(item.isSaved || false);
  const [imageError, setImageError] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    async function loadCurrentUserId() {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) return;
        const parts = token.split('.');
        if (parts.length >= 2) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          let decodedStr = '';
          if (typeof atob === 'function') {
            decodedStr = atob(base64);
          } else if (typeof Buffer !== 'undefined') {
            decodedStr = Buffer.from(base64, 'base64').toString('utf8');
          }
          if (decodedStr) {
            const data = JSON.parse(decodedStr);
            if (data.id || data.userId) {
              setCurrentUserId(String(data.id || data.userId));
            }
          }
        }
      } catch (e) {}
    }
    loadCurrentUserId();
  }, []);

  const isOwnReel = Boolean(
    item.isOwner ||
    (currentUserId && item.authorId && String(currentUserId) === String(item.authorId)) ||
    (currentUserId && item.userId && String(currentUserId) === String(item.userId))
  );

  useEffect(() => {
    setIsLiked(Boolean(item.isLiked));
    setLikeCount(Number(item.likeCount) || 0);
    setCommentCount(Number(item.commentCount) || 0);
  }, [item.id, item.isLiked, item.likeCount, item.commentCount]);

  useEffect(() => {
    if (!isActive) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }
  }, [isActive]);

  // Real-time Like and Comment updates via Socket.io
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !item.id) return;

    const handleLikeUpdated = (data) => {
      if (data && (String(data.reelId) === String(item.id) || String(data.contentId) === String(item.id))) {
        setLikeCount(Number(data.likesCount) || 0);
      }
    };

    const handleCommentAdded = (data) => {
      if (data && (String(data.reelId) === String(item.id) || String(data.contentId) === String(item.id))) {
        setCommentCount(Number(data.commentsCount) || 0);
      }
    };

    const handleCommentDeleted = (data) => {
      if (data && (String(data.reelId) === String(item.id) || String(data.contentId) === String(item.id))) {
        setCommentCount(Number(data.commentsCount) || 0);
      }
    };

    socket.on('reel_like_updated', handleLikeUpdated);
    socket.on('content_like_updated', handleLikeUpdated);
    socket.on('reel_comment_added', handleCommentAdded);
    socket.on('post_comment_added', handleCommentAdded);
    socket.on('reel_comment_deleted', handleCommentDeleted);
    socket.on('post_comment_deleted', handleCommentDeleted);

    return () => {
      socket.off('reel_like_updated', handleLikeUpdated);
      socket.off('content_like_updated', handleLikeUpdated);
      socket.off('reel_comment_added', handleCommentAdded);
      socket.off('post_comment_added', handleCommentAdded);
      socket.off('reel_comment_deleted', handleCommentDeleted);
      socket.off('post_comment_deleted', handleCommentDeleted);
    };
  }, [item.id]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleTogglePlayPause = () => {
    setIsPlaying((prev) => {
      const next = !prev;
      setShowPlayIconBadge(true);
      setTimeout(() => setShowPlayIconBadge(false), 800);
      return next;
    });
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleLikeToggle = async () => {
    const targetId = item.id || item.postId || item._id;
    if (!targetId) return;

    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikeCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (nextState) {
        const res = await interactionService.likeContent(targetId);
        if (res?.data?.likesCount !== undefined) {
          setLikeCount(res.data.likesCount);
        }
      } else {
        const res = await interactionService.unlikeContent(targetId);
        if (res?.data?.likesCount !== undefined) {
          setLikeCount(res.data.likesCount);
        }
      }
    } catch (e) {
      console.log('[LIKE TOGGLE ERROR]', e.message);
      // Rollback on network failure
      setIsLiked(!nextState);
      setLikeCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleShare = async () => {
    try {
      const url = item.videoUri || item.imageUri || 'https://rubaru.app';
      await Share.share({
        message: `Check out this reel by ${item.userName} on Rubaru ✨ ${item.caption || ''} ${url}`,
        title: 'Rubaru Reel',
      });
    } catch (err) {
      console.log('[SHARE ERROR]', err.message);
    }
  };

  const handleFollowToggle = async () => {
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    showToast(nextFollowing ? `✨ Following ${item.userName}` : `Unfollowed ${item.userName}`);
    try {
      if (item.authorId) {
        await api.post(`/social/follow/${item.authorId}`);
      }
    } catch (err) {
      console.log('[FOLLOW ERROR]', err.message);
    }
  };

  const handleSaveToggle = async () => {
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    setOptionsVisible(false);
    showToast(nextSaved ? '🔖 Reel saved to your collection!' : 'Removed from saved collection');
    try {
      const targetId = item.id || item.postId || item._id;
      if (targetId) {
        await api.post(`/social/save/${targetId}`);
      }
    } catch (err) {
      console.log('[SAVE REEL ERROR]', err.message);
    }
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

  const handleOpenUserProfile = () => {
    if (isOwnReel) {
      router.push('/user-profile');
    } else if (item.authorId) {
      router.push({
        pathname: '/user-profile',
        params: { userId: item.authorId },
      });
    } else {
      router.push('/user-profile');
    }
  };

  const handleCallCreator = () => {
    if (item.authorId) {
      router.push({
        pathname: '/call',
        params: {
          calleeId: item.authorId,
          calleeName: item.userName || 'Creator',
          calleeAvatar: item.userAvatar || '',
          callType: 'audio',
        },
      });
    } else {
      showToast(`📞 Connecting call with ${item.userName}...`);
    }
  };

  const videoUri = item.videoUri || '';
  const imageUri = item.imageUri || '';

  const formatCount = (n) => {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Background Gradient fallback */}
      <LinearGradient
        colors={item.bgGradient || ['#1F0E18', '#080306']}
        style={StyleSheet.absoluteFill}
      />

      {/* Video or Static Poster */}
      <SafeVideoPlayer
        videoUri={videoUri}
        isActive={isActive}
        isPlaying={isPlaying}
        isMuted={isMuted}
        style={StyleSheet.absoluteFill}
        fallback={
          imageUri && !imageError ? (
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <LinearGradient
              colors={['#1F0E18', '#080306']}
              style={StyleSheet.absoluteFill}
            />
          )
        }
      />

      {/* Tap Gesture to Play/Pause */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleTogglePlayPause}
      >
        {showPlayIconBadge && (
          <View style={styles.centerPlayBadge}>
            <Ionicons
              name={isPlaying ? 'play' : 'pause'}
              size={54}
              color="#FFFFFF"
            />
          </View>
        )}
      </Pressable>

      {/* ── Top dark-to-transparent scrim so header text is legible ── */}
      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.15)', 'transparent']}
        style={styles.topScrim}
        pointerEvents="none"
      />

      {/* ── Bottom transparent-to-dark scrim so info text is legible ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.85)']}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* ═══════════════════  HEADER  ═══════════════════ */}
      <View style={[styles.header, { paddingTop: STATUS_BAR_HEIGHT + 6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBackPress && (
            <TouchableOpacity
              style={[styles.headerBtn, { marginRight: 8 }]}
              activeOpacity={0.75}
              onPress={onBackPress}
            >
              <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Reels</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Mute/Unmute Toggle */}
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.75}
            onPress={handleToggleMute}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isMuted ? 'volume-mute-outline' : 'volume-high-outline'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
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
            color={isLiked ? '#FF2E63' : '#FFFFFF'}
          />
          <Text style={styles.actionLabel}>{formatCount(likeCount)}</Text>
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
          <Text style={styles.actionLabel}>{formatCount(commentCount)}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={styles.actionItem}
          activeOpacity={0.8}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share reel"
        >
          <Ionicons name="paper-plane-outline" size={28} color="#FFFFFF" />
          <Text style={styles.actionLabel}>{item.shareCount ?? 0}</Text>
        </TouchableOpacity>

        {/* Calling Logo - Only visible when viewing someone else's reel */}
        {!isOwnReel && (
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.8}
            onPress={handleCallCreator}
            accessibilityRole="button"
            accessibilityLabel="Call creator"
          >
            <Ionicons name="call-outline" size={28} color="#FFFFFF" />
            <Text style={styles.actionLabel}>Call</Text>
          </TouchableOpacity>
        )}

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
      </View>

      {/* ═══════════════════  BOTTOM INFO  ═══════════════════ */}
      <View style={styles.bottomInfo}>
        {/* User row */}
        <View style={styles.userRow}>
          <TouchableOpacity
            activeOpacity={isOwnReel ? 1 : 0.8}
            onPress={isOwnReel ? undefined : handleOpenUserProfile}
            disabled={isOwnReel}
            style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}
          >
            {item.userAvatar ? (
              <Image source={{ uri: item.userAvatar }} style={styles.userAvatar} />
            ) : (
              <View style={[styles.userAvatar, { backgroundColor: '#FF2E63', justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>
                  {(item.userName || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
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

          {/* Hide Follow button if this is the user's own reel (Instagram behavior) */}
          {!isOwnReel && (
            <TouchableOpacity
              style={[styles.followBtn, isFollowing && styles.followingBtn]}
              activeOpacity={0.8}
              onPress={handleFollowToggle}
            >
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Only show caption entered at upload time */}
        {!!item.caption && (
          <Text style={styles.caption} numberOfLines={3}>
            {item.caption}
          </Text>
        )}
      </View>

      {/* Post Comments Bottom Sheet Modal */}
      <PostCommentsModal
        visible={commentsVisible}
        onClose={() => setCommentsVisible(false)}
        postId={item.id || item.postId || item._id}
        postAuthor={item.userName}
        postAuthorAvatar={item.userAvatar}
        postCaption={item.caption || ''}
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

            {/* Option 3: Save / Bookmark */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={handleSaveToggle}
              accessibilityRole="button"
              accessibilityLabel="Save Reel"
            >
              <View style={[styles.optionIconWrap, { backgroundColor: 'rgba(255, 46, 99, 0.1)' }]}>
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color="#FF2E63"
                />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={[styles.optionTitle, isDarkMode && { color: '#111827' }]}>
                  {isSaved ? 'Remove from Saved' : 'Save Reel'}
                </Text>
                <Text style={styles.optionSub}>Add this reel to your saved collection</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            {/* Option 4: Not Interested */}
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
  centerPlayBadge: {
    position: 'absolute',
    top: '44%',
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLoadingWrapper: {
    position: 'absolute',
    top: '46%',
    alignSelf: 'center',
  },
});
