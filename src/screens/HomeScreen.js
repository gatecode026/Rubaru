import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import StoryAvatar from '../components/common/StoryAvatar';
import SegmentedTabs from '../components/common/SegmentedTabs';
import FeedCard from '../components/common/FeedCard';

const storiesData = [
  { id: '1', name: 'Sapna_Singh', imageUrl: 'https://i.pravatar.cc/150?img=32', isFirst: true },
  { id: '2', name: 'Deepika_Sharma', imageUrl: 'https://i.pravatar.cc/150?img=47' },
  { id: '3', name: 'Mahi_Rajput', imageUrl: 'https://i.pravatar.cc/150?img=38' },
  { id: '4', name: 'Sonali_Thakur', imageUrl: 'https://i.pravatar.cc/150?img=49' },
  { id: '5', name: 'Pooja_Rana', imageUrl: 'https://i.pravatar.cc/150?img=45' },
];

const feedCardsData = [
  {
    id: 'feed-1',
    category: 'Travel',
    categoryEmoji: '🌴',
    imageUri: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&fit=crop',
    caption: 'If you could live anywhere in the world, where would you pick?',
    userName: 'Anjana_Kumawat',
    userAvatar: 'https://i.pravatar.cc/150?img=44',
    location: 'JAIPUR, RAJASTHAN',
    isLiked: false,
  },
  {
    id: 'feed-2',
    category: 'Football',
    categoryEmoji: '⚽',
    imageUri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop',
    caption: 'Who is your favorite football player of all time?',
    userName: 'Pooja_Singh',
    userAvatar: 'https://i.pravatar.cc/150?img=32',
    location: 'DELHI, INDIA',
    isLiked: true,
  },
  {
    id: 'feed-3',
    category: 'Music',
    categoryEmoji: '🎵',
    imageUri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop',
    caption: 'What song is on repeat for you right now?',
    userName: 'Sonali_Thakur',
    userAvatar: 'https://i.pravatar.cc/150?img=49',
    location: 'MUMBAI, INDIA',
    isLiked: false,
  },
  {
    id: 'feed-4',
    category: 'Coffee',
    categoryEmoji: '☕',
    imageUri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop',
    caption: 'Morning coffee or evening tea?',
    userName: 'Deepika_Sharma',
    userAvatar: 'https://i.pravatar.cc/150?img=47',
    location: 'BANGALORE, INDIA',
    isLiked: false,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const flatListRef = React.useRef(null);

  const renderFixedHeader = () => (
    <View style={styles.topHeaderContainer}>
      {/* Left Profile Avatar with Gradient Border */}
      <TouchableOpacity activeOpacity={0.8} style={styles.avatarGradientBorder}>
        <Image
          source={{ uri: 'https://i.pravatar.cc/150?img=60' }}
          style={styles.headerAvatarImage}
        />
      </TouchableOpacity>

      {/* Right Action Buttons matching exact reference images */}
      <View style={styles.headerRightButtons}>
        {/* Heart Count Gradient Pill */}
        <TouchableOpacity activeOpacity={0.8}>
          <LinearGradient
            colors={['#EE6876', '#C63449']}
            style={styles.heartPillButton}
          >
            <View style={styles.doubleHeartWrapper}>
              <Ionicons name="heart" size={22} color="#FFFFFF" />
              <Ionicons name="heart" size={11} color="#EE3B52" style={styles.innerHeart} />
            </View>
            <Text style={styles.heartCountText}>250</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Chat Speech Bubble Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/')}
        >
          <LinearGradient
            colors={['#EE6876', '#C63449']}
            style={styles.chatCircleButton}
          >
            <View style={styles.chatLinesContainer}>
              <View style={styles.chatLineTop} />
              <View style={styles.chatLineBottom} />
            </View>
            <View style={styles.chatSpeechTail} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF5F5" />

      {/* Soft Warm Pink Background Gradient */}
      <LinearGradient colors={['#FFF0F3', '#FFE3E8', '#FFD8E1']} style={styles.gradientBackground}>
        {/* Scattered soft pink floating hearts matching reference image */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Ionicons
            name="heart"
            size={52}
            color="#F492A5"
            style={[styles.heart, { top: 20, left: -12, transform: [{ rotate: '-20deg' }], opacity: 0.35 }]}
          />
          <Ionicons
            name="heart"
            size={42}
            color="#F492A5"
            style={[styles.heart, { top: 35, left: 162, transform: [{ rotate: '-15deg' }], opacity: 0.5 }]}
          />
          <Ionicons
            name="heart"
            size={34}
            color="#F492A5"
            style={[styles.heart, { top: 80, left: 210, transform: [{ rotate: '18deg' }], opacity: 0.55 }]}
          />
          <Ionicons
            name="heart"
            size={28}
            color="#F492A5"
            style={[styles.heart, { top: 122, left: 252, transform: [{ rotate: '-8deg' }], opacity: 0.4 }]}
          />
          <Ionicons
            name="heart"
            size={36}
            color="#F492A5"
            style={[styles.heart, { top: 10, left: 320, transform: [{ rotate: '12deg' }], opacity: 0.3 }]}
          />
        </View>

        {/* Fixed Pinned Top Header */}
        {renderFixedHeader()}

        {/* Single Scrollable Feed (FlatList) */}
        <FlatList
          ref={flatListRef}
          data={feedCardsData}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <FeedCard item={item} />}
          ListHeaderComponent={
            <>
              {/* Stories Horizontal Row */}
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={storiesData}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <StoryAvatar
                    name={item.name}
                    imageUrl={item.imageUrl}
                    isFirst={item.isFirst}
                  />
                )}
                contentContainerStyle={styles.storiesContentContainer}
                style={styles.storiesContainer}
              />

              {/* Segmented Filter Tabs */}
              <SegmentedTabs />
            </>
          }
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={false}
        />

        {/* Fixed Pinned Bottom Navigation Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.6}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Ionicons name="home" size={24} color="#F04452" />
            <Text style={[styles.tabLabel, styles.activeTabLabel]}>Home</Text>
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
          <TouchableOpacity
            style={styles.tabItem}
            activeOpacity={0.6}
            onPress={() => router.push('/notification')}
          >
            <Ionicons name="notifications-outline" size={24} color="#000000" />
            <Text style={styles.tabLabel}>Notification</Text>
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
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF5F5',
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
  topHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: STATUSBAR_HEIGHT + 6,
    paddingBottom: 6,
    zIndex: 10,
  },
  avatarGradientBorder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    borderWidth: 2,
    borderColor: '#E63956',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heartPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 10,
    shadowColor: '#8C162E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  doubleHeartWrapper: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  innerHeart: {
    position: 'absolute',
  },
  heartCountText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  chatCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#8C162E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 5,
  },
  chatLinesContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  chatLineTop: {
    width: 14,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
    marginBottom: 3,
  },
  chatLineBottom: {
    width: 9,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  chatSpeechTail: {
    position: 'absolute',
    bottom: 5,
    left: 4,
    width: 7,
    height: 7,
    backgroundColor: '#C63449',
    transform: [{ rotate: '45deg' }],
  },
  storiesContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  storiesContentContainer: {
    paddingHorizontal: 20,
  },
  feedContentContainer: {
    paddingBottom: 90,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4',
    paddingTop: 10,
    paddingBottom: 24,
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
    color: '#F04452',
    fontWeight: '700',
  },
});
