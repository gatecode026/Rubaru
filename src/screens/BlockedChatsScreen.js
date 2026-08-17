import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Image,
  TextInput,
  FlatList,
  BackHandler,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../localization/LanguageContext';

const INITIAL_BLOCKED_USERS = [
  {
    id: '1',
    name: 'Geeta Bisht',
    username: '@geetabisht',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    blockedDate: '17 Aug 2026 . 10:30 AM',
  },
  {
    id: '2',
    name: 'Priya Sharma',
    username: '@priyasharma',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80',
    blockedDate: '17 Aug 2026 . 10:30 AM',
  },
  {
    id: '3',
    name: 'Ananya Roy',
    username: '@ananya_roy',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
    blockedDate: '17 Aug 2026 . 10:30 AM',
  },
  {
    id: '4',
    name: 'Kavita Mehta',
    username: '@kavita_m',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80',
    blockedDate: '17 Aug 2026 . 10:30 AM',
  },
  {
    id: '5',
    name: 'Sneha Patel',
    username: '@snehap',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
    blockedDate: '17 Aug 2026 . 10:30 AM',
  },
];

export default function BlockedChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [blockedUsers, setBlockedUsers] = useState(INITIAL_BLOCKED_USERS);

  const handleBack = () => {
    router.push('/user-profile?openSettings=true');
  };

  useEffect(() => {
    const onBackPress = () => {
      router.push('/user-profile?openSettings=true');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [router]);

  const handleUnblock = (user) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${user.name}? They will be able to message and find you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: () => {
            setBlockedUsers((prev) => prev.filter((u) => u.id !== user.id));
          },
        },
      ]
    );
  };

  const filteredUsers = blockedUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHeader = () => (
    <View style={styles.listHeaderWrapper}>
      {/* Search Input Bar */}
      <View style={styles.searchBarContainer}>
        <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search Blocked Chats...."
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Section Row Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionCountText}>
          Blocked Users ({filteredUsers.length})
        </Text>
        <Pressable style={styles.sortButton} hitSlop={6}>
          <Text style={styles.sortButtonText}>Last Blocked</Text>
          <Ionicons name="chevron-forward" size={14} color="#FF2E63" />
        </Pressable>
      </View>
    </View>
  );

  const renderItem = ({ item }) => (
    <View style={styles.userCard}>
      {/* Avatar */}
      <Image source={{ uri: item.avatar }} style={styles.avatarImage} />

      {/* User Info */}
      <View style={styles.userInfoCol}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.userHandle} numberOfLines={1}>
          {item.username}
        </Text>
        <Text style={styles.blockedDateText} numberOfLines={1}>
          Blocked on {item.blockedDate}
        </Text>
      </View>

      {/* Action Buttons Column */}
      <View style={styles.actionButtonsCol}>
        <Pressable
          onPress={() => router.push('/user-profile')}
          style={({ pressed }) => [styles.viewProfileBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.viewProfileText}>View Profile</Text>
        </Pressable>

        <Pressable
          onPress={() => handleUnblock(item)}
          style={({ pressed }) => [styles.unblockBtn, pressed && styles.btnPressed]}
        >
          <Text style={styles.unblockBtnText}>Unblock</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.bottomHelpCard}>
      <View style={styles.helpIconBadge}>
        <Ionicons name="shield-half-outline" size={22} color="#FF2E63" />
      </View>

      <View style={styles.helpTextCol}>
        <Text style={styles.helpTitle}>Need Help ?</Text>
        <Text style={styles.helpBody}>
          If someone is harassing or threatening you, please report them to our team.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/report-violations')}
        style={({ pressed }) => [styles.reportBtn, pressed && styles.btnPressed]}
      >
        <Text style={styles.reportBtnText}>Report User</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.rootContainer}>
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View
          style={[
            styles.mainWrapper,
            {
              paddingTop: Math.max(insets.top + 10, 36),
              paddingBottom: Math.max(insets.bottom, 6),
            },
          ]}
        >
          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.btnPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Blocked Chats</Text>

            <View style={{ width: 40 }} />
          </View>

          {/* List */}
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContentContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={48} color="#9CA3AF" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No Blocked Users</Text>
                <Text style={styles.emptySubtitle}>You haven't blocked any conversations.</Text>
              </View>
            }
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
    paddingHorizontal: 16,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  listHeaderWrapper: {
    paddingBottom: 8,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#4B5563',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionCountText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sortButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#FF2E63',
  },
  listContentContainer: {
    paddingBottom: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
  },
  userInfoCol: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  blockedDateText: {
    fontSize: 10.5,
    color: '#FF2E63',
    fontWeight: '500',
  },
  actionButtonsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  viewProfileBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewProfileText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  unblockBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FF2E63',
  },
  unblockBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bottomHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  helpIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 46, 99, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  helpTextCol: {
    flex: 1,
    marginRight: 8,
  },
  helpTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  helpBody: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 15,
  },
  reportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FF2E63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
