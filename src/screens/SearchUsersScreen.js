import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Dimensions,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';
function getAvatarUrl(uri) {
  if (!uri) return '';
  if (uri.startsWith('http')) return uri;
  return `${BASE_URL}${uri}`;
}

export default function SearchUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Load all users on mount for discovery
  useEffect(() => {
    async function loadAll() {
      try {
        const res = await api.get('/profiles/all');
        setUsers(res.data || []);
      } catch (e) {
        console.log('[SEARCH USERS] load all error:', e.message);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim()) {
      // Show all users when query cleared
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.get('/profiles/all');
          setUsers(res.data || []);
        } catch (e) {
          console.log('[SEARCH USERS] load all error:', e.message);
        } finally {
          setLoading(false);
        }
      }, 200);
      return;
    }

    // Debounce search
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/profiles/search?q=${encodeURIComponent(q.trim())}`);
        setUsers(res.data || []);
      } catch (e) {
        console.log('[SEARCH USERS] search error:', e.message);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const handleClearSearch = () => {
    handleSearch('');
    searchInputRef.current?.focus();
  };

  const navigateToProfile = (user) => {
    Keyboard.dismiss();
    router.push({
      pathname: '/user-profile',
      params: { userId: user.userId },
    });
  };

  const renderUserRow = ({ item }) => {
    const avatarUrl = getAvatarUrl(item.avatarUri);
    const initials = item.displayName
      ? item.displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
      : '?';

    return (
      <TouchableOpacity
        style={styles.userRow}
        activeOpacity={0.7}
        onPress={() => navigateToProfile(item)}
      >
        {/* Avatar */}
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatar, styles.initialsAvatar]}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userNameText} numberOfLines={1}>{item.displayName || 'Rubaru User'}</Text>
          {item.username ? (
            <Text style={styles.userUsernameText}>@{item.username}</Text>
          ) : null}
          {item.locationName ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#8E8E93" />
              <Text style={styles.userRelationText}>{item.locationName}</Text>
            </View>
          ) : item.bio ? (
            <Text style={styles.userRelationText} numberOfLines={1}>{item.bio}</Text>
          ) : null}
        </View>

        {/* Arrow */}
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </TouchableOpacity>
    );
  };

  const renderEmptyResults = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
      <Text style={styles.emptyTitleText}>
        {searchQuery.trim() ? 'No users found' : 'No users yet'}
      </Text>
      <Text style={styles.emptySubtitleText}>
        {searchQuery.trim()
          ? `No user matching "${searchQuery}"`
          : 'Be the first to invite friends to Rubaru!'}
      </Text>
    </View>
  );

  return (
    <View style={styles.rootContainer}>
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>

          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => { Keyboard.dismiss(); router.back(); }}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={18} color="#8E8E93" />
              <TextInput
                ref={searchInputRef}
                placeholder="Search people..."
                placeholderTextColor="#8E8E93"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={handleClearSearch} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </Pressable>
              )}
            </View>
          </View>

          <Text style={styles.sectionLabel}>
            {searchQuery.trim() ? `Results for "${searchQuery}"` : 'Discover People'}
          </Text>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#FF2E63" />
            </View>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => String(item.userId)}
              renderItem={renderUserRow}
              ListEmptyComponent={renderEmptyResults}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1 },
  backgroundImage: { flex: 1, width: SCREEN_WIDTH },
  mainWrapper: { flex: 1, paddingHorizontal: 20 },
  topHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backButton: { padding: 6, marginRight: 8 },
  buttonPressed: { opacity: 0.6 },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8, marginLeft: 2 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 24, flexGrow: 1 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  userAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#E5E7EB' },
  initialsAvatar: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#A288E3' },
  initialsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  userInfo: { flex: 1 },
  userNameText: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  userUsernameText: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  userRelationText: { fontSize: 12, color: '#8E8E93' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyTitleText: { fontSize: 17, fontWeight: '700', color: '#374151', marginBottom: 6 },
  emptySubtitleText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', maxWidth: '80%' },
});
