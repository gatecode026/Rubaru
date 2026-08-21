import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function GroupAdminSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Permission switches state matching Image 3
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(true);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);
  const [approveMembers, setApproveMembers] = useState(true);

  // Managed members state
  const [membersList, setMembersList] = useState([
    {
      id: '1',
      name: 'Priya Shah',
      role: 'Owner',
      roleType: 'owner',
      avatarBg: '#FF6584',
      initials: 'PS',
    },
    {
      id: '2',
      name: 'Arjun Mehta',
      role: 'Admin',
      roleType: 'admin',
      avatarBg: '#6366F1',
      initials: 'AM',
    },
    {
      id: '3',
      name: 'Sara Kapoor',
      role: 'Member',
      roleType: 'member',
      avatarBg: '#F59E0B',
      initials: 'SK',
    },
    {
      id: '4',
      name: 'Karan Verma',
      role: 'Requested to join',
      roleType: 'pending',
      avatarBg: '#9CA3AF',
      initials: 'KV',
      isPending: true,
    },
  ]);

  const handlePromoteAdmin = (id) => {
    setMembersList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, role: 'Admin', roleType: 'admin' } : item
      )
    );
  };

  const handleRemoveAdmin = (id) => {
    setMembersList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, role: 'Member', roleType: 'member' } : item
      )
    );
  };

  const handleRemoveMember = (id) => {
    setMembersList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleApprove = (id) => {
    setMembersList((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, role: 'Member', roleType: 'member', isPending: false }
          : item
      )
    );
  };

  const handleDecline = (id) => {
    setMembersList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to permanently remove this group and all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => router.replace('/(tabs)/groups'),
        },
      ]
    );
  };

  return (
    <View style={styles.rootContainer}>
      <LinearGradient colors={['#FFF0F3', '#FFFFFF']} style={styles.gradientBg}>
        {/* Header Row Matching Image 3 */}
        <View style={[styles.topHeaderRow, { paddingTop: Math.max(insets.top + 6, 20) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>

          <Text style={styles.headerTitleText}>Admin Settings</Text>

          <View style={styles.rightShieldBtn}>
            <Ionicons name="shield-outline" size={24} color="#FF2E63" />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Permissions Section Matching Image 3 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="options-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
              <Text style={styles.sectionHeadingText}>Permissions</Text>
            </View>

            {/* Switch 1: Only admins can send messages */}
            <View style={styles.permissionRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.permTitleText}>Only admins can send messages</Text>
                <Text style={styles.permDescText}>Members can only view messages</Text>
              </View>
              <Switch
                value={onlyAdminsSend}
                onValueChange={setOnlyAdminsSend}
                trackColor={{ false: '#E5E7EB', true: '#FF2E63' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Switch 2: Only admins can edit group info */}
            <View style={styles.permissionRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.permTitleText}>Only admins can edit group info</Text>
              </View>
              <Switch
                value={onlyAdminsEdit}
                onValueChange={setOnlyAdminsEdit}
                trackColor={{ false: '#E5E7EB', true: '#FF2E63' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Switch 3: Approve new members */}
            <View style={[styles.permissionRow, { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.permTitleText}>Approve new members</Text>
                <Text style={styles.permDescText}>New members need admin approval</Text>
              </View>
              <Switch
                value={approveMembers}
                onValueChange={setApproveMembers}
                trackColor={{ false: '#E5E7EB', true: '#FF2E63' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Manage Members Section Matching Image 3 */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleLeft}>
                <Ionicons name="people-outline" size={20} color="#111827" style={{ marginRight: 8 }} />
                <Text style={styles.sectionHeadingText}>Manage Members (8)</Text>
              </View>
              <Pressable hitSlop={8}>
                <Text style={styles.addMemberText}>+ Add</Text>
              </Pressable>
            </View>

            {/* Member List with Admin Action Links */}
            {membersList.map((member) => (
              <View key={member.id} style={styles.managedMemberItem}>
                <View style={styles.managedTopRow}>
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: member.avatarBg },
                      member.isPending && styles.pendingAvatarDashed,
                    ]}
                  >
                    <Text style={styles.avatarInitials}>{member.initials}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.managedNameText}>{member.name}</Text>
                    <Text
                      style={[
                        styles.managedSubtext,
                        member.isPending && styles.pendingSubtext,
                      ]}
                    >
                      {member.role}
                    </Text>
                  </View>

                  {/* Role Badges */}
                  {member.roleType === 'owner' && (
                    <View style={styles.badgeOwner}>
                      <Text style={styles.badgeOwnerText}>Owner</Text>
                    </View>
                  )}
                  {member.roleType === 'admin' && (
                    <View style={styles.badgeAdmin}>
                      <Text style={styles.badgeAdminText}>Admin</Text>
                    </View>
                  )}
                  {member.roleType === 'member' && (
                    <View style={styles.badgeMember}>
                      <Text style={styles.badgeMemberText}>Member</Text>
                    </View>
                  )}
                  {member.roleType === 'pending' && (
                    <View style={styles.badgePending}>
                      <Text style={styles.badgePendingText}>Pending</Text>
                    </View>
                  )}
                </View>

                {/* Sub Action Links (Promote, Remove, Approve, Decline) */}
                <View style={styles.actionLinksRow}>
                  {member.roleType === 'admin' && (
                    <Pressable onPress={() => handleRemoveAdmin(member.id)} hitSlop={8}>
                      <Text style={styles.redActionText}>Remove admin</Text>
                    </Pressable>
                  )}

                  {member.roleType === 'member' && (
                    <>
                      <Pressable onPress={() => handlePromoteAdmin(member.id)} hitSlop={8} style={{ marginRight: 16 }}>
                        <Text style={styles.darkActionText}>Promote to admin</Text>
                      </Pressable>
                      <Pressable onPress={() => handleRemoveMember(member.id)} hitSlop={8}>
                        <Text style={styles.redActionText}>Remove</Text>
                      </Pressable>
                    </>
                  )}

                  {member.roleType === 'pending' && (
                    <>
                      <Pressable onPress={() => handleApprove(member.id)} hitSlop={8} style={{ marginRight: 16 }}>
                        <Text style={styles.greenActionText}>Approve</Text>
                      </Pressable>
                      <Pressable onPress={() => handleDecline(member.id)} hitSlop={8}>
                        <Text style={styles.redActionText}>Decline</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>

          {/* Danger Zone Section Matching Image 3 */}
          <View style={styles.dangerSectionContainer}>
            <Text style={styles.dangerHeadingText}>Danger Zone</Text>

            <View style={styles.dangerCard}>
              {/* Delete Group */}
              <Pressable
                onPress={handleDeleteGroup}
                style={({ pressed }) => [styles.dangerRow, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={22} color="#EF4444" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerTitleText}>Delete Group</Text>
                  <Text style={styles.dangerDescText}>Permanently remove this group and all messages</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>

              {/* Leave Group */}
              <Pressable
                onPress={() => router.replace('/(tabs)/groups')}
                style={({ pressed }) => [styles.dangerRow, { borderBottomWidth: 0 }, pressed && styles.pressed]}
              >
                <Ionicons name="exit-outline" size={22} color="#EF4444" style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerTitleText}>Leave Group</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

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
  rightShieldBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
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
  addMemberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  permTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  permDescText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  managedMemberItem: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  managedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pendingAvatarDashed: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    backgroundColor: '#FFFFFF',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  managedNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  managedSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  pendingSubtext: {
    color: '#D97706',
    fontWeight: '600',
  },
  badgeOwner: {
    backgroundColor: '#FFE4E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeOwnerText: {
    color: '#FF2E63',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeAdmin: {
    backgroundColor: '#FFE4E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeAdminText: {
    color: '#FF2E63',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeMember: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeMemberText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePendingText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  actionLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 54,
    marginTop: 6,
  },
  redActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2E63',
  },
  darkActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  greenActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  dangerSectionContainer: {
    marginTop: 4,
  },
  dangerHeadingText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#EF4444',
    marginBottom: 12,
  },
  dangerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dangerTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  dangerDescText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
