import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const categoriesList = [
  { id: '1', label: 'Gaming Group', icon: 'game-controller' },
  { id: '2', label: 'Gossip Group', icon: 'chatbubbles' },
  { id: '3', label: 'Entertainment', icon: 'musical-notes' },
  { id: '4', label: 'Dating & Chat', icon: 'heart' },
  { id: '5', label: 'Fitness & Sports', icon: 'fitness' },
];

export default function EditGroupInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [groupName, setGroupName] = useState(params.name || 'Product Team');
  const [description, setDescription] = useState(
    params.description || "Official group for Product Team. Share updates, chat about ideas, and hang out!"
  );
  const [selectedCategory, setSelectedCategory] = useState(
    params.category || 'Gossip Group'
  );
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarInitials, setAvatarInitials] = useState(params.initials || 'PT');

  const handleSave = () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Group name cannot be empty.');
      return;
    }
    Alert.alert('Success', 'Group info updated successfully!', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  const handleChangePhoto = () => {
    Alert.alert('Change Group Photo', 'Select photo source:', [
      { text: 'Camera', onPress: () => {} },
      { text: 'Choose from Gallery', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.rootContainer}>
      <LinearGradient colors={['#FFF0F3', '#FFFFFF']} style={styles.gradientBg}>
        {/* Top Header Row */}
        <View style={[styles.topHeaderRow, { paddingTop: Math.max(insets.top + 6, 20) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color="#111827" />
          </Pressable>

          <Text style={styles.headerTitleText}>Edit Group Info</Text>

          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={styles.saveHeaderText}>Save</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom + 24, 36) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Group Photo Section */}
            <View style={styles.photoSection}>
              <View style={styles.avatarWrapper}>
                <LinearGradient
                  colors={['#FF6584', '#FF2E63']}
                  style={styles.largeAvatar}
                >
                  <Text style={styles.avatarText}>{avatarInitials}</Text>
                </LinearGradient>

                <Pressable
                  onPress={handleChangePhoto}
                  style={({ pressed }) => [styles.cameraBadgeBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="camera" size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              <Pressable onPress={handleChangePhoto} style={styles.changePhotoLinkBtn}>
                <Text style={styles.changePhotoLinkText}>Change Group Photo</Text>
              </Pressable>
            </View>

            {/* Form Fields Card */}
            <View style={styles.formCard}>
              {/* Group Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelText}>Group Name</Text>
                <View style={styles.inputCard}>
                  <Ionicons name="people-outline" size={20} color="#9CA3AF" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.textInput}
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholder="Enter group name"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              {/* Group Category Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelText}>Group Category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryChipsRow}
                >
                  {categoriesList.map((cat) => {
                    const isSelected = selectedCategory === cat.label;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCategory(cat.label)}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipSelected,
                        ]}
                      >
                        <Ionicons
                          name={cat.icon}
                          size={14}
                          color={isSelected ? '#FFFFFF' : '#6B7280'}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextSelected,
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Group Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelText}>Description</Text>
                <View style={[styles.inputCard, styles.textareaCard]}>
                  <TextInput
                    style={[styles.textInput, styles.textareaInput]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What is this group about?"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Privacy Setting */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabelText}>Group Privacy</Text>
                <View style={styles.privacyOptionCard}>
                  <Pressable
                    onPress={() => setIsPrivate(false)}
                    style={[
                      styles.privacyTab,
                      !isPrivate && styles.privacyTabActive,
                    ]}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={18}
                      color={!isPrivate ? '#FF2E63' : '#6B7280'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.privacyTabText,
                        !isPrivate && styles.privacyTabTextActive,
                      ]}
                    >
                      Public
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setIsPrivate(true)}
                    style={[
                      styles.privacyTab,
                      isPrivate && styles.privacyTabActive,
                    ]}
                  >
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={isPrivate ? '#FF2E63' : '#6B7280'}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.privacyTabText,
                        isPrivate && styles.privacyTabTextActive,
                      ]}
                    >
                      Private
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.privacyDescText}>
                  {!isPrivate
                    ? 'Anyone can find and join this group freely.'
                    : 'Only invited members can join. New requests require admin approval.'}
                </Text>
              </View>

              {/* Primary Save Button */}
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
              >
                <LinearGradient
                  colors={['#FF2E63', '#E63956']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  saveHeaderText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FF2E63',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  largeAvatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },
  cameraBadgeBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FF2E63',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  changePhotoLinkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changePhotoLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inputGroup: {
    marginBottom: 22,
  },
  inputLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputCard: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFF0F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 99, 0.12)',
  },
  textareaCard: {
    height: 110,
    paddingVertical: 10,
    alignItems: 'flex-start',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  textareaInput: {
    height: '100%',
  },
  categoryChipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  privacyOptionCard: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
  },
  privacyTab: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  privacyTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  privacyTabTextActive: {
    color: '#FF2E63',
    fontWeight: '700',
  },
  privacyDescText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  saveBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.88,
  },
});
