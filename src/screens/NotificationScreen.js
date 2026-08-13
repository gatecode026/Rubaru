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
import BottomTabBar from '../components/common/BottomTabBar';

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
      { text: 'Chirag ', bold: true },
      { text: 'liked ' },
      { text: 'Geeta_Bisht ', bold: true },
      { text: 'photo. ' },
      { text: '3h', isTime: true },
    ],
    singleThumbnail: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?w=300',
  },
];

export default function NotificationScreen({ isNestedInPager }) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header component */}
      <SegmentedNotifCallsHeader activeTab="notification" />

      <View style={styles.dividerLine} />

      {/* Main List */}
      <FlatList
        data={notificationsData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <NotificationRow item={item} />}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={false}
      />
      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Notification"
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
    backgroundColor: '#FFFFFF',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#EFEFF4',
  },
  listContentContainer: {
    paddingBottom: 90,
    paddingTop: 8,
  },
});
