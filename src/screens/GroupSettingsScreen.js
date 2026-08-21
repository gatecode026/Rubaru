import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GroupSettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const groupName = params.name || 'Product Team';
  const groupInitials = params.initials || 'PT';

  const [muteNotifications, setMuteNotifications] = useState(false);

  const membersData = [
    {
      id: '1',
      name: 'Priya Shah',
      role: 'Owner',
      avatarBg: '#FF6584',
      initials: 'PS',
      isOwner: true,
      isOnline: true,
    },
    {
      id: '2',
      name: 'Raj Singh',
      role: 'Member',
      avatarBg: '#6366F1',
      initials: 'RS',
      isOwner: false,
    },
    {
      id: '3',
      name: 'Sara Kapoor',
      role: 'Member',
      avatarBg: '#F59E0B',
      initials: 'SK',
      isOwner: false,
    },
  ];

  const handleAdminSettingsPress = () => {
    router.push('/group-admin-settings');
  };

  const handleEditGroupInfo = () => {
    router.push({
      pathname: '/edit-group-info',
      params: {
        name: groupName,
        initials: groupInitials,
      },
    });
  };

  return (
    <View style={styles.rootContainer}>
      <LinearGradient colors={['#FFF0F3', '#FFFFFF']} style={styles.gradientBg}>
        {/* Header Row Matching Image 2 */}
        <View style={[styles.topHeaderRow, { paddingTop: Math.max(insets.top + 6, 20) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>

          <Text style={styles.headerTitleText}>Group Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Group Avatar & Profile Section */}
          <View style={styles.groupProfileSection}>
            <LinearGradient
              colors={['#FF6584', '#FF2E63']}
              style={styles.largeGroupAvatar}
            >
              <Text style={styles.largeAvatarText}>{groupInitials}</Text>
            </LinearGradient>

            <Text style={styles.groupNameTitle}>{groupName}</Text>
            <Text style={styles.groupMetaText}>Created by Priya Shah · Aug 2026</Text>

            <Pressable onPress={handleEditGroupInfo} style={styles.editInfoBtn}>
              <Text style={styles.editInfoText}>Edit group info</Text>
            </Pressable>
          </View>

          {/* Members Section Matching Image 2 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <Ionicons name="people-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeadingText}>Members (8)</Text>
              </View>
              <Pressable hitSlop={8}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            {/* Members List */}
            {membersData.map((member) => (
              <View key={member.id} style={styles.memberRowItem}>
                <View style={[styles.memberAvatarCircle, { backgroundColor: member.avatarBg }]}>
                  <Text style={styles.memberInitialsText}>{member.initials}</Text>
                  {member.isOnline && <View style={styles.onlineDot} />}
                </View>

                <View style={styles.memberInfoCol}>
                  <Text style={styles.memberNameText}>{member.name}</Text>
                  <Text style={styles.memberRoleSubtext}>{member.role}</Text>
                </View>

                {member.isOwner && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>Owner</Text>
                  </View>
                )}
              </View>
            ))}

            <Pressable style={styles.moreMembersBtn}>
              <Text style={styles.moreMembersText}>+5 more members</Text>
            </Pressable>
          </View>

          {/* Admin Settings Shortcut Banner */}
          <Pressable
            onPress={handleAdminSettingsPress}
            style={({ pressed }) => [styles.adminShortcutCard, pressed && styles.pressed]}
          >
            <View style={styles.adminShortcutLeft}>
              <View style={styles.shieldBadge}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#FF2E63" />
              </View>
              <View>
                <Text style={styles.adminShortcutTitle}>Admin Settings</Text>
                <Text style={styles.adminShortcutSub}>Manage permissions, approvals & roles</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>

          {/* Notifications Section Matching Image 2 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <Ionicons name="notifications-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeadingText}>Notifications</Text>
              </View>
            </View>

            {/* Mute Notifications Row */}
            <View style={styles.optionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitleText}>Mute notifications</Text>
                <Text style={styles.optionDescText}>Turn off alerts for this group</Text>
              </View>
              <Switch
                value={muteNotifications}
                onValueChange={setMuteNotifications}
                trackColor={{ false: '#E5E7EB', true: '#FF2E63' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Custom Notification Sound Row */}
            <Pressable style={styles.optionRow}>
              <Text style={[styles.optionTitleText, { flex: 1 }]}>Custom notification sound</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>
          </View>

          {/* Shared Media Section Matching Image 2 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <Ionicons name="images-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeadingText}>Shared Media (24)</Text>
              </View>
              <Pressable hitSlop={8}>
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            {/* Media 3-Column Grid */}
            <View style={styles.mediaGridContainer}>
              <LinearGradient colors={['#FFE4E8', '#FFD1DC']} style={styles.mediaCard}>
                <Ionicons name="image-outline" size={24} color="#FF6584" />
              </LinearGradient>

              <LinearGradient colors={['#E0E7FF', '#C7D2FE']} style={styles.mediaCard}>
                <Ionicons name="image-outline" size={24} color="#6366F1" />
              </LinearGradient>

              <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.mediaCard}>
                <Ionicons name="image-outline" size={24} color="#F59E0B" />
              </LinearGradient>

              <LinearGradient colors={['#FFE4E8', '#FFD1DC']} style={styles.mediaCard}>
                <Ionicons name="image-outline" size={24} color="#FF6584" />
              </LinearGradient>

              <LinearGradient colors={['#E0E7FF', '#C7D2FE']} style={styles.mediaCard}>
                <Ionicons name="image-outline" size={24} color="#6366F1" />
              </LinearGradient>

              <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.mediaCard}>
                <Ionicons name="image-outline" size={24} color="#F59E0B" />
              </LinearGradient>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const CARD_PADDING = 18;
const SCREEN_PADDING = 20;
const INNER_WIDTH = SCREEN_WIDTH - (SCREEN_PADDING * 2) - (CARD_PADDING * 2);
const MEDIA_GAP = 8;
const MEDIA_CARD_WIDTH = Math.floor((INNER_WIDTH - (MEDIA_GAP * 2)) / 3);

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  gradientBg: {
    flex: 1,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  groupProfileSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  largeGroupAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  largeAvatarText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  groupNameTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  groupMetaText: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
  },
  editInfoBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editInfoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: CARD_PADDING,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeadingText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  memberRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  memberAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  memberInitialsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfoCol: {
    flex: 1,
  },
  memberNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  memberRoleSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  ownerBadge: {
    backgroundColor: '#FFE4E8',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  ownerBadgeText: {
    color: '#FF2E63',
    fontSize: 12,
    fontWeight: '700',
  },
  moreMembersBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  moreMembersText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  adminShortcutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 99, 0.15)',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  adminShortcutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shieldBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFE4E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminShortcutTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  adminShortcutSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  optionDescText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  mediaGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MEDIA_GAP,
    justifyContent: 'flex-start',
  },
  mediaCard: {
    width: MEDIA_CARD_WIDTH,
    height: MEDIA_CARD_WIDTH,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
