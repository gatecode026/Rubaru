import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NotificationRow from '../components/common/NotificationRow';
import SegmentedNotifCallsHeader from '../components/common/SegmentedNotifCallsHeader';
import BottomTabBar from '../components/common/BottomTabBar';
import notificationService from '../services/notificationService';
import followService from '../services/followService';
import { getSocket } from '../services/socket';

export default function NotificationScreen({ isNestedInPager }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [followRequestsCount, setFollowRequestsCount] = useState(0);
  const [followRequestsPreview, setFollowRequestsPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [followButtonStates, setFollowButtonStates] = useState({});

  // 1. Fetch Follow Requests & Notifications
  const loadData = async (isRefresh = false, cursorParam = null) => {
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

      const [notifsRes, requestsRes] = await Promise.all([
        notificationService.getNotifications({
          limit: 30,
          cursor: cursorParam || undefined,
        }),
        !cursorParam ? followService.getPendingRequests().catch(() => ({ items: [] })) : Promise.resolve(null),
      ]);

      const rawItems = notifsRes.items || notifsRes.data?.items || [];
      const pageInfo = notifsRes.pageInfo || notifsRes.data?.pageInfo || {};

      const dedupeList = (list) => {
        const seen = new Set();
        return list.filter((n) => {
          const actorKey = n.sender?.userId || n.sender?._id || n.sender || 'sys';
          const sig = `${n.type}_${actorKey}_${n.message}`;
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });
      };

      if (isRefresh || !cursorParam) {
        setNotifications(dedupeList(rawItems));
      } else {
        setNotifications((prev) => dedupeList([...prev, ...rawItems]));
      }

      setNextCursor(pageInfo.nextCursor || notifsRes.nextCursor || null);
      setHasMore(Boolean(pageInfo.hasMore || notifsRes.hasMore));

      if (requestsRes) {
        const reqItems = requestsRes.items || requestsRes.data?.items || requestsRes.data || [];
        setFollowRequestsCount(reqItems.length);
        if (reqItems.length > 0) {
          setFollowRequestsPreview(reqItems[0]);
        } else {
          setFollowRequestsPreview(null);
        }
      }
    } catch (err) {
      console.log('[NOTIFICATION FETCH ERROR]:', err.message);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [])
  );

  // 2. Real-Time Socket Connection & Live Notification Listener
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRealtimeNotif = (newNotif) => {
      if (!newNotif) return;
      setNotifications((prev) => {
        const actorKey = newNotif.sender?.userId || newNotif.sender?._id || newNotif.sender || 'sys';
        const sig = `${newNotif.type}_${actorKey}_${newNotif.message}`;

        // Prevent duplicate insertions
        if (
          prev.some((n) => {
            if ((n.id || n._id) === (newNotif.id || newNotif._id)) return true;
            const nActorKey = n.sender?.userId || n.sender?._id || n.sender || 'sys';
            return `${n.type}_${nActorKey}_${n.message}` === sig;
          })
        ) {
          return prev;
        }
        return [newNotif, ...prev];
      });

      // If it's a follow request, bump the request counter
      if (newNotif.type === 'FOLLOW_REQUEST_RECEIVED') {
        setFollowRequestsCount((c) => c + 1);
        if (newNotif.sender) {
          setFollowRequestsPreview(newNotif.sender);
        }
      }
    };

    socket.on('notification:new', handleRealtimeNotif);

    return () => {
      socket.off('notification:new', handleRealtimeNotif);
    };
  }, []);

  // 3. Mark Read Handler
  const handleRowPress = async (item) => {
    try {
      if (!item.isRead) {
        await notificationService.markAsRead(item.id || item._id);
        setNotifications((prev) =>
          prev.map((n) => ((n.id || n._id) === (item.id || item._id) ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.log('[MARK READ ERROR]:', err.message);
    }

    const actorId =
      item.sender?.userId ||
      item.sender?._id ||
      (typeof item.sender === 'string' ? item.sender : null) ||
      item.subjectId;

    const deepLink = item.deepLink || '';

    // 1. Follow / Profile deep links
    if (deepLink.startsWith('rubaru://profile/') || deepLink.startsWith('/profile/')) {
      const targetId = deepLink.replace(/.*profile\//, '').split('?')[0] || actorId;
      if (targetId) {
        router.push({ pathname: '/user-profile', params: { userId: targetId } });
        return;
      }
    }

    // 2. Follow requests deep link
    if (deepLink.includes('follow-requests') || item.type === 'FOLLOW_REQUEST_RECEIVED') {
      router.push('/follow-requests');
      return;
    }

    // 3. Follow / Relationship notification types fallback
    if (item.type?.includes('FOLLOW') || item.type === 'NEW_FOLLOWER') {
      if (actorId) {
        router.push({ pathname: '/user-profile', params: { userId: actorId } });
        return;
      }
    }

    // 4. Reel deep links
    if (deepLink.includes('reel') || item.type?.includes('REEL')) {
      router.push('/reels');
      return;
    }

    // 5. Chat deep links
    if (deepLink.includes('chat/')) {
      const chatId = deepLink.replace(/.*chat\//, '').split('?')[0];
      if (chatId) {
        router.push(`/chat/${chatId}`);
        return;
      }
    }

    // 6. Generic deep link handling
    if (deepLink) {
      let route = deepLink.replace('rubaru://', '/');
      if (route.startsWith('/profile/')) {
        const id = route.replace('/profile/', '');
        router.push({ pathname: '/user-profile', params: { userId: id } });
        return;
      }
      try {
        router.push(route);
        return;
      } catch (e) {
        console.warn('[NAV ERROR]', e.message);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.log('[MARK ALL READ ERROR]:', err.message);
    }
  };

  // 4. Inline Follow Button Toggle
  const handleInlineFollow = async (item) => {
    const actorId = item.sender?.userId || item.sender?._id || item.sender;
    if (!actorId) return;

    const notifId = item.id || item._id;
    const currentState = followButtonStates[notifId] || (item.type === 'NEW_FOLLOWER' ? 'FOLLOW_BACK' : 'FOLLOW');
    const isCurrentlyFollowing = currentState === 'FOLLOWING';

    // Optimistic toggle
    setFollowButtonStates((prev) => ({
      ...prev,
      [notifId]: isCurrentlyFollowing ? 'FOLLOW' : 'FOLLOWING',
    }));

    try {
      if (isCurrentlyFollowing) {
        await followService.unfollowUser(actorId);
      } else {
        const res = await followService.followUser(actorId);
        const isPending = res.data?.relationship?.status === 'PENDING' || res.relationship?.status === 'PENDING';
        if (isPending) {
          setFollowButtonStates((prev) => ({ ...prev, [notifId]: 'REQUESTED' }));
        }
      }
    } catch (err) {
      console.log('[INLINE FOLLOW ERROR]', err.message);
      // Revert on failure
      setFollowButtonStates((prev) => ({ ...prev, [notifId]: currentState }));
    }
  };

  // 5. Categorize into Instagram-style chronological buckets
  const formatTimeAgo = (date) => {
    if (!date) return '';
    const now = new Date();
    const past = new Date(date);
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d`;
    const diffWeek = Math.floor(diffDay / 7);
    return `${diffWeek}w`;
  };

  const groupNotificationsByDate = (items) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const todayItems = [];
    const yesterdayItems = [];
    const thisWeekItems = [];
    const earlierItems = [];

    items.forEach((item) => {
      const itemDate = new Date(item.createdAt || Date.now());
      if (itemDate >= today) {
        todayItems.push(item);
      } else if (itemDate >= yesterday) {
        yesterdayItems.push(item);
      } else if (itemDate >= weekAgo) {
        thisWeekItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    const sections = [];
    if (todayItems.length > 0) sections.push({ title: 'Today', data: todayItems });
    if (yesterdayItems.length > 0) sections.push({ title: 'Yesterday', data: yesterdayItems });
    if (thisWeekItems.length > 0) sections.push({ title: 'This Week', data: thisWeekItems });
    if (earlierItems.length > 0) sections.push({ title: 'Earlier', data: earlierItems });

    return sections;
  };

  const mapItemToRow = (item) => {
    const actorName = item.sender?.displayName || item.sender?.username || item.templateData?.actorName || 'Someone';
    const avatarUri = item.sender?.avatarUri || item.templateData?.actorAvatar || null;
    let message = item.message || 'interacted with your profile.';
    // Strip duplicate actor name if message already begins with actorName
    if (actorName && message.toLowerCase().startsWith(actorName.toLowerCase())) {
      message = message.slice(actorName.length).trim();
    }
    const timeFormatted = formatTimeAgo(item.createdAt);

    const notifId = item.id || item._id;
    const isFollowType =
      item.type === 'NEW_FOLLOWER' ||
      item.type === 'FOLLOW_REQUEST_ACCEPTED' ||
      item.type === 'follow';

    const isCallType = item.type === 'CALL' || item.type === 'call' || item.type === 'MISSED_CALL' || item.type === 'missed_call';

    const defaultFollowState = item.type === 'NEW_FOLLOWER' ? 'FOLLOW_BACK' : 'FOLLOW';
    const followState = followButtonStates[notifId] || defaultFollowState;

    return {
      id: notifId,
      avatarUri,
      hasRing: !item.isRead,
      layout: item.previewThumbnailUri ? 'single-thumb' : 'none',
      singleThumbnail: item.previewThumbnailUri,
      isFollowType,
      followState,
      isCallType,
      titleParts: [
        { text: `${actorName} `, bold: true },
        { text: `${message} ` },
        { text: timeFormatted, isTime: true },
      ],
      isRead: item.isRead,
      deepLink: item.deepLink,
      sender: item.sender,
    };
  };

  const sections = groupNotificationsByDate(notifications);

  // Render Top Follow Requests Banner (Instagram UX)
  const renderFollowRequestsHeader = () => {
    if (followRequestsCount <= 0) return null;

    return (
      <TouchableOpacity
        style={styles.followRequestsBar}
        activeOpacity={0.8}
        onPress={() => router.push('/follow-requests')}
      >
        <View style={styles.followRequestsLeft}>
          <View style={styles.requestsAvatarContainer}>
            {followRequestsPreview?.avatarUri ? (
              <Image
                source={{ uri: followRequestsPreview.avatarUri }}
                style={styles.requestAvatar}
              />
            ) : (
              <View style={styles.defaultRequestAvatar}>
                <Ionicons name="people" size={20} color="#111827" />
              </View>
            )}
            <View style={styles.requestsCountBadge}>
              <Text style={styles.requestsCountText}>{followRequestsCount}</Text>
            </View>
          </View>

          <View style={styles.requestsTextContainer}>
            <Text style={styles.requestsTitle}>Follow Requests</Text>
            <Text style={styles.requestsSubtitle}>Approve or ignore requests</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header component */}
      <SegmentedNotifCallsHeader activeTab="notification" />

      {/* Follow Requests Top Item */}
      {renderFollowRequestsHeader()}

      {/* Mark all as read bar */}
      {notifications.some((n) => !n.isRead) && (
        <View style={styles.markReadBar}>
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color="#FF2E63" />
            <Text style={styles.markReadText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main List / State Handling */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF2E63" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadData(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={54} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Activity on your posts</Text>
          <Text style={styles.emptySubtitle}>
            When someone likes, comments, or follows you, you'll see it here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || item._id || String(Math.random())}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const rowItem = mapItemToRow(item);
            return (
              <NotificationRow
                item={rowItem}
                onPress={() => handleRowPress(item)}
                onFollowPress={() => handleInlineFollow(item)}
              />
            );
          }}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={['#FF2E63']}
            />
          }
          onEndReached={() => {
            if (hasMore && !loadingMore && nextCursor) {
              loadData(false, nextCursor);
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#FF2E63" />
              </View>
            ) : null
          }
        />
      )}

      {!isNestedInPager && <BottomTabBar activeTab="notification" />}
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  followRequestsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  followRequestsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestsAvatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
  },
  defaultRequestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  requestsCountBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF2E63',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  requestsCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  requestsTextContainer: {
    flex: 1,
  },
  requestsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  requestsSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  markReadBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF2E63',
  },
  sectionHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  listContentContainer: {
    paddingBottom: 100,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FF2E63',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
