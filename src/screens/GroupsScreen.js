import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import QuickActionAvatar from '../components/common/QuickActionAvatar';
import GroupCard from '../components/common/GroupCard';
import BottomTabBar from '../components/common/BottomTabBar';
import GroupFilterModal from '../components/common/GroupFilterModal';
import { useTheme } from '../theme';
import { useLanguage } from '../localization/LanguageContext';

const groupsMockData = [
  {
    id: '1',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=400',
    name: 'Faster MJ',
    statusColor: '#34C759',
    adminName: 'RAHUL YADAV',
    membersCount: '2.4k',
  },
  {
    id: '2',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=400',
    name: 'Gossip Master',
    statusColor: '#E63956',
    adminName: 'ANAMIKA SAINI',
    membersCount: '1.8k',
  },
  {
    id: '3',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg?w=400',
    name: 'Faster MJ',
    statusColor: '#34C759',
    adminName: 'RAHUL YADAV',
    membersCount: '950',
  },
  {
    id: '4',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=400',
    name: 'Gossip Master',
    statusColor: '#E63956',
    adminName: 'ANAMIKA SAINI',
    membersCount: '3.1k',
  },
  {
    id: '5',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?w=400',
    name: 'Apex Predators',
    statusColor: '#34C759',
    adminName: 'VIKRAM SINGH',
    membersCount: '4.2k',
  },
  {
    id: '6',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=400',
    name: 'Bollywood Charcha',
    statusColor: '#E63956',
    adminName: 'PRIYA SHARMA',
    membersCount: '5.6k',
  },
  {
    id: '7',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=400',
    name: 'Valorant Club',
    statusColor: '#34C759',
    adminName: 'ADITYA ROY',
    membersCount: '1.1k',
  },
  {
    id: '8',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?w=400',
    name: 'Coffee & Tea',
    statusColor: '#E63956',
    adminName: 'SNEHA GUPTA',
    membersCount: '840',
  },
  {
    id: '9',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=400',
    name: 'PUBG Warriors',
    statusColor: '#34C759',
    adminName: 'KARAN MALHOTRA',
    membersCount: '3.8k',
  },
  {
    id: '10',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=400',
    name: 'Campus Confessions',
    statusColor: '#E63956',
    adminName: 'NEHA KAPOOR',
    membersCount: '2.9k',
  },
  {
    id: '11',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg?w=400',
    name: 'FIFA Elite',
    statusColor: '#34C759',
    adminName: 'ROHIT MEHTA',
    membersCount: '1.7k',
  },
  {
    id: '12',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=400',
    name: 'Midnight Talks',
    statusColor: '#E63956',
    adminName: 'TANYA JOSHI',
    membersCount: '4.5k',
  },
  {
    id: '13',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?w=400',
    name: 'Speed Racers',
    statusColor: '#34C759',
    adminName: 'DEEPAK KUMAR',
    membersCount: '1.2k',
  },
];

export default function GroupsScreen({ isNestedInPager }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterState, setFilterState] = useState({
    category: 'all',
    sortBy: 'popular',
    status: 'all',
    groupSize: 'any',
  });

  // Dynamically filter mock data based on category
  const filteredGroups = groupsMockData.filter((item) => {
    if (filterState.category === 'all') return true;
    const cat = filterState.category.toLowerCase();
    const badge = (item.badgeLabel || '').toLowerCase();
    return badge.includes(cat);
  });

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Quick Action Avatars Row */}
      <View style={styles.quickActionsRow}>
        <QuickActionAvatar
          label={t('addGroup', 'Add Group')}
          imageUri="https://i.pravatar.cc/150?img=12"
          showPlus={true}
          onPress={() => router.push('/create-group')}
        />
        <QuickActionAvatar
          label={t('gamingGroup', 'Gaming Group')}
          imageUri="https://i.pravatar.cc/150?img=33"
          showPlus={false}
          onPress={() => setFilterState((prev) => ({ ...prev, category: 'gaming' }))}
        />
        <QuickActionAvatar
          label={t('allGroups', 'All Groups')}
          imageUri="https://i.pravatar.cc/150?img=33"
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

      {/* Main Soft Pink Gradient Background (Preserved) */}
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
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridColumnWrapper}
          ListHeaderComponent={renderListHeader}
          renderItem={({ item }) => <GroupCard item={item} />}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />
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
    backgroundColor: '#1C1C1E',
  },
  headerTitleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#340E1B',
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  listHeaderContainer: {
    paddingTop: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 14,
  },
  sectionTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4B182B',
  },
  sectionCountText: {
    color: '#E63956',
    fontWeight: '800',
  },
  sectionCountTextDark: {
    color: '#000000',
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
  },
});
