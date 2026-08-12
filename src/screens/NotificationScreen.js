import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import NotificationRow from '../components/common/NotificationRow';
import SegmentedNotifCallsHeader from '../components/common/SegmentedNotifCallsHeader';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;

const notificationsData = [
  {
    id: '1',
    avatarUri: 'https://i.pravatar.cc/150?img=47',
    hasRing: false,
    layout: 'multi-thumb',
    time: '3h',
    titleParts: [
      { text: 'Shilpa ', bold: true },
      { text: 'liked 3 posts. ' },
      { text: '3h', isTime: true },
    ],
    thumbnails: [
      'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=300',
      'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=300',
      'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg?w=300',
    ],
  },
  {
    id: '2',
    avatarUri: 'https://i.pravatar.cc/150?img=38',
    secondaryAvatarUri: 'https://i.pravatar.cc/150?img=11',
    hasRing: false,
    layout: 'single-thumb',
    time: '3h',
    titleParts: [
      { text: 'Anuj ', bold: true },
      { text: 'and ' },
      { text: 'Chirag_love ', bold: true },
      { text: 'liked ' },
      { text: 'Geeta_Bisht ', bold: true },
      { text: 'photo. ' },
      { text: '3h', isTime: true },
    ],
    singleThumbnail: 'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=300',
  },
  {
    id: '3',
    avatarUri: 'https://i.pravatar.cc/150?img=11',
    hasRing: false,
    layout: 'none',
    time: '3h',
    titleParts: [
      { text: 'Balram ', bold: true },
      { text: 'started following ' },
      { text: 'Geeta_Bisht. ', bold: true },
      { text: '3h', isTime: true },
    ],
  },
  {
    id: '4',
    avatarUri: 'https://i.pravatar.cc/150?img=33',
    hasRing: false,
    layout: 'multi-thumb',
    time: '3h',
    titleParts: [
      { text: 'Chirag ', bold: true },
      { text: 'liked 8 posts. ' },
      { text: '3h', isTime: true },
    ],
    thumbnails: [
      'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=300',
      'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=300',
      'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg?w=300',
      'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=300',
      'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?w=300',
      'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=300',
      'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=300',
      'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?w=300',
    ],
  },
  {
    id: '5',
    avatarUri: 'https://i.pravatar.cc/150?img=38',
    secondaryAvatarUri: 'https://i.pravatar.cc/150?img=68',
    hasRing: false,
    layout: 'single-thumb',
    time: '3h',
    titleParts: [
      { text: 'Balram ', bold: true },
      { text: 'and ' },
      { text: 'Rahul ', bold: true },
      { text: 'liked ' },
      { text: "Geeta_bisht's ", bold: true },
      { text: 'post. ' },
      { text: '3h', isTime: true },
    ],
    singleThumbnail: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?w=300',
  },
  {
    id: '6',
    avatarUri: 'https://i.pravatar.cc/150?img=12',
    secondaryAvatarUri: 'https://i.pravatar.cc/150?img=68',
    hasRing: false,
    layout: 'single-thumb',
    time: '3h',
    titleParts: [
      { text: 'Omrishi_Choudhary ', bold: true },
      { text: 'and ' },
      { text: 'Animesh ', bold: true },
      { text: 'liked ' },
      { text: "Geeta_Bisht's ", bold: true },
      { text: 'post. ' },
      { text: '3h', isTime: true },
    ],
    singleThumbnail: 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=300',
  },
  {
    id: '7',
    avatarUri: 'https://i.pravatar.cc/150?img=47',
    hasRing: true,
    layout: 'single-thumb',
    time: '3h',
    titleParts: [
      { text: 'Shalini_Joshi ', bold: true },
      { text: 'liked ' },
      { text: "Geeta_Bisht's ", bold: true },
      { text: 'comment: ' },
      { text: '@Geet_Bisht ', isMention: true },
      { text: 'Nice! ' },
      { text: '3h', isTime: true },
    ],
    singleThumbnail: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=300',
  },
  {
    id: '8',
    avatarUri: 'https://i.pravatar.cc/150?img=60',
    hasRing: true,
    layout: 'multi-thumb',
    time: '3h',
    titleParts: [
      { text: 'Rahul_Kumawat ', bold: true },
      { text: 'liked 3 posts. ' },
      { text: '3h', isTime: true },
    ],
    thumbnails: [
      'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?w=300',
      'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?w=300',
      'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?w=300',
    ],
  },
];

export default function NotificationScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('notification'); // 'notification' | 'calls'

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <SegmentedNotifCallsHeader activeTab="notification" />

      {/* Notification Activity Feed */}
      <FlatList
        data={notificationsData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow item={item} />}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Fixed Pinned Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/explore')}
        >
          <Ionicons name="home-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/connection')}
        >
          <Ionicons name="pulse-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Connection</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/reels')}
        >
          <Ionicons name="play-circle-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Reels</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} activeOpacity={0.6}>
          <Ionicons name="notifications" size={24} color="#E63956" />
          <Text style={[styles.tabLabel, styles.activeTabLabel]}>Notification</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabItem}
          activeOpacity={0.6}
          onPress={() => router.push('/groups')}
        >
          <Ionicons name="people-outline" size={24} color="#000000" />
          <Text style={styles.tabLabel}>Groups</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: STATUSBAR_HEIGHT + 6,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginLeft: -6,
    paddingRight: 10,
    paddingVertical: 6,
  },
  tabRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  profileBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 8,
  },
  activeTabPill: {
    backgroundColor: '#E63956', // Bright red/pink active fill
  },
  inactiveTabPill: {
    backgroundColor: '#E5E5EA', // Light gray fill
  },
  tabPillText: {
    fontSize: 14,
  },
  activeTabPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inactiveTabPillText: {
    color: '#3A3A3C',
    fontWeight: '600',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#EFEFF4',
  },
  listContentContainer: {
    paddingBottom: 90,
    paddingTop: 8,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4',
    paddingTop: 8,
    paddingBottom: 16,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    zIndex: 20,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: '#000000',
    marginTop: 4,
  },
  activeTabLabel: {
    color: '#E63956',
    fontWeight: '700',
  },
});
