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
import BottomTabBar from '../components/common/BottomTabBar';
import StoryAvatar from '../components/common/StoryAvatar';
import ChatListItem from '../components/common/ChatListItem';
import EmptyStateIllustration from '../components/common/EmptyStateIllustration';
import { useTheme } from '../theme/index';
import { useLanguage } from '../localization/LanguageContext';
import api from '../services/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';

function getAvatarUrl(uri) {
  if (!uri) return '';
  if (uri.startsWith('http')) return uri;
  return `${BASE_URL}${uri}`;
}

export default function ChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode, colors } = useTheme();
  const { t } = useLanguage();
  const [chats, setChats] = useState([]);
  const [myProfile, setMyProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchChats = useCallback(() => {
    async function load() {
      try {
        const [chatsRes, meRes] = await Promise.all([
          api.get('/chats'),
          api.get('/profiles/me'),
        ]);
        setMyProfile(meRes.data);

        // Map API response to ChatListItem shape
        const mapped = chatsRes.data.map((c) => {
          const lastMsg = c.lastMessage;
          let msgType = 'text';
          let msgText = lastMsg?.text || 'Start a conversation';
          if (lastMsg?.type === 'image') { msgType = 'photo'; msgText = 'Photo'; }
          if (lastMsg?.type === 'voice') { msgType = 'audio'; msgText = 'Voice message'; }

          return {
            id: c.id,
            chatId: c.id,
            name: c.isGroup ? c.groupName : (c.otherParticipant?.displayName || 'Rubaru User'),
            avatarUrl: c.isGroup
              ? getAvatarUrl(c.groupAvatar)
              : getAvatarUrl(c.otherParticipant?.avatarUri),
            recipientId: c.otherParticipant?.userId,
            messageType: msgType,
            messageText: msgText,
            time: lastMsg?.createdAt
              ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
          };
        });
        setChats(mapped);
      } catch (e) {
        console.log('[CHATS FETCH ERROR]', e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useFocusEffect(fetchChats);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const myAvatarUrl = myProfile?.avatarUri ? getAvatarUrl(myProfile.avatarUri) : '';
  const myInitials = myProfile?.displayName
    ? myProfile.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'ME';

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
          style={[styles.profileBadge, { backgroundColor: colors.avatarBg || '#FF2E63' }]}
          onPress={() => router.push('/user-profile')}
        >
          <Text style={styles.profileText}>{myInitials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // My own story bubble + contacts from chats
  const storiesData = [
    {
      id: 'me',
      name: 'My Story',
      imageUrl: myAvatarUrl || 'https://i.pravatar.cc/150?img=1',
      isFirst: true,
    },
    ...chats.slice(0, 8).map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.avatarUrl || 'https://i.pravatar.cc/150?img=2',
    })),
  ];

  return (
    <View style={[styles.safeContainer, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.headerBg} />

      {renderHeader()}

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#FF2E63" />
        </View>
      ) : chats.length === 0 ? (
        <LinearGradient
          colors={['#FFF8F5', '#FFD9E0']}
          style={styles.gradientBackground}
        >
          <View style={styles.watermarkContainer} pointerEvents="none">
            <Ionicons name="heart" size={48} color="#FFC9D4" style={[styles.heart, { top: 40, left: 12, transform: [{ rotate: '-15deg' }], opacity: 0.25 }]} />
            <Ionicons name="heart" size={24} color="#FFC9D4" style={[styles.heart, { top: 110, left: 8, transform: [{ rotate: '20deg' }], opacity: 0.15 }]} />
            <Ionicons name="heart" size={32} color="#FFC9D4" style={[styles.heart, { top: 70, left: 80, transform: [{ rotate: '-5deg' }], opacity: 0.18 }]} />
          </View>
          <View style={styles.emptyContentContainer}>
            <EmptyStateIllustration />
            <Text style={[styles.emptyTitleText, { color: colors.textPrimary }]}>No Conversations Yet</Text>
            <Text style={[styles.emptySubtextText, { color: colors.textSecondary }]}>
              Start a new chat or invite others to join the conversation.
            </Text>
          </View>
        </LinearGradient>
      ) : (
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
                  onPress={
                    item.isFirst
                      ? () => router.push('/add-story')
                      : () => router.push({ pathname: '/view-story', params: { name: item.name, imageUrl: item.imageUrl } })
                  }
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
  safeContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  headerContainer: { paddingHorizontal: 20, paddingBottom: 6, backgroundColor: '#FFFFFF' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButtonContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: -8, paddingVertical: 4, paddingHorizontal: 4 },
  headerTitleText: { fontSize: 28, fontWeight: '800', color: '#000000', marginLeft: 8, letterSpacing: -0.5 },
  profileBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF2E63', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF2E63', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  profileText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  gradientBackground: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  watermarkContainer: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  heart: { position: 'absolute' },
  emptyContentContainer: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, zIndex: 1 },
  emptyTitleText: { fontSize: 19, fontWeight: '700', color: '#000000', marginTop: 28, textAlign: 'center' },
  emptySubtextText: { fontSize: 14, color: '#8E8E93', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: '85%' },
  storiesContainer: { marginVertical: 10 },
  storiesContentContainer: { paddingHorizontal: 20, paddingBottom: 12 },
  listContentContainer: { paddingBottom: 90 },
});
