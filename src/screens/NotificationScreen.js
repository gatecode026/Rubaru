import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import NotificationRow from '../components/common/NotificationRow';
import SegmentedNotifCallsHeader from '../components/common/SegmentedNotifCallsHeader';
import BottomTabBar from '../components/common/BottomTabBar';
import notificationService from '../services/notificationService';

export default function NotificationScreen({ isNestedInPager }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchNotifications = async (isRefresh = false, cursorParam = null) => {
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

      const res = await notificationService.getNotifications({
        limit: 20,
        cursor: cursorParam || undefined,
      });

      const items = res.items || res.data?.items || [];
      const pageInfo = res.pageInfo || res.data?.pageInfo || {};

      if (isRefresh || !cursorParam) {
        setNotifications(items);
      } else {
        setNotifications((prev) => [...prev, ...items]);
      }

      setNextCursor(pageInfo.nextCursor || res.nextCursor || null);
      setHasMore(Boolean(pageInfo.hasMore || res.hasMore));
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
      fetchNotifications(true);
    }, [])
  );

  const handleRowPress = async (item) => {
    try {
      if (!item.isRead) {
        await notificationService.markAsRead(item.id || item._id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id || n._id === item._id ? { ...n, isRead: true } : n))
        );
      }
    } catch (err) {
      console.log('[MARK READ ERROR]:', err.message);
    }

    // Navigate to deepLink or fallback
    if (item.deepLink) {
      const route = item.deepLink.replace('rubaru://', '/');
      router.push(route);
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

  const mapItemToRow = (item) => {
    const actorName = item.sender?.displayName || item.templateData?.actorName || 'Someone';
    const avatarUri = item.sender?.avatarUri || item.templateData?.actorAvatar || 'https://i.pravatar.cc/150?img=12';
    const message = item.message || 'interacted with your profile.';
    const timeFormatted = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    return {
      id: item.id || item._id || String(Math.random()),
      avatarUri,
      hasRing: !item.isRead,
      layout: item.previewThumbnailUri ? 'single-thumb' : 'none',
      singleThumbnail: item.previewThumbnailUri,
      time: timeFormatted,
      titleParts: [
        { text: `${actorName} `, bold: true },
        { text: message },
      ],
      isRead: item.isRead,
      deepLink: item.deepLink,
    };
  };

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header component */}
      <SegmentedNotifCallsHeader activeTab="notification" />

      {/* Mark all as read bar */}
      {notifications.some((n) => !n.isRead) && (
        <View style={styles.markReadBar}>
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn}>
            <Ionicons name="checkmark-done-outline" size={16} color="#F44649" />
            <Text style={styles.markReadText}>Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.dividerLine} />

      {/* Main List / State Handling */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#F44649" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : error && notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchNotifications(true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="notifications-off-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>When friends like, comment or follow, you'll see them here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id || item._id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleRowPress(item)}>
              <NotificationRow item={mapItemToRow(item)} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              colors={['#F44649']}
            />
          }
          onEndReached={() => {
            if (hasMore && !loadingMore && nextCursor) {
              fetchNotifications(false, nextCursor);
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#F44649" />
              </View>
            ) : null
          }
        />
      )}

      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Notification"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  markReadBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF5F5',
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markReadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F44649',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#EFEFF4',
  },
  listContentContainer: {
    paddingBottom: 90,
    paddingTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
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
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
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
