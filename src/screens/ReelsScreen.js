import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import ReelItem from '../components/common/ReelItem';
import BottomTabBar from '../components/common/BottomTabBar';

const reelsData = [
  {
    id: '1',
    userName: 'Vibhu',
    isVerified: true,
    userAvatar: 'https://i.pravatar.cc/150?img=32',
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: ['#7A2855', '#240A1A'],
    caption: 'Setting breakout variables in figma, supafast...',
    likedBy: 'ui.val and 8222 others',
    audioTrack: 'zanderwhitehu',
    likeCount: 8223,
    commentCount: 82,
    shareCount: 23,
    isLiked: true,
  },
  {
    id: '2',
    userName: 'Uttam',
    isVerified: true,
    userAvatar: 'https://i.pravatar.cc/150?img=49',
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: ['#8C3B2B', '#240C07'],
    caption: 'Golden hour glow in Jaipur 🌅✨',
    likedBy: 'rohit.s and 12449 others',
    audioTrack: 'jaipur_beats',
    likeCount: 12450,
    commentCount: 140,
    shareCount: 45,
    isLiked: false,
  },
  {
    id: '3',
    userName: 'Garv',
    isVerified: false,
    userAvatar: 'https://i.pravatar.cc/150?img=47',
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: ['#2A4D69', '#0B1724'],
    caption: "Match day vibes! Who's winning today? ⚽🔥",
    likedBy: 'rahul_k and 6889 others',
    audioTrack: 'stadium_chanti',
    likeCount: 6890,
    commentCount: 54,
    shareCount: 18,
    isLiked: false,
  },
  {
    id: '4',
    userName: 'Rahul',
    isVerified: true,
    userAvatar: 'https://i.pravatar.cc/150?img=44',
    imageUri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
    bgGradient: ['#4A3B69', '#140D24'],
    caption: 'Late night coffee conversations ☕💫',
    likedBy: 'sneha_v and 9119 others',
    audioTrack: 'lofi_chill_beats',
    likeCount: 9120,
    commentCount: 98,
    shareCount: 31,
    isLiked: true,
  },
];

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen({ isNestedInPager }) {
  const router = useRouter();
  // Each reel is the full window height — the image fills behind the tab bar, matching the reference
  const [reelHeight, setReelHeight] = useState(SCREEN_HEIGHT);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index);
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

  return (
    <View style={styles.screenContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-window feed — image fills behind everything */}
      <View style={styles.feedWrapper} onLayout={handleLayout}>
        {reelHeight > 0 && (
          <FlatList
            data={reelsData}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ReelItem
                item={item}
                height={reelHeight}
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
          />
        )}
      </View>
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
    overflow: 'hidden',
  },
});
