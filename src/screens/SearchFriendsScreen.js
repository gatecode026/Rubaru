import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_USERS = [
  { id: '1', name: 'Rani', username: 'rani_jaipur', avatar: 'https://images.pexels.com/photos/1382731/pexels-photo-1382731.jpeg?auto=compress&cs=tinysrgb&w=800', relation: 'New user' },
  { id: '2', name: 'Vandana', username: 'vandana_mumbai', avatar: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800', relation: '4.8 km away' },
  { id: '3', name: 'Keshav', username: 'keshav_delhi', avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=800', relation: '2.2 km away' },
  { id: '4', name: 'Meera', username: 'meera_pune', avatar: 'https://images.pexels.com/photos/1462637/pexels-photo-1462637.jpeg?auto=compress&cs=tinysrgb&w=800', relation: '1.2 km away' },
  { id: '5', name: 'Sapna Singh', username: 'Sapna_Singh', avatar: 'https://i.pravatar.cc/150?img=32', relation: 'Mutual friend' },
  { id: '6', name: 'Deepika Sharma', username: 'Deepika_Sharma', avatar: 'https://i.pravatar.cc/150?img=47', relation: 'Suggested for you' },
  { id: '7', name: 'Mahi Rajput', username: 'Mahi_Rajput', avatar: 'https://i.pravatar.cc/150?img=38', relation: 'Suggested for you' },
  { id: '8', name: 'Sonali Thakur', username: 'Sonali_Thakur', avatar: 'https://i.pravatar.cc/150?img=49', relation: 'Mutual friend' },
  { id: '9', name: 'Pooja Singh', username: 'Pooja_Singh', avatar: 'https://i.pravatar.cc/150?img=32', relation: 'Active 2h ago' },
  { id: '10', name: 'Samridhi Vijayvargi', username: 'samridhi_v', avatar: 'https://i.pravatar.cc/150?img=32', relation: 'Active 10m ago' },
  { id: '11', name: 'Ananya Roy', username: 'Ananya_Roy', avatar: 'https://i.pravatar.cc/150?img=49', relation: 'Suggested for you' },
  { id: '12', name: 'Kavya Sharma', username: 'Kavya_Sharma', avatar: 'https://i.pravatar.cc/150?img=44', relation: 'Suggested for you' },
];

export default function SearchFriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedUsers, setConnectedUsers] = useState({});
  const searchInputRef = useRef(null);

  const handleClearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  const toggleConnect = (userId) => {
    setConnectedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const filteredUsers = ALL_USERS.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isQueryEmpty = searchQuery.trim().length === 0;
  const listData = isQueryEmpty
    ? ALL_USERS.slice(4) // Show Sapna, Deepika, Mahi, Sonali, etc. when search query is empty
    : filteredUsers;

  const renderSearchItem = ({ item }) => {
    const isConnected = connectedUsers[item.id];
    return (
      <View style={styles.userRow}>
        <View style={styles.userLeft}>
          <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
          <View>
            <Text style={styles.userNameText}>{item.name}</Text>
            <Text style={styles.userUsernameText}>@{item.username}</Text>
            <Text style={styles.userRelationText}>{item.relation}</Text>
          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          style={isConnected ? styles.connectedButton : styles.connectButton}
          onPress={() => toggleConnect(item.id)}
        >
          <Text style={isConnected ? styles.connectedText : styles.connectText}>
            {isConnected ? 'Connected' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyResults = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
      <Text style={styles.emptyTitleText}>No users found</Text>
      <Text style={styles.emptySubtitleText}>
        We couldn't find any user matching "{searchQuery}"
      </Text>
    </View>
  );

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          
          {/* Instagram-like Header Search Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                router.back();
              }}
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
                placeholder="Search"
                placeholderTextColor="#8E8E93"
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search results or Suggested profiles list */}
          <FlatList
            data={listData}
            keyExtractor={(item) => item.id}
            renderItem={renderSearchItem}
            ListHeaderComponent={() => (
              <Text style={styles.sectionHeaderTitle}>
                {isQueryEmpty ? 'Suggested for you' : 'Search results'}
              </Text>
            )}
            ListEmptyComponent={renderEmptyResults}
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mainWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    marginRight: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 44,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontWeight: '500',
  },
  listContentContainer: {
    paddingVertical: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#E5E7EB',
  },
  userNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  userUsernameText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  userRelationText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '500',
  },
  connectButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  connectedButton: {
    backgroundColor: 'rgba(244, 70, 73, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 70, 73, 0.25)',
  },
  connectText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  connectedText: {
    color: '#F44649',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  emptySubtitleText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
