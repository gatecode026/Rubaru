import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal,
  ScrollView,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import storyService from '../services/storyService';
import { getSocket } from '../services/socket';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story

const getTimeAgo = (dateStr) => {
  if (!dateStr) return 'Just now';
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

export default function ViewStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const targetUserId = params.userId;
  const initialName = params.name || 'Friend';
  const initialAvatar = params.imageUrl || 'https://i.pravatar.cc/150?img=33';
  const isSelf = params.isSelf === 'true' || params.name === 'Your story';

  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState([]);
  const [author, setAuthor] = useState({
    displayName: initialName,
    avatarUri: initialAvatar,
  });

  const [currentIdx, setCurrentIdx] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Instagram Story Viewers & Likes state (Owner Only)
  const [viewersData, setViewersData] = useState({ viewers: [], totalViews: 0, totalLikes: 0 });
  const [isLoadingViewers, setIsLoadingViewers] = useState(false);
  const [isViewersModalVisible, setIsViewersModalVisible] = useState(false);
  const [viewerSearchQuery, setViewerSearchQuery] = useState('');
  const [activeViewerTab, setActiveViewerTab] = useState('ALL'); // 'ALL' | 'LIKES'

  // Animated progress
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const startTime = useRef(0);
  const elapsedBeforePause = useRef(0);

  // Fetch real stories for user
  useEffect(() => {
    let isMounted = true;
    async function loadUserStories() {
      if (!targetUserId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await storyService.getUserStories(targetUserId);
        if (isMounted) {
          if (res?.data?.stories && res.data.stories.length > 0) {
            const mapped = res.data.stories.map((s) => {
              const primaryUri =
                s.imageUri ||
                s.mediaItems?.[0]?.originalUrl ||
                s.mediaItems?.[0]?.variants?.[0]?.url ||
                s.mediaItems?.[0]?.thumbnail?.url ||
                '';

              return {
                id: s.postId || s._id || s.id,
                type: s.mediaItems?.[0]?.mediaType === 'VIDEO' ? 'video' : 'image',
                uri: primaryUri,
                caption: s.caption || '',
                publishedAt: s.publishedAt || s.createdAt,
                viewsCount: s.viewsCount || 0,
                isLiked: Boolean(s.isLiked),
                totalLikes: s.likesCount || 0,
                isViewed: Boolean(s.isViewed),
              };
            });

            setStories(mapped);

            // Instagram Reference: Directly open the first unviewed story or newly added story!
            let startIdx = 0;
            if (params.openLatest === 'true' || isSelf) {
              // Open the most recently added story frame
              startIdx = Math.max(0, mapped.length - 1);
            } else if (typeof res.data.initialIndex === 'number' && res.data.initialIndex >= 0) {
              startIdx = res.data.initialIndex;
            } else {
              const firstUnviewed = mapped.findIndex((s) => !s.isViewed);
              startIdx = firstUnviewed !== -1 ? firstUnviewed : Math.max(0, mapped.length - 1);
            }

            setCurrentIdx(startIdx);

            if (res.data.author) {
              setAuthor({
                displayName: res.data.author.displayName || res.data.author.username || initialName,
                avatarUri: res.data.author.avatarUri || initialAvatar,
              });
            }
          } else {
            setStories([]);
          }
        }
      } catch (err) {
        console.log('[VIEW STORY FETCH ERROR]', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUserStories();

    return () => {
      isMounted = false;
      if (animationRef.current) animationRef.current.stop();
    };
  }, [targetUserId]);

  const activeStory = stories[currentIdx];

  // Fetch viewers & likes whenever active story changes if isSelf
  const fetchViewers = async (storyId) => {
    if (!storyId || !isSelf) return;
    try {
      setIsLoadingViewers(true);
      const res = await storyService.getStoryViewers(storyId);
      if (res?.data) {
        const rawViewers = res.data.viewers || [];
        // Strictly exclude own user ID from the viewers list
        const cleanViewers = rawViewers.filter((v) => {
          const vid = String(v.userId || v.viewerId || '');
          const authorId = String(targetUserId || '');
          return !authorId || vid !== authorId;
        });

        const likesCount = res.data.totalLikes ?? cleanViewers.filter((v) => v.hasLiked).length;
        setViewersData({
          viewers: cleanViewers,
          totalViews: res.data.totalViews ?? cleanViewers.length,
          totalLikes: likesCount,
        });
      }
    } catch (err) {
      console.log('[STORY VIEWERS FETCH ERROR]:', err.message);
    } finally {
      setIsLoadingViewers(false);
    }
  };

  // Real-time polling & live socket updates for viewers and likes
  useEffect(() => {
    if (!isSelf || !activeStory?.id) return;

    fetchViewers(activeStory.id);

    const socket = getSocket();
    const handleLikeUpdated = (data) => {
      if (data && String(data.contentId) === String(activeStory.id)) {
        setViewersData((prev) => ({
          ...prev,
          totalLikes: Number(data.likesCount) || 0,
        }));
        fetchViewers(activeStory.id);
      }
    };

    const handleViewRecorded = (data) => {
      if (data && String(data.storyId) === String(activeStory.id)) {
        fetchViewers(activeStory.id);
      }
    };

    if (socket) {
      socket.on('content_like_updated', handleLikeUpdated);
      socket.on('story_view_recorded', handleViewRecorded);
    }

    // Interval polling every 2.5 seconds so numbers update in real-time
    const interval = setInterval(() => {
      fetchViewers(activeStory.id);
    }, 2500);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('content_like_updated', handleLikeUpdated);
        socket.off('story_view_recorded', handleViewRecorded);
      }
    };
  }, [activeStory?.id, isSelf]);

  // Run story timer on index change
  useEffect(() => {
    if (!loading && stories.length > 0 && activeStory) {
      progressAnim.setValue(0);
      elapsedBeforePause.current = 0;
      setLiked(Boolean(activeStory.isLiked));

      if (!isPaused && !isViewersModalVisible) {
        startStoryTimer(STORY_DURATION);
      }
      if (activeStory.id) {
        storyService.recordStoryView(activeStory.id).catch(() => null);
        if (isSelf) {
          fetchViewers(activeStory.id);
        }
      }
    }
    return () => {
      if (animationRef.current) animationRef.current.stop();
    };
  }, [currentIdx, loading, stories.length]);

  const startStoryTimer = (duration) => {
    startTime.current = Date.now();
    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        handleNextStory();
      }
    });
  };

  const handleNextStory = () => {
    if (currentIdx < stories.length - 1) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      router.back();
    }
  };

  const handlePrevStory = () => {
    if (currentIdx > 0) {
      setCurrentIdx((prev) => prev - 1);
    } else {
      progressAnim.setValue(0);
      elapsedBeforePause.current = 0;
      if (animationRef.current) animationRef.current.stop();
      startStoryTimer(STORY_DURATION);
    }
  };

  // Pause on hold
  const handlePressIn = () => {
    if (isViewersModalVisible) return;
    setIsPaused(true);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    const timePassed = Date.now() - startTime.current;
    elapsedBeforePause.current = elapsedBeforePause.current + timePassed;
  };

  // Resume on release
  const handlePressOut = () => {
    if (isViewersModalVisible) return;
    setIsPaused(false);
    const remaining = STORY_DURATION - elapsedBeforePause.current;
    if (remaining > 0) {
      startStoryTimer(remaining);
    } else {
      handleNextStory();
    }
  };

  const handleScreenTap = (event) => {
    if (isViewersModalVisible) return;
    const touchX = event.nativeEvent.locationX;
    const thirdOfScreen = SCREEN_WIDTH / 3;

    if (touchX < thirdOfScreen) {
      handlePrevStory();
    } else {
      handleNextStory();
    }
  };

  // Open Viewers Bottom Sheet (Instagram Style)
  const handleOpenViewersSheet = () => {
    setIsPaused(true);
    if (animationRef.current) animationRef.current.stop();
    const timePassed = Date.now() - startTime.current;
    elapsedBeforePause.current = elapsedBeforePause.current + timePassed;
    setIsViewersModalVisible(true);
    if (activeStory?.id) {
      fetchViewers(activeStory.id);
    }
  };

  // Close Viewers Bottom Sheet
  const handleCloseViewersSheet = () => {
    setIsViewersModalVisible(false);
    setIsPaused(false);
    const remaining = STORY_DURATION - elapsedBeforePause.current;
    if (remaining > 0) {
      startStoryTimer(remaining);
    } else {
      handleNextStory();
    }
  };

  // Navigate to Viewer's Profile
  const handleNavigateToUserProfile = (viewer) => {
    handleCloseViewersSheet();
    const rawId = viewer.userId || viewer.viewerId || viewer._id;
    if (rawId) {
      router.push({
        pathname: '/user-profile',
        params: { userId: String(rawId) },
      });
    }
  };

  // Toggle Like on Story (Non-owner view)
  const handleToggleLike = async () => {
    if (!activeStory?.id) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    try {
      if (nextLiked) {
        const res = await storyService.likeStory(activeStory.id);
        const newCount = res?.data?.likesCount ?? ((activeStory.totalLikes || 0) + 1);
        activeStory.totalLikes = newCount;
      } else {
        const res = await storyService.unlikeStory(activeStory.id);
        const newCount = res?.data?.likesCount ?? Math.max(0, (activeStory.totalLikes || 1) - 1);
        activeStory.totalLikes = newCount;
      }
    } catch (err) {
      console.warn('Error toggling story like:', err);
    }
  };

  const handleSendReply = () => {
    if (replyText.trim() === '') return;
    Alert.alert('Sent', `Reply sent to ${author.displayName}! 🩷`);
    setReplyText('');
  };

  const handleDeleteStory = () => {
    if (!activeStory?.id) return;
    Alert.alert(
      'Delete Story?',
      'Are you sure you want to delete this story frame?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await storyService.deleteStory(activeStory.id);
              const updated = stories.filter((s) => s.id !== activeStory.id);
              if (updated.length === 0) {
                router.back();
              } else {
                setStories(updated);
                setCurrentIdx((prev) => Math.min(prev, updated.length - 1));
              }
            } catch (err) {
              Alert.alert('Error', 'Could not delete story. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color="#E63956" />
        <Text style={styles.loadingText}>Loading story...</Text>
      </View>
    );
  }

  if (stories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar hidden />
        <TouchableOpacity style={styles.emptyClose} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Ionicons name="images-outline" size={54} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No active stories</Text>
        <Text style={styles.emptySub}>This user does not have any active stories right now.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Filter viewers based on tab & search query (strictly never show story author)
  const filteredViewers = viewersData.viewers
    .filter((v) => {
      const vid = String(v.userId || v.viewerId || '');
      const authorId = String(targetUserId || '');
      if (authorId && vid === authorId) return false;
      return true;
    })
    .filter((v) => {
      if (activeViewerTab === 'LIKES' && !v.hasLiked) return false;
      if (viewerSearchQuery.trim() !== '') {
        const q = viewerSearchQuery.toLowerCase();
        const matchName = v.displayName?.toLowerCase().includes(q);
        const matchUser = v.username?.toLowerCase().includes(q);
        return matchName || matchUser;
      }
      return true;
    });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar hidden />

      {/* Main Full-Screen Media View */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleScreenTap}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.mediaContainer}
      >
        <Image
          source={{
            uri:
              activeStory?.uri && !activeStory.uri.includes('empty')
                ? activeStory.uri
                : 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080',
          }}
          style={styles.storyImage}
          resizeMode="cover"
        />

        {/* Text Overlay / Caption Card */}
        {Boolean(activeStory?.caption) && (
          <View style={styles.textOverlayContainer}>
            <Text style={styles.textOverlay}>{activeStory.caption}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Top Overlay Controls */}
      <View style={[styles.topControlsContainer, { top: Math.max(insets.top + 6, 12) }]}>
        {/* Progress Bars Indicator Segment */}
        <View style={styles.progressRow}>
          {stories.map((item, idx) => {
            let widthInterpolation;
            if (idx < currentIdx) {
              widthInterpolation = '100%';
            } else if (idx === currentIdx) {
              widthInterpolation = progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              });
            } else {
              widthInterpolation = '0%';
            }

            return (
              <View key={item.id || String(idx)} style={styles.progressTrack}>
                <Animated.View style={[styles.progressBar, { width: widthInterpolation }]} />
              </View>
            );
          })}
        </View>

        {/* User Profile Header details */}
        <View style={styles.headerInfo}>
          <TouchableOpacity
            style={styles.userProfile}
            onPress={() => {
              if (targetUserId) {
                router.push({
                  pathname: '/user-profile',
                  params: { userId: String(targetUserId) },
                });
              }
            }}
          >
            <Image
              source={{
                uri:
                  author.avatarUri && !author.avatarUri.includes('empty')
                    ? author.avatarUri
                    : 'https://i.pravatar.cc/150?img=60',
              }}
              style={styles.avatarImage}
            />
            <View style={styles.usernameWrapper}>
              <Text style={styles.usernameText}>
                {isSelf ? 'Your story' : author.displayName}
              </Text>
              <Text style={styles.timeText}>{getTimeAgo(activeStory?.publishedAt)}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            {isSelf && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteStory}
                disabled={isDeleting}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Control Panel */}
      <View style={[styles.bottomControlPanel, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        {isSelf ? (
          <View style={styles.selfFooterRow}>
            {/* Instagram Style Interactive Views Button */}
            <TouchableOpacity
              style={styles.viewsBadgeInteractive}
              onPress={handleOpenViewersSheet}
              activeOpacity={0.8}
            >
              {/* Facepile of recent viewers if available */}
              {viewersData.viewers.length > 0 ? (
                <View style={styles.facepileRow}>
                  {viewersData.viewers.slice(0, 3).map((v, i) => (
                    <Image
                      key={v.userId || v.viewerId || String(i)}
                      source={{
                        uri:
                          v.avatarUri && !v.avatarUri.includes('empty')
                            ? v.avatarUri
                            : `https://i.pravatar.cc/150?img=${(i * 7) + 12}`,
                      }}
                      style={[styles.facepileAvatar, { marginLeft: i > 0 ? -10 : 0 }]}
                    />
                  ))}
                </View>
              ) : (
                <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
              )}

              <View style={styles.viewsLabelWrapper}>
                <Text style={styles.viewsCountText}>
                  {viewersData.totalViews || activeStory?.viewsCount || 0} views
                </Text>
                {viewersData.totalLikes > 0 && (
                  <View style={styles.viewsLikesBadge}>
                    <Ionicons name="heart" size={12} color="#FF2D55" />
                    <Text style={styles.viewsLikesText}>{viewersData.totalLikes}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addMoreCapsule}
              onPress={() => router.push('/add-story')}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.addMoreText}>Add more</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.replyRow}>
            <TextInput
              style={styles.replyInput}
              placeholder={`Reply to ${author.displayName}...`}
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={handleSendReply}
            />

            {/* Like Story Button (Instagram Heart) */}
            <TouchableOpacity
              style={[styles.actionIconButton, liked && styles.likedButton]}
              onPress={handleToggleLike}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={26}
                color={liked ? '#FF2D55' : '#FFFFFF'}
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionIconButton} onPress={handleSendReply}>
              <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ========================================================================= */}
      {/* INSTAGRAM STORY VIEWERS & LIKES BOTTOM SHEET MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={isViewersModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseViewersSheet}
      >
        <View style={styles.viewersModalOverlay}>
          <TouchableOpacity
            style={styles.viewersModalBackdropDismiss}
            activeOpacity={1}
            onPress={handleCloseViewersSheet}
          />

          <View style={[styles.viewersModalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Sheet Drag Handle */}
            <View style={styles.sheetHandle} />

            {/* Story Card & Tabs Header */}
            <View style={styles.sheetTopRow}>
              {/* Story Mini Thumbnail */}
              <View style={styles.storyMiniCard}>
                <Image source={{ uri: activeStory?.uri }} style={styles.storyMiniThumb} />
                <View style={styles.storyMiniBadge}>
                  <Ionicons name="play" size={10} color="#FFFFFF" />
                </View>
              </View>

              {/* Segmented Filter Tabs */}
              <View style={styles.segmentedTabsContainer}>
                <TouchableOpacity
                  style={[styles.segmentTab, activeViewerTab === 'ALL' && styles.segmentTabActive]}
                  onPress={() => setActiveViewerTab('ALL')}
                >
                  <Ionicons
                    name="eye"
                    size={16}
                    color={activeViewerTab === 'ALL' ? '#FFFFFF' : '#8E8E93'}
                  />
                  <Text
                    style={[
                      styles.segmentTabText,
                      activeViewerTab === 'ALL' && styles.segmentTabTextActive,
                    ]}
                  >
                    {viewersData.totalViews || viewersData.viewers.length}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.segmentTab, activeViewerTab === 'LIKES' && styles.segmentTabActive]}
                  onPress={() => setActiveViewerTab('LIKES')}
                >
                  <Ionicons
                    name="heart"
                    size={16}
                    color={activeViewerTab === 'LIKES' ? '#FF2D55' : '#8E8E93'}
                  />
                  <Text
                    style={[
                      styles.segmentTabText,
                      activeViewerTab === 'LIKES' && styles.segmentTabTextActive,
                    ]}
                  >
                    {viewersData.totalLikes || viewersData.viewers.filter((v) => v.hasLiked).length}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Close Button */}
              <TouchableOpacity style={styles.sheetCloseButton} onPress={handleCloseViewersSheet}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Search Viewers Input */}
            <View style={styles.searchViewerWrapper}>
              <Ionicons name="search" size={16} color="#8E8E93" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchViewerInput}
                placeholder="Search viewers..."
                placeholderTextColor="#8E8E93"
                value={viewerSearchQuery}
                onChangeText={setViewerSearchQuery}
              />
              {viewerSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setViewerSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>

            {/* Viewers FlatList */}
            {isLoadingViewers ? (
              <View style={styles.viewersLoadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.viewersLoadingText}>Loading viewers...</Text>
              </View>
            ) : filteredViewers.length === 0 ? (
              <View style={styles.viewersEmptyContainer}>
                <Ionicons
                  name={activeViewerTab === 'LIKES' ? 'heart-dislike-outline' : 'eye-off-outline'}
                  size={44}
                  color="#636366"
                />
                <Text style={styles.viewersEmptyTitle}>
                  {activeViewerTab === 'LIKES' ? 'No story likes yet' : 'No views yet'}
                </Text>
                <Text style={styles.viewersEmptySub}>
                  {activeViewerTab === 'LIKES'
                    ? 'When friends like your story, you will see them highlighted here.'
                    : 'When friends view your story, their profiles will appear here.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredViewers}
                keyExtractor={(item, index) => item.userId || item.viewerId || String(index)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.viewersListContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.viewerRow}
                    activeOpacity={0.7}
                    onPress={() => handleNavigateToUserProfile(item)}
                  >
                    {/* Viewer Avatar with Heart Badge if Liked */}
                    <View style={styles.viewerAvatarContainer}>
                      <Image
                        source={{
                          uri:
                            item.avatarUri && !item.avatarUri.includes('empty')
                              ? item.avatarUri
                              : 'https://i.pravatar.cc/150?img=32',
                        }}
                        style={styles.viewerAvatar}
                      />
                      {item.hasLiked && (
                        <View style={styles.viewerLikedHeartBadge}>
                          <Ionicons name="heart" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </View>

                    {/* Viewer Details */}
                    <View style={styles.viewerInfoCol}>
                      <View style={styles.viewerNameRow}>
                        <Text style={styles.viewerDisplayName} numberOfLines={1}>
                          {item.displayName || 'Rubaru User'}
                        </Text>
                        {item.isVerified && (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color="#0095F6"
                            style={{ marginLeft: 4 }}
                          />
                        )}
                      </View>
                      <Text style={styles.viewerUsername} numberOfLines={1}>
                        {item.username ? `@${item.username}` : ''}
                        {item.firstViewedAt ? ` • ${getTimeAgo(item.firstViewedAt)}` : ''}
                      </Text>
                    </View>

                    {/* Right Action Icons (Heart & Message) */}
                    <View style={styles.viewerActionsRow}>
                      {item.hasLiked && (
                        <Ionicons
                          name="heart"
                          size={22}
                          color="#FF2D55"
                          style={{ marginRight: 12 }}
                        />
                      )}
                      <TouchableOpacity
                        style={styles.viewerMessageBtn}
                        onPress={() => handleNavigateToUserProfile(item)}
                      >
                        <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 8,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySub: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#E63956',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mediaContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textOverlayContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  textOverlay: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  topControlsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  usernameWrapper: {
    justifyContent: 'center',
  },
  usernameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
  },
  closeButton: {
    padding: 6,
  },
  bottomControlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 10,
  },
  selfFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  viewsBadgeInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  facepileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  facepileAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  viewsLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewsCountText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewsLikesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 45, 85, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  viewsLikesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  addMoreCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0095F6',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
  },
  addMoreText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  likedButton: {
    backgroundColor: 'rgba(255, 45, 85, 0.2)',
  },

  // =========================================================================
  // VIEWERS MODAL STYLES (INSTAGRAM STYLE)
  // =========================================================================
  viewersModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  viewersModalBackdropDismiss: {
    flex: 1,
  },
  viewersModalContent: {
    height: SCREEN_HEIGHT * 0.72,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#545458',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2E',
  },
  storyMiniCard: {
    width: 36,
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  storyMiniThumb: {
    width: '100%',
    height: '100%',
  },
  storyMiniBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 1,
  },
  segmentedTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#2C2C2E',
    borderRadius: 20,
    padding: 3,
    gap: 4,
  },
  segmentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  segmentTabActive: {
    backgroundColor: '#3A3A3C',
  },
  segmentTabText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTabTextActive: {
    color: '#FFFFFF',
  },
  sheetCloseButton: {
    padding: 6,
  },
  searchViewerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 12,
  },
  searchViewerInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  viewersLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  viewersLoadingText: {
    color: '#8E8E93',
    fontSize: 13,
  },
  viewersEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  viewersEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  viewersEmptySub: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  viewersListContent: {
    paddingBottom: 24,
  },
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#242426',
  },
  viewerAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  viewerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3A3A3C',
  },
  viewerLikedHeartBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF2D55',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  viewerInfoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  viewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerDisplayName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 180,
  },
  viewerUsername: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  viewerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerMessageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
