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
import BottomTabBar from '../components/common/BottomTabBar';
import StoryAvatar from '../components/common/StoryAvatar';
import ChatListItem from '../components/common/ChatListItem';
import EmptyStateIllustration from '../components/common/EmptyStateIllustration';
import { useTheme } from '../theme';
import { useLanguage } from '../localization/LanguageContext';

const storiesData = [
  { id: '1', name: 'Sapna_Singh', imageUrl: 'https://i.pravatar.cc/150?img=32', isFirst: true },
  { id: '2', name: 'Deepika_Sharma', imageUrl: 'https://i.pravatar.cc/150?img=47' },
  { id: '3', name: 'Mahi_Rajput', imageUrl: 'https://i.pravatar.cc/150?img=38' },
  { id: '4', name: 'Sonali_Thakur', imageUrl: 'https://i.pravatar.cc/150?img=49' },
  { id: '5', name: 'Pooja_Rana', imageUrl: 'https://i.pravatar.cc/150?img=45' },
];

const initialChatsData = [
  {
    id: '1',
    name: 'Rahul Kumawat',
    avatarUrl: 'https://i.pravatar.cc/150?img=11',
    onlineStatus: 'green',
    messageType: 'text',
    messageText: 'Lorem ipsum dolor sit amet consectetur.',
    time: '4:30 PM',
  },
  {
    id: '2',
    name: 'Uber Cars',
    isUber: true,
    messageType: 'text',
    sender: 'Sender',
    messageText: 'Lorem ipsum dolor sit amet consectetur...',
    time: '4:30 PM',
  },
  {
    id: '3',
    name: 'Sana KHan',
    avatarUrl: 'https://i.pravatar.cc/150?img=43',
    onlineStatus: 'green',
    messageType: 'video',
    messageText: 'Video',
    time: '4:30 PM',
    unreadCount: 1,
  },
  {
    id: '4',
    name: 'Animesh Jain',
    avatarUrl: 'https://i.pravatar.cc/150?img=68',
    onlineStatus: 'green',
    messageType: 'photo',
    messageText: 'Photo Lorem ipsum dolor sit amet consecte...',
    time: '4:30 PM',
  },
  {
    id: '5',
    name: 'Epic Game',
    avatarUrl: 'https://images.pexels.com/photos/163036/mario-yoschi-figures-funny-163036.jpeg?auto=compress&cs=tinysrgb&w=150',
    onlineStatus: 'orange',
    sender: 'John Paul',
    mentionUser: 'Robert',
    messageType: 'text',
    messageText: 'Lorem ipsum dolor...',
    time: '4:30 PM',
    hasMention: true,
    unreadCount: 24,
  },
  {
    id: '6',
    name: 'Govind Jain',
    initials: 'SF',
    hasAlert: true,
    messageType: 'audio',
    messageText: 'Audio',
    time: '4:30 PM',
  },
  {
    id: '7',
    name: 'Omrishi Sharma',
    avatarUrl: 'https://i.pravatar.cc/150?img=33',
    messageType: 'emoji',
    messageText: 'Emoji',
    time: '4:30 PM',
  },
  {
    id: '8',
    name: 'Innovative Online Chatting Group',
    avatarUrl: 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=150',
    messageType: 'thread',
    messageText: 'Thread Lorem ipsum dolor sit amet consectetur...',
    time: '4:30 PM',
  },
];

export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();
  const { t } = useLanguage();
  const [chats, setChats] = useState(initialChatsData);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const renderHeader = () => (
    <View style={[styles.headerContainer, { backgroundColor: colors.headerBg, paddingTop: Math.max(insets.top + 6, 16) }]}>
      <View style={styles.topRow}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.backButtonContainer}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          <Text style={[styles.headerTitleText, { color: colors.textPrimary }]}>{t('chats', 'Chats')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.profileBadge, { backgroundColor: colors.avatarBg }]}
          onPress={() => setChats(chats.length === 0 ? initialChatsData : [])}
        >
          <Text style={styles.profileText}>{colors.avatarInitials || (isDarkMode ? 'PS' : 'GB')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.safeContainer, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.headerBg} />

      {/* Main Header */}
      {renderHeader()}

      {/* Main Content Area */}
      {chats.length === 0 ? (
        /* Empty State View with Soft Pink Gradient */
        <LinearGradient
          colors={['#FFF8F5', '#FFD9E0']}
          style={styles.gradientBackground}
        >
          {/* Subtle watermark hearts */}
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Ionicons
              name="heart"
              size={48}
              color="#FFC9D4"
              style={[styles.heart, { top: 40, left: 12, transform: [{ rotate: '-15deg' }], opacity: 0.25 }]}
            />
            <Ionicons
              name="heart"
              size={24}
              color="#FFC9D4"
              style={[styles.heart, { top: 110, left: 8, transform: [{ rotate: '20deg' }], opacity: 0.15 }]}
            />
            <Ionicons
              name="heart"
              size={32}
              color="#FFC9D4"
              style={[styles.heart, { top: 70, left: 80, transform: [{ rotate: '-5deg' }], opacity: 0.18 }]}
            />
          </View>

          {/* Centered Empty State Content */}
          <View style={styles.emptyContentContainer}>
            <EmptyStateIllustration />
            <Text style={[styles.emptyTitleText, { color: colors.textPrimary }]}>No Conversations Yet</Text>
            <Text style={[styles.emptySubtextText, { color: colors.textSecondary }]}>
              Start a new chat or invite others to join the conversation.
            </Text>
          </View>
        </LinearGradient>
      ) : (
        /* Populated Chats List View matching Image 1 */
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatListItem item={item} />}
          ListHeaderComponent={
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
          }
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <BottomTabBar
        activeTab=""
        onTabPress={(tabKey) => {
          router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  headerTitleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF2E63', // Pink GB profile avatar as in reference image
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  profileText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80, // Offset for bottom tab bar height
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heart: {
    position: 'absolute',
  },
  emptyContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  emptyTitleText: {
    fontSize: 19,
    fontWeight: '700',
    color: '#000000',
    marginTop: 28,
    textAlign: 'center',
  },
  emptySubtextText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: '85%',
  },
  storiesContainer: {
    marginVertical: 10,
  },
  storiesContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listContentContainer: {
    paddingBottom: 90,
  },
});
