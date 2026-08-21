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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import BottomTabBar from '../components/common/BottomTabBar';
import { useTheme } from '../theme';
import { useLanguage } from '../localization/LanguageContext';
import QuoteCard from '../components/common/QuoteCard';
import StatsBar from '../components/common/StatsBar';
import InfoPill from '../components/common/InfoPill';
import PhotoThumbnail from '../components/common/PhotoThumbnail';
import InterestPill from '../components/common/InterestPill';

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
              <Ionicons name="chevron-back" size={26} color="#111827" />
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
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
          >
            {/* Avatar Photo Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarRingOuter}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80' }}
                  defaultSource={require('@assets/images/onboarding2.jpg')}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>
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
                onPress={() => router.push('/chats')}
              >
                <Text style={styles.actionPillText}>{t('message', 'Message')}</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.actionPill, pressed && styles.buttonPressed]}
                onPress={() => router.push('/active-call')}
              >
                <Text style={styles.actionPillText}>{t('call', 'Call')}</Text>
              </Pressable>
            </View>

            {/* Tabs Filter Bar Header (Top & About Me options) */}
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
                  onPress={() => setActiveTab('about')}
                  style={styles.tabItem}
                >
                  <Text style={[styles.tabText, activeTab === 'about' && styles.tabTextActive]}>
                    {t('aboutMe', 'About Me')}
                  </Text>
                </Pressable>
              </View>

              {/* Dual Underline Indicators (Red for Active, Grey for Inactive) */}
              <View style={styles.tabTrackContainer}>
                <View style={styles.tabTrackHalf}>
                  <View
                    style={[
                      styles.tabIndicatorBar,
                      activeTab === 'top' ? styles.indicatorActive : styles.indicatorInactive,
                    ]}
                  />
                </View>
                <View style={styles.tabTrackHalf}>
                  <View
                    style={[
                      styles.tabIndicatorBar,
                      activeTab === 'about' ? styles.indicatorActive : styles.indicatorInactive,
                    ]}
                  />
                </View>
              </View>
            </View>

            {activeTab === 'top' ? (
              /* Staggered Masonry Media Grid */
              <View style={styles.masonryGrid}>
                {/* Column 1 */}
                <View style={styles.masonryColumn}>
                  {/* Card 1: Beach Waves Reel with Play Icon Overlay */}
                  <View style={[styles.mediaCard, { height: 215 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding3.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                    <View style={styles.playButtonOverlayCenter}>
                      <Ionicons name="play" size={15} color="#111827" style={{ marginLeft: 2 }} />
                    </View>
                  </View>

                  {/* Card 2: Girl in White Top at Night */}
                  <View style={[styles.mediaCard, { height: 135 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding1.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Card 3: Girl Portrait */}
                  <View style={[styles.mediaCard, { height: 100 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding2.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>
                </View>

                {/* Column 2 */}
                <View style={styles.masonryColumn}>
                  {/* Card 1: Blue Jacket Girl */}
                  <View style={[styles.mediaCard, { height: 130 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding2.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Card 2: Windmill Sky Girl */}
                  <View style={[styles.mediaCard, { height: 110 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding3.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Card 3: Yellow Sunglasses Girl */}
                  <View style={[styles.mediaCard, { height: 135 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding1.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Card 4: Shadow Portrait */}
                  <View style={[styles.mediaCard, { height: 95 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding2.jpg')}
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
                      source={{ uri: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding1.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Card 2: Laundromat Sitting */}
                  <View style={[styles.mediaCard, { height: 120 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding2.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Card 3: Tall Outdoor Reel with Play Overlay near Bottom */}
                  <View style={[styles.mediaCard, { height: 195 }]}>
                    <Image
                      source={{ uri: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80' }}
                      defaultSource={require('@assets/images/onboarding3.jpg')}
                      style={styles.mediaImage}
                      resizeMode="cover"
                    />
                    <View style={styles.playButtonOverlayBottom}>
                      <Ionicons name="play" size={15} color="#111827" style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              /* Inline About Me Content */
              <View style={styles.aboutMeInlineContainer}>
                {/* 2. Bio Quote Card */}
                <QuoteCard
                  quoteStart="Looking for meaningful connections and "
                  quoteEmphasis="great conversations."
                  width={SCREEN_WIDTH - 36}
                />

                {/* 3. Stats Bar */}
                <StatsBar
                  likes="2.5 K"
                  connections="128"
                  views="1.2 K"
                />

                {/* 4. About Section */}
                <View style={styles.aboutSectionContainer}>
                  <View style={styles.aboutTitleRow}>
                    <Text style={styles.aboutSerifTitle}>{t('about', 'About')}</Text>
                    <View style={styles.dashedAccentRow}>
                      <View style={styles.dashLine} />
                      <View style={styles.dashDot} />
                    </View>
                  </View>
                  <View style={styles.detailsGrid}>
                    <InfoPill icon="gift-outline" label="19" />
                    <InfoPill icon="phone-portrait-outline" label={"5' 6\""} />
                    <InfoPill icon="location-outline" label="Rambagh" />
                    <InfoPill icon="home-outline" label="Jaipur" />
                    <InfoPill icon="briefcase-outline" label="Model" />
                    <InfoPill icon="school-outline" label="UPES" />
                    <InfoPill icon="book-outline" label="Hindu" />
                  </View>
                </View>

                {/* 5. Captured Moments Section */}
                <View style={styles.aboutSectionContainer}>
                  <View style={styles.momentsHeaderRow}>
                    <Text style={styles.aboutSerifTitle}>{t('capturedMoments', 'Captured Moments')}</Text>
                    <Pressable onPress={() => {}} style={styles.viewAllBtn}>
                      <Text style={styles.viewAllText}>{t('viewAll', 'View All')}</Text>
                      <Ionicons name="chevron-forward" size={14} color="#F04452" style={{ marginLeft: 2 }} />
                    </Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.momentsScrollContent}>
                    <PhotoThumbnail uri="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80" fallback={require('../assets/images/profile-hero.jpg')} onPress={() => {}} />
                    <PhotoThumbnail uri="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80" fallback={require('../assets/images/profile-hero.jpg')} onPress={() => {}} />
                    <PhotoThumbnail uri="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80" fallback={require('../assets/images/profile-hero.jpg')} onPress={() => {}} />
                    <PhotoThumbnail uri="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80" fallback={require('../assets/images/profile-hero.jpg')} onPress={() => {}} />
                    <PhotoThumbnail uri="https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=400&q=80" fallback={require('../assets/images/profile-hero.jpg')} onPress={() => {}} />
                  </ScrollView>
                </View>

                {/* 6. Things I Love Section */}
                <View style={styles.aboutSectionContainer}>
                  <Text style={[styles.aboutSerifTitle, { marginBottom: 14 }]}>{t('thingsILove', 'Things I Love')}</Text>
                  <View style={styles.interestsWrappedGrid}>
                    <InterestPill icon="airplane-outline" label="Travel" />
                    <InterestPill icon="musical-notes-outline" label="Music" />
                    <InterestPill icon="reader-outline" label="Reading" />
                    <InterestPill icon="cafe-outline" label="Coffee" />
                    <InterestPill icon="barbell-outline" label="Fitness" />
                    <InterestPill icon="color-palette-outline" label="Art" />
                  </View>
                </View>
              </View>
            )}

          </ScrollView>

          {/* Integrated Bottom Navigation Tab Bar */}
          <BottomTabBar
            activeTab="groups"
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
    fontWeight: '700',
    color: '#111827',
  },
  tabTextActive: {
    fontWeight: '800',
    color: '#111827',
  },
  tabTrackContainer: {
    width: '100%',
    flexDirection: 'row',
    height: 4,
  },
  tabTrackHalf: {
    flex: 1,
    paddingHorizontal: 8,
  },
  tabIndicatorBar: {
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: '#FF2D55',
  },
  indicatorInactive: {
    backgroundColor: '#E5E7EB',
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
  playButtonOverlayCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -17,
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  playButtonOverlayBottom: {
    position: 'absolute',
    bottom: 14,
    left: '50%',
    marginLeft: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleCenter: {
    textAlign: 'center',
    marginLeft: -26,
    fontSize: 20,
    fontWeight: '800',
  },
  menuButtonClean: {
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  /* About Me Section */
  aboutContainer: {
    width: '100%',
    gap: 16,
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.6)',
  },
  aboutCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  aboutBioText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    fontWeight: '500',
  },
  aboutDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  aboutDetailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    marginRight: 6,
  },
  aboutDetailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFE0E6',
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2D55',
  },
  aboutProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(235, 238, 242, 0.8)',
  },
  aboutProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 22,
  },
  aboutProfileInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  aboutProfileName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.3,
  },
  aboutProfileSub: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginTop: 2,
  },
  aboutDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  aboutDistanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF2D55',
    marginLeft: 3,
  },
  aboutQuoteText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 17,
    marginTop: 6,
    fontWeight: '400',
  },
  aboutBadgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  aboutBadgePill: {
    backgroundColor: '#FFEAEF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FF2D55',
  },
  /* Stats Card */
  aboutStatsCard: {
    backgroundColor: '#FFDCE2',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#FF2D55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  aboutStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutStatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFAEC0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutStatTextCol: {
    marginLeft: 8,
  },
  aboutStatNum: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  aboutStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4B5563',
    marginTop: 1,
  },
  /* Details List Card */
  aboutDetailsListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  aboutMetricsScrollView: {
    marginHorizontal: -4,
  },
  aboutMetricsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  aboutMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  aboutMetricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  aboutMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  aboutCardHorizontalLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  aboutListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  aboutListRowText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 16,
  },
  aboutRowLine: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  /* Photos Card */
  aboutPhotosCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  aboutSectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
  },
  aboutPhotosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aboutPhotoSlot: {
    width: (SCREEN_WIDTH - 48 - 36 - 32) / 5,
    height: (SCREEN_WIDTH - 48 - 36 - 32) / 5,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  aboutSlotImage: {
    width: '100%',
    height: '100%',
  },
  /* Interests Card */
  aboutInterestsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.8)',
  },
  aboutInterestsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutInterestItem: {
    alignItems: 'center',
  },
  aboutInterestIconSquare: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutInterestLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
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
  aboutMeInlineContainer: {
    paddingHorizontal: 4,
    marginTop: 18,
  },
  aboutSectionContainer: {
    marginBottom: 20,
  },
  aboutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aboutSerifTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  dashedAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    marginTop: 4,
  },
  dashLine: {
    width: 30,
    height: 1.5,
    backgroundColor: '#F4A9B5',
  },
  dashDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F04452',
    marginLeft: 3,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  momentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F04452',
  },
  momentsScrollContent: {
    paddingRight: 10,
  },
  interestsWrappedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
