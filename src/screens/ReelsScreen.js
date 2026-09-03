import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import ReelItem from '../components/common/ReelItem';
import BottomTabBar from '../components/common/BottomTabBar';
import reelService from '../services/reelService';
import { getSocket } from '../services/socket';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen({ isNestedInPager, isTabFocused = true }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const flatListRef = useRef(null);
  const [reelHeight, setReelHeight] = useState(SCREEN_HEIGHT);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIdxRef = useRef(0);
  const reelsRef = useRef([]);

  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);

  useEffect(() => {
    activeIdxRef.current = activeIndex;
  }, [activeIndex]);

  // Real-time socket sync for reel feed items
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleLikeUpdated = (data) => {
      if (data && data.reelId) {
        setReels((prev) =>
          prev.map((r) => {
            if (String(r.id || r._id || r.postId) === String(data.reelId)) {
              return {
                ...r,
                likesCount: data.likesCount,
              };
            }
            return r;
          })
        );
      }
    };

    const handleCommentAdded = (data) => {
      if (data && data.reelId) {
        setReels((prev) =>
          prev.map((r) => {
            if (String(r.id || r._id || r.postId) === String(data.reelId)) {
              return {
                ...r,
                commentsCount: data.commentsCount,
              };
            }
            return r;
          })
        );
      }
    };

    const handleCommentDeleted = (data) => {
      if (data && data.reelId) {
        setReels((prev) =>
          prev.map((r) => {
            if (String(r.id || r._id || r.postId) === String(data.reelId)) {
              return {
                ...r,
                commentsCount: data.commentsCount,
              };
            }
            return r;
          })
        );
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
  }, []);

  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Playback timer ref
  const playbackStartRef = useRef(Date.now());

  const fetchReels = async (isRefresh = false, cursorParam = null) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else if (cursorParam) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const res = await reelService.getReelFeed({
        limit: 15,
        cursor: cursorParam || undefined,
      });

      let items = res.items || res.data?.items || [];
      const pageInfo = res.pageInfo || res.data?.pageInfo || {};

      // If opened from a profile for a specific reel, ensure that reel is loaded
      if (params.initialReelId) {
        const found = items.find(
          (r) =>
            String(r.id || r._id || r.postId) === String(params.initialReelId)
        );
        if (!found) {
          try {
            const singleRes = await reelService.getReelById(params.initialReelId);
            const singleItem = singleRes.data?.reel || singleRes.reel || singleRes.data || singleRes;
            if (singleItem && (singleItem._id || singleItem.id)) {
              items = [singleItem, ...items];
            }
          } catch (singleErr) {
            console.log('[FETCH SINGLE REEL FOR PROFILE ERROR]', singleErr.message);
          }
        }
      }

      if (isRefresh || !cursorParam) {
        setReels(items);
        if (params.initialReelId) {
          const foundIdx = items.findIndex(
            (r) =>
              String(r.id || r._id || r.postId) === String(params.initialReelId)
          );
          if (foundIdx >= 0) {
            setActiveIndex(foundIdx);
            activeIdxRef.current = foundIdx;
            setTimeout(() => {
              try {
                flatListRef.current?.scrollToIndex({ index: foundIdx, animated: false });
              } catch (e) {}
            }, 100);
          }
        }
      } else {
        setReels((prev) => [...prev, ...items]);
      }

      setNextCursor(pageInfo.nextCursor || res.nextCursor || null);
      setHasMore(Boolean(pageInfo.hasMore || res.hasMore));
    } catch (err) {
      console.log('[REELS FEED FETCH ERROR]:', err.message);
      setError(err.message || 'Failed to load reels');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      fetchReels(true);
      playbackStartRef.current = Date.now();

      return () => {
        setIsScreenFocused(false);
        // Record watch duration for active reel on unmount / route blur
        const currReels = reelsRef.current;
        const currIdx = activeIdxRef.current;
        if (currReels[currIdx]) {
          const durationMs = Date.now() - playbackStartRef.current;
          reelService.recordPlayback(currReels[currIdx]._id || currReels[currIdx].id, {
            watchDurationMs: durationMs,
            completed: durationMs >= 5000,
          }).catch(() => null);
        }
      };
    }, [params.initialReelId])
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0 && typeof viewableItems[0].index === 'number') {
      const newIndex = viewableItems[0].index;
      const prevIndex = activeIdxRef.current;

      if (newIndex !== prevIndex) {
        const currReels = reelsRef.current;
        // Record previous reel duration
        if (currReels[prevIndex]) {
          const durationMs = Date.now() - playbackStartRef.current;
          reelService.recordPlayback(currReels[prevIndex]._id || currReels[prevIndex].id, {
            watchDurationMs: durationMs,
            completed: durationMs >= 5000,
          }).catch(() => null);
        }

        activeIdxRef.current = newIndex;
        setActiveIndex(newIndex);
        playbackStartRef.current = Date.now();
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 100,
  }).current;

  const handleLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setReelHeight(height);
    }
  };

  const getFullUrl = (uri) => {
    if (!uri || typeof uri !== 'string') return '';
    if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://')) return uri;
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.6:5000/api';
    const host = apiBase.replace('/api', '');
    return `${host}${uri.startsWith('/') ? uri : `/${uri}`}`;
  };

  const mapReelToItem = (reel) => {
    const firstMedia = reel.mediaItems?.[0];
    const rawVideoUrl =
      reel.videoUri ||
      firstMedia?.variants?.find((v) => v.mimeType?.includes('video') || v.url?.endsWith('.mp4') || v.url?.includes('http'))?.url ||
      firstMedia?.variants?.[0]?.url ||
      '';
    const videoUrl = getFullUrl(rawVideoUrl);

    const rawThumbUrl =
      reel.thumbnailUri ||
      reel.posterUri ||
      firstMedia?.thumbnail?.url ||
      '';
    const thumbUrl = getFullUrl(rawThumbUrl);

    return {
      id: String(reel.id || reel.postId || reel._id),
      videoUri: videoUrl,
      imageUri: thumbUrl,
      userName: reel.author?.displayName || reel.author?.username || 'Rubaru Creator',
      isVerified: Boolean(reel.author?.isVerified),
      userAvatar: getFullUrl(reel.author?.avatarUri || ''),
      bgGradient: ['#1F0E18', '#080306'],
      caption: reel.caption || '',
      likedBy: `${reel.likesCount || 0} likes`,
      audioTrack: reel.audioTrack || 'original_audio',
      likeCount: reel.likesCount || 0,
      commentCount: reel.commentsCount || 0,
      shareCount: reel.sharesCount || 0,
      isLiked: Boolean(reel.isLiked || reel.viewerInteractions?.isLiked),
      authorId: reel.authorId || reel.author?.userId || reel.author?._id || reel.author?.id,
    };
  };

  return (
    <View style={styles.screenContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* State View */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading reels...</Text>
        </View>
      ) : error && reels.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="videocam-off-outline" size={48} color="#9CA3AF" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchReels(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : reels.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="film-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>No reels yet</Text>
          <Text style={styles.emptySubtitle}>Be the first to share a moment with friends!</Text>
        </View>
      ) : (
        <View style={styles.feedWrapper} onLayout={handleLayout}>
          {reelHeight > 0 && (
            <FlatList
              ref={flatListRef}
              data={reels}
              keyExtractor={(item, index) => String(item.id || item.postId || item._id || index)}
              renderItem={({ item, index }) => (
                <ReelItem
                  item={mapReelToItem(item)}
                  height={reelHeight}
                  isActive={Boolean(isTabFocused && isScreenFocused && (index === activeIndex))}
                  onBackPress={handleBack}
                />
              )}
              pagingEnabled
              snapToInterval={reelHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(data, index) => ({
                length: reelHeight,
                offset: reelHeight * index,
                index,
              })}
              initialNumToRender={2}
              maxToRenderPerBatch={3}
              windowSize={7}
              removeClippedSubviews={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => fetchReels(true)}
                  tintColor="#FFFFFF"
                  colors={['#FF2E63']}
                />
              }
              onEndReached={() => {
                if (hasMore && !loadingMore && nextCursor) {
                  fetchReels(false, nextCursor);
                }
              }}
              onEndReachedThreshold={0.5}
            />
          )}
        </View>
      )}

      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Reels"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  feedWrapper: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#F44649',
    borderRadius: 20,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});
