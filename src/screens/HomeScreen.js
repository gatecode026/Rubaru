import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import StoryAvatar from '../components/common/StoryAvatar';
import FeedCard from '../components/common/FeedCard';
import BottomTabBar from '../components/common/BottomTabBar';
import { usePointsStore } from '../store/pointsStore';
import api from '../services/api';

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
    imageUri: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800',
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
    imageUri: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800',
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
    imageUri: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
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
    imageUri: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800',
    caption: 'Morning coffee or evening tea?',
    userName: 'Deepika_Sharma',
    userAvatar: 'https://i.pravatar.cc/150?img=47',
    location: 'BANGALORE, INDIA',
    isLiked: false,
  },
];

export default function HomeScreen({ isNestedInPager }) {
  const router = useRouter();
  const flatListRef = React.useRef(null);
  const insets = useSafeAreaInsets();
  const balance = usePointsStore((state) => state.balance);
  const [profile, setProfile] = React.useState(null);

  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;
      const fetchMyProfile = async () => {
        try {
          const res = await api.get('/profiles/me');
          if (isMounted && res.data) {
            setProfile(res.data);
          }
        } catch (err) {
          console.log('[HOME PROFILE FETCH ERROR]', err.message);
        }
      };
      fetchMyProfile();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const getFullUrl = (uri) => {
    if (!uri) return 'https://i.pravatar.cc/150?img=60';
    if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('content://')) return uri;
    const apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.70:5000/api';
    const host = apiBase.replace('/api', '');
    return `${host}${uri}`;
  };

  const renderFixedHeader = () => (
    <View style={[styles.topHeaderContainer, { paddingTop: Math.max(insets.top + 6, 16) }]}>
      {/* Left Profile Avatar with Gradient Border */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.avatarGradientBorder}
        onPress={() => router.push('/user-profile')}
      >
        {(!profile?.avatarUri || profile.avatarUri.includes('pravatar.cc')) ? (
          <View style={[styles.headerAvatarImage, { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={20} color="#9CA3AF" />
          </View>
        ) : (
          <Image
            source={{ uri: getFullUrl(profile.avatarUri) }}
            style={styles.headerAvatarImage}
          />
        )}
      </TouchableOpacity>

      {/* Right Action Buttons matching exact reference images */}
      <View style={styles.headerRightButtons}>
        {/* Heart Count Gradient Pill */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/my-points')}>
          <LinearGradient
            colors={['#EE6876', '#C63449']}
            style={styles.heartPillButton}
          >
            <View style={styles.doubleHeartWrapper}>
              <Ionicons name="heart" size={22} color="#FFFFFF" />
              <Ionicons name="heart" size={11} color="#EE3B52" style={styles.innerHeart} />
            </View>
            <Text style={styles.heartCountText}>{balance}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Chat Icon Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/chats')}
        >
          <Image
            source={require('../assets/icons/chat_icon.png')}
            style={styles.chatIconImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.safeContainer}>
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
                    onPress={item.isFirst ? () => router.push('/add-story') : () => router.push({ pathname: '/view-story', params: { name: item.name, imageUrl: item.imageUrl } })}
                  />
                )}
                contentContainerStyle={styles.storiesContentContainer}
                style={styles.storiesContainer}
              />
            </>
          }
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={false}
        />
      </LinearGradient>
      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Home"
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
  chatIconImage: {
    width: 44,
    height: 44,
  },
  storiesContainer: {
    marginTop: 8,
    marginBottom: 18,
  },
  storiesContentContainer: {
    paddingHorizontal: 20,
  },
  feedContentContainer: {
    paddingBottom: 90,
  },
});
