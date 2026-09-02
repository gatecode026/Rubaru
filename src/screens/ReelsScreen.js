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
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import ReelItem from '../components/common/ReelItem';
import BottomTabBar from '../components/common/BottomTabBar';
import reelService from '../services/reelService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen({ isNestedInPager }) {
  const router = useRouter();
  const [reelHeight, setReelHeight] = useState(SCREEN_HEIGHT);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

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
        limit: 10,
        cursor: cursorParam || undefined,
      });

      const items = res.items || res.data?.items || [];
      const pageInfo = res.pageInfo || res.data?.pageInfo || {};

      if (isRefresh || !cursorParam) {
        setReels(items);
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
      fetchReels(true);
      playbackStartRef.current = Date.now();

      return () => {
        // Record watch duration for the active reel on unmount / route blur
        if (reels[activeIndex]) {
          const durationMs = Date.now() - playbackStartRef.current;
          reelService.recordPlayback(reels[activeIndex]._id || reels[activeIndex].id, {
            watchDurationMs: durationMs,
            completed: durationMs >= 5000,
          }).catch(() => null);
        }
      };
    }, [activeIndex, reels])
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== activeIndex) {
      const prevIndex = activeIndex;
      const newIndex = viewableItems[0].index;

      // Record previous reel duration
      if (reels[prevIndex]) {
        const durationMs = Date.now() - playbackStartRef.current;
        reelService.recordPlayback(reels[prevIndex]._id || reels[prevIndex].id, {
          watchDurationMs: durationMs,
          completed: durationMs >= 5000,
        }).catch(() => null);
      }

      setActiveIndex(newIndex);
      playbackStartRef.current = Date.now();
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleLayout = (event) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      setReelHeight(height);
    }
  };

  const mapReelToItem = (reel) => {
    return {
      id: reel.id || reel._id,
      userName: reel.author?.displayName || reel.author?.username || 'Rubaru Creator',
      isVerified: Boolean(reel.author?.isVerified),
      userAvatar: reel.author?.avatarUri || 'https://i.pravatar.cc/150?img=33',
      imageUri:
        reel.posterUri ||
        reel.mediaItems?.[0]?.thumbnail?.url ||
        reel.mediaItems?.[0]?.variants?.[0]?.url ||
        'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800',
      bgGradient: ['#2A1D24', '#140D11'],
      caption: reel.caption || '',
      likedBy: `${reel.likesCount || 0} likes`,
      audioTrack: reel.audioTrack || 'original_audio',
      likeCount: reel.likesCount || 0,
      commentCount: reel.commentsCount || 0,
      shareCount: reel.sharesCount || 0,
      isLiked: Boolean(reel.viewerInteractions?.isLiked),
      authorId: reel.authorId || reel.author?._id,
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
              data={reels}
              keyExtractor={(item) => item.id || item._id}
              renderItem={({ item, index }) => (
                <ReelItem
                  item={mapReelToItem(item)}
                  height={reelHeight}
                  isActive={index === activeIndex}
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
