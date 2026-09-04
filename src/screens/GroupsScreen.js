import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import QuickActionAvatar from '../components/common/QuickActionAvatar';
import GroupCard from '../components/common/GroupCard';
import BottomTabBar from '../components/common/BottomTabBar';
import GroupFilterModal from '../components/common/GroupFilterModal';
import { useTheme } from '../theme';
import { useLanguage } from '../localization/LanguageContext';
import api from '../services/api';
import messagingService from '../services/messagingService';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';

function getFullAvatarUrl(uri) {
  if (!uri) return 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400';
  if (uri.startsWith('http') || uri.startsWith('file://')) return uri;
  return `${BASE_URL}${uri}`;
}

export default function GroupsScreen({ isNestedInPager }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterState, setFilterState] = useState({
    category: 'all',
    sortBy: 'popular',
    status: 'all',
    groupSize: 'any',
  });

  const fetchGroups = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      let groupChats = [];
      try {
        const v1Res = await messagingService.listConversations({ type: 'GROUP' });
        const items = Array.isArray(v1Res) ? v1Res : (v1Res?.items || []);
        groupChats = items;
      } catch (e) {
        const res = await api.get('/chats');
        const allChats = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        groupChats = allChats.filter((c) => c.isGroup || c.type === 'GROUP');
      }

      const mappedGroups = groupChats.map((g, idx) => ({
        id: g.id || g._id || String(idx),
        badgeLabel: g.category || 'Community',
        imageUri: getFullAvatarUrl(g.groupAvatar || g.avatarUri),
        name: g.groupName || g.name || 'Group Chat',
        statusColor: '#34C759',
        adminName: g.adminName || (g.members && g.members[0]?.displayName) || 'Admin',
        membersCount: g.membersCount ? `${g.membersCount}` : (g.members?.length ? `${g.members.length}` : (g.memberCount ? `${g.memberCount}` : '1')),
      }));

      setGroups(mappedGroups);
    } catch (err) {
      console.log('[GROUPS FETCH ERROR]', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchGroups(false);
    }, [fetchGroups])
  );

  // Dynamically filter real groups based on category
  const filteredGroups = groups.filter((item) => {
    if (filterState.category === 'all') return true;
    const cat = filterState.category.toLowerCase();
    const badge = (item.badgeLabel || '').toLowerCase();
    return badge.includes(cat);
  });

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Quick Action Avatars Row */}
      <View style={styles.quickActionsRow}>
        <QuickActionAvatar
          label={t('addGroup', 'Add Group')}
          imageUri="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400"
          showPlus={true}
          onPress={() => router.push('/create-group')}
        />
        <QuickActionAvatar
          label={t('allGroups', 'All Groups')}
          imageUri="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400"
          showPlus={false}
          onPress={() => setFilterState((prev) => ({ ...prev, category: 'all' }))}
        />
      </View>

      {/* "All Groups" Section Title with Count */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleText}>
          {t('allGroupsCount', 'All Groups')}{' '}
          <Text style={[styles.sectionCountText, isDarkMode && styles.sectionCountTextDark]}>
            {filteredGroups.length}
          </Text>
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF0F3" />

      {/* Main Soft Pink Gradient Background */}
      <LinearGradient colors={['#FFF0F3', '#FFE3E8', '#FFFFFF']} style={styles.gradientBackground}>
        {/* Scattered faint watermark hearts */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Ionicons
            name="heart"
            size={48}
            color="#F492A5"
            style={[styles.heart, { top: 70, left: 16, transform: [{ rotate: '-15deg' }], opacity: 0.35 }]}
          />
          <Ionicons
            name="heart"
            size={28}
            color="#F492A5"
            style={[styles.heart, { top: 120, right: 30, transform: [{ rotate: '20deg' }], opacity: 0.25 }]}
          />
        </View>

        {/* Top Header Row */}
        <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 16) }]}>
          <Text style={styles.headerTitleText}>{t('groups', 'Groups')}</Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setFilterModalVisible(true)}
            style={[styles.circularHeaderButton, isDarkMode && styles.circularHeaderButtonDark]}
          >
            <Ionicons name="options-outline" size={22} color={isDarkMode ? '#FFFFFF' : '#000000'} />
          </TouchableOpacity>
        </View>

        {/* 2-Column Scrollable Groups Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF2E63" />
          </View>
        ) : (
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={filteredGroups.length > 0 ? styles.gridColumnWrapper : null}
            ListHeaderComponent={renderListHeader}
            renderItem={({ item }) => <GroupCard item={item} />}
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            onRefresh={() => fetchGroups(true)}
            refreshing={refreshing}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={56} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No groups yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create your first community or join groups with shared interests.
                </Text>
                <TouchableOpacity
                  style={styles.createGroupButton}
                  onPress={() => router.push('/create-group')}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.createGroupButtonText}>Create Group</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </LinearGradient>

      {/* Filter Bottom Sheet Modal */}
      <GroupFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onApplyFilters={setFilterState}
        initialFilters={filterState}
      />
      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Groups"
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
    backgroundColor: '#FFF0F3',
  },
  gradientBackground: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heart: {
    position: 'absolute',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  circularHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  circularHeaderButtonDark: {
    backgroundColor: '#1E1E1E',
  },
  headerTitleText: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    color: '#000000',
    letterSpacing: -0.5,
  },
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  listHeaderContainer: {
    marginBottom: 8,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontFamily: 'Inter-Bold',
    fontSize: 16,
    color: '#000000',
  },
  sectionCountText: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: '#666666',
  },
  sectionCountTextDark: {
    color: '#999999',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: 'Inter-Bold',
    fontSize: 18,
    color: '#111827',
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF2E63',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  createGroupButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});
