import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import followService from '../services/followService';

export default function FollowRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  const fetchRequests = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await followService.getPendingRequests();
      const items = res.items || res.data?.items || res.data || [];
      setRequests(items);
    } catch (err) {
      console.log('[FOLLOW REQUESTS FETCH ERROR]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleConfirm = async (item) => {
    const reqId = item.requestId || item.id || item._id;
    setActionLoading((prev) => ({ ...prev, [reqId]: 'confirming' }));
    try {
      await followService.acceptRequest(reqId);
      setRequests((prev) => prev.filter((r) => (r.requestId || r.id || r._id) !== reqId));
    } catch (err) {
      console.log('[CONFIRM ERROR]', err.message);
      alert('Failed to accept follow request. Please try again.');
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[reqId];
        return next;
      });
    }
  };

  const handleDelete = async (item) => {
    const reqId = item.requestId || item.id || item._id;
    setActionLoading((prev) => ({ ...prev, [reqId]: 'deleting' }));
    try {
      await followService.declineRequest(reqId);
      setRequests((prev) => prev.filter((r) => (r.requestId || r.id || r._id) !== reqId));
    } catch (err) {
      console.log('[DELETE ERROR]', err.message);
      alert('Failed to decline follow request. Please try again.');
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[reqId];
        return next;
      });
    }
  };

  const renderItem = ({ item }) => {
    const reqId = item.requestId || item.id || item._id;
    const isBusy = Boolean(actionLoading[reqId]);
    const followerId = item.followerId || item.user?._id || item.user;

    return (
      <View style={styles.requestRow}>
        <TouchableOpacity
          style={styles.userInfoRow}
          activeOpacity={0.8}
          onPress={() => {
            if (followerId) router.push(`/user-profile?userId=${followerId}`);
          }}
        >
          {item.avatarUri ? (
            <Image source={{ uri: item.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Ionicons name="person" size={22} color="#9CA3AF" />
            </View>
          )}

          <View style={styles.nameBlock}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.displayName || 'Rubaru User'}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              {item.username ? `@${item.username}` : 'Wants to follow you'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.confirmBtn, isBusy && styles.btnDisabled]}
            disabled={isBusy}
            activeOpacity={0.8}
            onPress={() => handleConfirm(item)}
          >
            {actionLoading[reqId] === 'confirming' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.confirmBtnText}>Confirm</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.deleteBtn, isBusy && styles.btnDisabled]}
            disabled={isBusy}
            activeOpacity={0.8}
            onPress={() => handleDelete(item)}
          >
            {actionLoading[reqId] === 'deleting' ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Follow Requests</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.divider} />

      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF2E63" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="people-outline" size={44} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>No Follow Requests</Text>
          <Text style={styles.emptySubtitle}>
            When people request to follow your private account, you'll see them here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.requestId || item.id || item._id || String(Math.random())}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchRequests(true)}
              colors={['#FF2E63']}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRightPlaceholder: {
    width: 32,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  listContent: {
    paddingVertical: 12,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nameBlock: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmBtn: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#EFEFEF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
