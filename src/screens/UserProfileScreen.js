import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Image,
  ScrollView,
  Dimensions,
  Modal,
  Switch,
  PanResponder,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import BottomTabBar from '../components/common/BottomTabBar';
import { useTheme } from '../theme';
import { useLanguage } from '../localization/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 60) / 3;

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { language, setLanguage, t } = useLanguage();
  const [activeTab, setActiveTab] = useState('top');
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const scrollOffsetRef = useRef(0);

  // Swipe-to-dismiss & Tap-to-dismiss for Settings Bottom Sheet Handle
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 15 || gestureState.vy > 0.15) {
          setShowSettingsModal(false);
        } else if (Math.abs(gestureState.dy) < 15 && Math.abs(gestureState.dx) < 15) {
          // Tap on handle also closes
          setShowSettingsModal(false);
        }
      },
    })
  ).current;

  useFocusEffect(
    React.useCallback(() => {
      if (params?.openSettings === 'true') {
        setShowSettingsModal(true);
      }
    }, [params?.openSettings])
  );

  // 3-Step Delete Account Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1, 2, or 3
  const [selectedReason, setSelectedReason] = useState('Other');

  // Settings Toggles
  const { isDarkMode, toggleTheme, setDarkMode } = useTheme();
  const isHindi = language === 'hi';

  // Language flag slider animation (0 = English/Left, 1 = Hindi/Right)
  const langAnim = useRef(new Animated.Value(isHindi ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(langAnim, {
      toValue: isHindi ? 1 : 0,
      friction: 7,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [isHindi]);

  const toggleLanguage = () => {
    if (language === 'en') {
      setLanguage('hi');
    } else {
      setLanguage('en');
    }
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={showSettingsModal || showDeleteModal ? 4 : 0}
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 12, 40) }]}>

          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <Text numberOfLines={1} style={styles.headerTitle}>
              Geeta Bisht
            </Text>

            {/* 3 Dots Menu Button - Opens Settings Bottom Sheet Sidebar */}
            <Pressable
              onPress={() => setShowSettingsModal(true)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="More settings options"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#111827" />
            </Pressable>
          </View>

          {/* Main Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]}
          >
            {/* Avatar Photo Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarRingOuter}>
                <Image
                  source={require('@assets/images/onboarding2.jpg')}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>

              {/* Followers Count */}
              <Text style={styles.followersText}>{t('followersCount', '63K Followers')}</Text>
            </View>

            {/* Action Buttons Row (Follow, Message, Call) */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setIsFollowing(!isFollowing)}
                style={({ pressed }) => [
                  styles.actionPill,
                  isFollowing && styles.actionPillActive,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={[styles.actionPillText, isFollowing && styles.actionPillTextActive]}>
                  {isFollowing ? t('following', 'Following') : t('follow', 'Follow')}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.buttonPressed]}
              >
                <Text style={styles.actionPillText}>{t('message', 'Message')}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.buttonPressed]}
              >
                <Text style={styles.actionPillText}>{t('call', 'Call')}</Text>
              </Pressable>
            </View>

            {/* Tabs Filter Bar Header (Top, Recent, Short) */}
            <View style={styles.tabsHeaderContainer}>
              <View style={styles.tabsRow}>
                <Pressable
                  onPress={() => setActiveTab('top')}
                  style={styles.tabItem}
                >
                  <Text style={[styles.tabText, activeTab === 'top' && styles.tabTextActive]}>
                    {t('top', 'Top')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab('recent')}
                  style={styles.tabItem}
                >
                  <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>
                    {t('recent', 'Recent')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setActiveTab('short')}
                  style={styles.tabItem}
                >
                  <Text style={[styles.tabText, activeTab === 'short' && styles.tabTextActive]}>
                    {t('short', 'Short')}
                  </Text>
                </Pressable>
              </View>

              {/* Underline Indicator Line with Accent Bar */}
              <View style={styles.tabTrackLine}>
                <View
                  style={[
                    styles.tabActiveBar,
                    activeTab === 'top' && { left: '0%' },
                    activeTab === 'recent' && { left: '33.33%' },
                    activeTab === 'short' && { left: '66.66%' },
                  ]}
                />
              </View>
            </View>

            {/* Staggered Masonry Grid Container */}
            <View style={styles.masonryGrid}>

              {/* Column 1 */}
              <View style={styles.masonryColumn}>
                {/* Card 1: Video Card with Wave Beach & Play Button */}
                <View style={[styles.mediaCard, { height: 210 }]}>
                  <Image
                    source={require('@assets/images/onboarding3.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                  <View style={styles.playButtonOverlay}>
                    <Ionicons name="play" size={16} color="#111827" style={{ marginLeft: 2 }} />
                  </View>
                </View>

                {/* Card 2: Night Cityscape */}
                <View style={[styles.mediaCard, { height: 130 }]}>
                  <Image
                    source={require('@assets/images/onboarding1.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Card 3: Girl in White */}
                <View style={[styles.mediaCard, { height: 95 }]}>
                  <Image
                    source={require('@assets/images/onboarding2.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* Column 2 */}
              <View style={styles.masonryColumn}>
                {/* Card 1: Blue Jacket Girl */}
                <View style={[styles.mediaCard, { height: 125 }]}>
                  <Image
                    source={require('@assets/images/onboarding2.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Card 2: Sky White Top */}
                <View style={[styles.mediaCard, { height: 110 }]}>
                  <Image
                    source={require('@assets/images/onboarding3.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Card 3: Yellow Glasses */}
                <View style={[styles.mediaCard, { height: 130 }]}>
                  <Image
                    source={require('@assets/images/onboarding1.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Card 4: Shadow Face */}
                <View style={[styles.mediaCard, { height: 95 }]}>
                  <Image
                    source={require('@assets/images/onboarding2.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>
              </View>

              {/* Column 3 */}
              <View style={styles.masonryColumn}>
                {/* Card 1: Green Sweater Smile */}
                <View style={[styles.mediaCard, { height: 115 }]}>
                  <Image
                    source={require('@assets/images/onboarding1.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Card 2: Laundry Room */}
                <View style={[styles.mediaCard, { height: 120 }]}>
                  <Image
                    source={require('@assets/images/onboarding2.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                </View>

                {/* Card 3: Outdoor Girl with Play Button */}
                <View style={[styles.mediaCard, { height: 190 }]}>
                  <Image
                    source={require('@assets/images/onboarding3.jpg')}
                    style={styles.mediaImage}
                    resizeMode="cover"
                  />
                  <View style={styles.playButtonOverlay}>
                    <Ionicons name="play" size={16} color="#111827" style={{ marginLeft: 2 }} />
                  </View>
                </View>
              </View>

            </View>

          </ScrollView>

          {/* Integrated Bottom Navigation Tab Bar */}
          <BottomTabBar
            activeTab=""
            onTabPress={(tabKey) => {
              router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
            }}
          />

        </View>
      </ImageBackground>

      {/* Settings & Profile Options Sidebar Bottom Sheet Modal */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Frosted Glass Blur Backdrop */}
          <BlurView
            intensity={25}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Full Touch Backdrop to Close */}
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowSettingsModal(false)}
          />

          {/* Dedicated Top Area Above Sheet - Clicking anywhere on the top profile closes sidebar */}
          <Pressable
            style={{ flex: 1, width: '100%' }}
            onPress={() => setShowSettingsModal(false)}
            accessibilityLabel="Close sidebar"
          />

          {/* Sidebar Sheet Container */}
          <View
            style={[styles.sidebarSheetContent, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}
          >
            {/* Top Grab Handle Indicator Bar Area - Touch or Swipe down to lower/close sidebar */}
            <View
              {...handlePanResponder.panHandlers}
              style={styles.grabHandleArea}
              accessibilityLabel="Swipe down or tap to close settings sidebar"
            >
              <View style={styles.sidebarGrabHandle} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              bounces={true}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => {
                scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
              }}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y < -25 || (scrollOffsetRef.current <= 0 && e.nativeEvent.velocity && e.nativeEvent.velocity.y < -0.3)) {
                  setShowSettingsModal(false);
                }
              }}
              style={{ maxHeight: Dimensions.get('window').height * 0.74 }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >

              {/* Group 1: Profile */}
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="time-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('profile', 'Profile')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/edit-profile');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('editProfile', 'Edit Profile')}</Text>
              </Pressable>

              {/* Group 2: Quick Links */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="globe-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('quickLinks', 'Quick Links')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/my-points');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('wallet', 'Wallet')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/transactions?from=sidebar');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('transactions', 'Transactions')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/violations');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('warnings', 'Warnings')}</Text>
              </Pressable>

              {/* Group 3: Help & Support */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="people-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('helpAndSupport', 'Help & Support')}</Text>
              </View>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/help-support');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('helpAndSupport', 'Help & Support')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/feedback');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('feedback', 'Feedback')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/faqs');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('faqs', 'FAQs')}</Text>
              </Pressable>

              {/* Group 4: Others */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="star-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('others', 'Others')}</Text>
              </View>
              {[
                { key: 'blockedChats', label: 'Blocked Chats', route: '/blocked-chats' },
                { key: 'privacyPolicy', label: 'Privacy Policy', route: '/privacy-policy' },
                { key: 'termsOfUse', label: 'Terms of Use', route: '/terms-of-use' },
                { key: 'communityGuidelines', label: 'Community Guidelines', route: '/community-standards' },
                { key: 'permissionGrantKey', label: 'Permission Grant Key', route: '/permission-grant' },
                { key: 'aboutUs', label: 'About Us', route: '/about-us' },
              ].map((item, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    setShowSettingsModal(false);
                    if (item.route) {
                      router.push(item.route);
                    }
                  }}
                  style={styles.settingItemRow}
                >
                  <View style={styles.bulletDot} />
                  <Text style={styles.settingItemText}>{t(item.key, item.label)}</Text>
                </Pressable>
              ))}

              {/* Group 5: Settings */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
                <Ionicons name="settings-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('settings', 'Settings')}</Text>
              </View>

              {/* Notification Settings Option */}
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.push('/notification-settings');
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('notificationSettings', 'Notification Settings')}</Text>
              </Pressable>

              {/* Delete Account Option -> Opens 3-Step Delete Modal */}
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  setTimeout(() => {
                    setDeleteStep(1);
                    setShowDeleteModal(true);
                  }, 150);
                }}
                style={styles.settingItemRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.settingItemText}>{t('deleteAccount', 'Delete Account')}</Text>
              </Pressable>

              {/* Group 6: App Language — Segmented Pill Control */}
              <View style={[styles.sectionHeaderRow, { marginTop: 18, marginBottom: 10 }]}>
                <Text style={styles.langSectionIcon}>文A</Text>
                <Text style={[styles.sectionHeaderTitle, { marginLeft: 6 }]}>{t('appLanguage', 'App Language')}</Text>
              </View>

              {/* Segmented pill — EN / हिंदी */}
              <View style={styles.langSegmentTrack}>
                {/* English pill */}
                <Pressable
                  onPress={() => setLanguage('en')}
                  style={[styles.langSegmentBtn, !isHindi && styles.langSegmentBtnActive]}
                >
                  <Text style={[styles.langSegmentCode, !isHindi && styles.langSegmentCodeActive]}>EN</Text>
                  <Text style={[styles.langSegmentName, !isHindi && styles.langSegmentNameActive]}>English</Text>
                </Pressable>

                {/* Hindi pill */}
                <Pressable
                  onPress={() => setLanguage('hi')}
                  style={[styles.langSegmentBtn, isHindi && styles.langSegmentBtnActive]}
                >
                  <Text style={[styles.langSegmentCode, isHindi && styles.langSegmentCodeActive]}>हि</Text>
                  <Text style={[styles.langSegmentName, isHindi && styles.langSegmentNameActive]}>हिंदी</Text>
                </Pressable>
              </View>

              {/* Group 7: Mode */}
              <View style={[styles.settingSwitchRow, { marginTop: 18 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="options-outline" size={20} color="#111827" style={{ marginRight: 10 }} />
                  <Text style={styles.sectionHeaderTitle}>{t('mode', 'Mode')}</Text>
                </View>
                <Switch
                  value={isDarkMode}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#E5E7EB', true: '#F44649' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Group 8: Log out */}
              <Pressable
                onPress={() => {
                  setShowSettingsModal(false);
                  router.replace('/sign-in');
                }}
                style={[styles.sectionHeaderRow, { marginTop: 24, marginBottom: 16 }]}
              >
                <Ionicons name="log-out-outline" size={22} color="#111827" style={{ marginRight: 10 }} />
                <Text style={styles.sectionHeaderTitle}>{t('logout', 'Log out')}</Text>
              </Pressable>

            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3-Step Delete Account Card Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable style={styles.modalOverlayCenter} onPress={() => setShowDeleteModal(false)}>
          <BlurView
            intensity={30}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <Pressable style={styles.deleteCardBox} onPress={(e) => e.stopPropagation()}>

            {/* Top Close 'X' Button */}
            <Pressable
              onPress={() => setShowDeleteModal(false)}
              style={styles.closeXButton}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color="#111827" />
            </Pressable>

            {/* Step 1: Warning Confirmation Card */}
            {deleteStep === 1 && (
              <View style={styles.deleteStepContent}>
                <Text style={styles.deleteWarningText}>
                  {t('deleteAccountWarning', 'Are you sure you want to delete your account? This action is permanent and cannot be undone. Your profile, chats, matches, wallet history, and other account data will be permanently removed.')}
                </Text>

                <View style={styles.deleteButtonRow}>
                  <Pressable
                    onPress={() => setShowDeleteModal(false)}
                    style={[styles.deleteActionButton, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('cancel', 'Cancel')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDeleteStep(2)}
                    style={[styles.deleteActionButton, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('confirm', 'Confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Step 2: Reason Selection Options Card */}
            {deleteStep === 2 && (
              <View style={styles.deleteStepContent}>
                <Text style={styles.deleteReasonHeader}>{t('reasonForDeleting', 'Reason for deleting (Optional)')}</Text>

                <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                  {[
                    { key: 'foundSomeone', label: 'I found someone ♥' },
                    { key: 'privacyConcerns', label: 'Privacy concerns' },
                    { key: 'tooManyNotifications', label: 'Too many notifications' },
                    { key: 'notUsingApp', label: 'Not using the app anymore' },
                    { key: 'createdAnotherAccount', label: 'Created another account' },
                    { key: 'poorExperience', label: 'Poor experience' },
                    { key: 'other', label: 'Other' },
                  ].map((reasonItem, idx) => {
                    const isSelected = selectedReason === reasonItem.key;
                    return (
                      <Pressable
                        key={idx}
                        onPress={() => setSelectedReason(reasonItem.key)}
                        style={styles.reasonOptionRow}
                      >
                        <View style={styles.reasonBulletRow}>
                          <View style={styles.bulletDot} />
                          <Text style={styles.reasonOptionText}>{t(reasonItem.key, reasonItem.label)}</Text>
                        </View>

                        <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                          {isSelected && <View style={styles.radioInnerDot} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  onPress={() => setDeleteStep(3)}
                  style={styles.nextLinkButton}
                  hitSlop={12}
                >
                  <Text style={styles.nextLinkText}>{t('next', 'Next')} →</Text>
                </Pressable>
              </View>
            )}

            {/* Step 3: Final Permanent Profile Deletion Confirmation */}
            {deleteStep === 3 && (
              <View style={styles.deleteStepContent}>
                <Text style={styles.deleteFinalTitle}>{t('deleteAccountFinalTitle', 'Delete my profile permanently.')}</Text>

                <View style={[styles.deleteButtonRow, { marginTop: 28 }]}>
                  <Pressable
                    onPress={() => setShowDeleteModal(false)}
                    style={[styles.deleteActionButton, { backgroundColor: '#EF4444' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('cancel', 'Cancel')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setShowDeleteModal(false);
                      router.replace('/sign-in');
                    }}
                    style={[styles.deleteActionButton, { backgroundColor: '#10B981' }]}
                  >
                    <Text style={styles.deleteButtonText}>{t('confirm', 'Confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

          </Pressable>
        </Pressable>
      </Modal>
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
  },
  topHeaderRow: {
    width: '100%',
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 26,
    color: '#111827',
    flex: 1,
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  avatarRingOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    padding: 3,
    backgroundColor: '#FFFFFF',
    shadowColor: '#F44649',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  followersText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: '#111827',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  actionPill: {
    width: (SCREEN_WIDTH - 68) / 3,
    height: 46,
    borderRadius: 23,
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
  },
  actionPillActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  actionPillText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  actionPillTextActive: {
    color: '#FFFFFF',
  },
  tabsHeaderContainer: {
    width: '100%',
    marginBottom: 20,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  tabTextActive: {
    fontWeight: '800',
    color: '#111827',
  },
  tabTrackLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    borderRadius: 1,
  },
  tabActiveBar: {
    width: '33.33%',
    height: 3,
    backgroundColor: '#F44649',
    borderRadius: 2,
    position: 'absolute',
    top: -0.5,
  },
  masonryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  masonryColumn: {
    width: COLUMN_WIDTH,
  },
  mediaCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end',
  },
  sidebarSheetContent: {
    width: '100%',
    backgroundColor: '#FFF0F3',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 14,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  grabHandleArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 6,
  },
  sidebarGrabHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  settingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    paddingLeft: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#4B5563',
    marginRight: 12,
  },
  settingItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  /* ─── App Language Segmented Pill ─── */
  langSectionIcon: {
    fontSize: 18,
    color: '#111827',
  },
  langSegmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#F3E8ED',
    borderRadius: 14,
    padding: 4,
    marginVertical: 4,
  },
  langSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  langSegmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#E63956',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  langSegmentCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  langSegmentCodeActive: {
    color: '#E63956',
  },
  langSegmentName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  langSegmentNameActive: {
    color: '#374151',
    fontWeight: '700',
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  deleteCardBox: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    backgroundColor: '#FFF0F3',
    borderRadius: 24,
    padding: 24,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  closeXButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
  deleteStepContent: {
    width: '100%',
    paddingTop: 12,
  },
  deleteWarningText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 28,
  },
  deleteButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteActionButton: {
    width: '46%',
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteReasonHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  reasonOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  reasonBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reasonOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#10B981',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  nextLinkButton: {
    alignSelf: 'flex-end',
    marginTop: 20,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  nextLinkText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  deleteFinalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginVertical: 16,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
