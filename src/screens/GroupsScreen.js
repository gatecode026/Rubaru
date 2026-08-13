import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import QuickActionAvatar from '../components/common/QuickActionAvatar';
import GroupCard from '../components/common/GroupCard';
import BottomTabBar from '../components/common/BottomTabBar';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;

const groupsMockData = [
  {
    id: '1',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=400',
    name: 'Faster MJ',
    statusColor: '#34C759',
    adminName: 'RAHUL YADAV',
  },
  {
    id: '2',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=400',
    name: 'Gossip Master',
    statusColor: '#E63956',
    adminName: 'ANAMIKA SAINI',
  },
  {
    id: '3',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg?w=400',
    name: 'Faster MJ',
    statusColor: '#34C759',
    adminName: 'RAHUL YADAV',
  },
  {
    id: '4',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=400',
    name: 'Gossip Master',
    statusColor: '#E63956',
    adminName: 'ANAMIKA SAINI',
  },
  {
    id: '5',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?w=400',
    name: 'Apex Predators',
    statusColor: '#34C759',
    adminName: 'VIKRAM SINGH',
  },
  {
    id: '6',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=400',
    name: 'Bollywood Charcha',
    statusColor: '#E63956',
    adminName: 'PRIYA SHARMA',
  },
  {
    id: '7',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=400',
    name: 'Valorant Club',
    statusColor: '#34C759',
    adminName: 'ADITYA ROY',
  },
  {
    id: '8',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?w=400',
    name: 'Coffee & Tea',
    statusColor: '#E63956',
    adminName: 'SNEHA GUPTA',
  },
  {
    id: '9',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=400',
    name: 'PUBG Warriors',
    statusColor: '#34C759',
    adminName: 'KARAN MALHOTRA',
  },
  {
    id: '10',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=400',
    name: 'Campus Confessions',
    statusColor: '#E63956',
    adminName: 'NEHA KAPOOR',
  },
  {
    id: '11',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg?w=400',
    name: 'FIFA Elite',
    statusColor: '#34C759',
    adminName: 'ROHIT MEHTA',
  },
  {
    id: '12',
    badgeLabel: 'Gossip Group',
    imageUri: 'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=400',
    name: 'Midnight Talks',
    statusColor: '#E63956',
    adminName: 'TANYA JOSHI',
  },
  {
    id: '13',
    badgeLabel: 'Gaming Group',
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?w=400',
    name: 'Speed Racers',
    statusColor: '#34C759',
    adminName: 'DEEPAK KUMAR',
  },
];

export default function GroupsScreen({ isNestedInPager }) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Quick Action Shortcuts Row */}
      <View style={styles.quickActionsRow}>
        <QuickActionAvatar
          label="Create Group"
          imageUri="https://i.pravatar.cc/150?img=60"
          showPlus={true}
          onPress={() => alert('Create Group tapped')}
        />
        <QuickActionAvatar
          label="All Groups"
          imageUri="https://i.pravatar.cc/150?img=33"
          showPlus={false}
          onPress={() => alert('All Groups tapped')}
        />
      </View>

      {/* "All Groups 13" Section Title */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitleText}>
          All Groups <Text style={styles.sectionCountText}>13</Text>
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
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
        <View style={styles.headerContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.circularHeaderButton}
            onPress={handleBack}
          >
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </TouchableOpacity>

          <Text style={styles.headerTitleText}>Groups</Text>

          <TouchableOpacity activeOpacity={0.7} style={styles.circularHeaderButton}>
            <Ionicons name="options-outline" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        {/* 2-Column Scrollable Groups Grid */}
        <FlatList
          data={groupsMockData}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridColumnWrapper}
          ListHeaderComponent={renderListHeader}
          renderItem={({ item }) => <GroupCard item={item} />}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Groups"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      )}
    </SafeAreaView>
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
    paddingTop: STATUSBAR_HEIGHT + 6,
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
  gridColumnWrapper: {
    justifyContent: 'space-between',
  },
});
