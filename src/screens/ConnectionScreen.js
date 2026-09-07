import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  Modal,
  Dimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import NewUserCard from '../components/common/NewUserCard';
import InterestChip from '../components/common/InterestChip';
import BottomTabBar from '../components/common/BottomTabBar';
import DiscoverFiltersModal, { DEFAULT_FILTERS } from '../components/common/DiscoverFiltersModal';
import { useLanguage } from '../localization/LanguageContext';
import { useTheme } from '../theme';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';

function getAvatarUrl(uri) {
  if (!uri || typeof uri !== 'string' || uri.trim() === '') {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
  }
  if (uri.startsWith('http') || uri.startsWith('file://')) return uri;
  return `${BASE_URL}${uri}`;
}

// Full list of interest categories with emojis
const ALL_INTERESTS = [
  { id: 'all', label: 'All', emoji: '🌟' },
  { id: '1', label: 'Music', emoji: '🎵' },
  { id: '2', label: 'Football', emoji: '⚽' },
  { id: '3', label: 'Nature', emoji: '🌿' },
  { id: '4', label: 'Photography', emoji: '📷' },
  { id: '5', label: 'Travel', emoji: '✈️' },
  { id: '6', label: 'Writing', emoji: '✍️' },
  { id: '7', label: 'Language', emoji: '🗣️' },
  { id: '8', label: 'Cooking', emoji: '🍳' },
  { id: '9', label: 'Gaming', emoji: '🎮' },
  { id: '10', label: 'Movies', emoji: '🎬' },
  { id: '11', label: 'Fitness', emoji: '🏋️' },
  { id: '12', label: 'Yoga', emoji: '🧘' },
  { id: '13', label: 'Art', emoji: '🎨' },
  { id: '14', label: 'Shopping', emoji: '🛍️' },
];

// Major Indian cities and regions (exclusively India)
const INDIAN_REGIONS = [
  { id: 'all_india', name: 'All India', state: 'Pan India', emoji: '🇮🇳' },
  { id: 'delhi', name: 'Delhi NCR', state: 'Delhi, Gurugram, Noida', emoji: '📍' },
  { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', emoji: '📍' },
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', emoji: '📍' },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', emoji: '📍' },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', emoji: '📍' },
  { id: 'pune', name: 'Pune', state: 'Maharashtra', emoji: '📍' },
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', emoji: '📍' },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', emoji: '📍' },
  { id: 'chandigarh', name: 'Chandigarh', state: 'Punjab & Haryana', emoji: '📍' },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', emoji: '📍' },
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', emoji: '📍' },
  { id: 'indore', name: 'Indore', state: 'Madhya Pradesh', emoji: '📍' },
  { id: 'goa', name: 'Goa', state: 'Goa', emoji: '📍' },
];

// Pre-defined distributed coordinate positions across the map canvas (up to 8 markers)
const MAP_POSITIONS = [
  { top: '34%', left: '38%' }, // 0: Center primary
  { top: '16%', left: '18%' }, // 1: Top left
  { top: '18%', right: '16%' }, // 2: Top right
  { bottom: '30%', left: '15%' }, // 3: Bottom left
  { bottom: '32%', right: '18%' }, // 4: Bottom right
  { top: '48%', left: '10%' }, // 5: Mid left
  { top: '46%', right: '10%' }, // 6: Mid right
  { bottom: '14%', left: '42%' }, // 7: Lower center
];

export default function ConnectionScreen({ isNestedInPager }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  // Core Data & Filter States
  const [allUsers, setAllUsers] = useState([]);
  const [selectedInterest, setSelectedInterest] = useState('All');
  const [isViewAllInterests, setIsViewAllInterests] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('India');
  const [isCountryModalVisible, setIsCountryModalVisible] = useState(false);
  const [searchRegionText, setSearchRegionText] = useState('');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [selectedMapUserId, setSelectedMapUserId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real profiles from MongoDB database
  const loadDiscoverUsers = async () => {
    try {
      setIsLoading(true);
      const queryParams = {};
      if (selectedInterest && selectedInterest !== 'All') {
        queryParams.interest = selectedInterest;
      }
      if (selectedRegion && selectedRegion !== 'India' && selectedRegion !== 'All India') {
        queryParams.city = selectedRegion;
      }
      if (appliedFilters.lookingFor && appliedFilters.lookingFor !== 'Everyone') {
        queryParams.gender =
          appliedFilters.lookingFor === 'Men'
            ? 'Male'
            : appliedFilters.lookingFor === 'Women'
            ? 'Female'
            : undefined;
      }
      if (appliedFilters.sortBy) {
        queryParams.sortBy = appliedFilters.sortBy;
      }

      const res = await api.get('/profiles/all', { params: queryParams });
      const rawProfiles = Array.isArray(res.data) ? res.data : (res.data?.data || []);

      const mapped = rawProfiles.map((p, idx) => {
        const rawId = p.userId || p._id || p.user?._id || p.id;
        const calculatedAge = p.age || (p.dateOfBirth
          ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : 22);

        return {
          id: rawId ? String(rawId) : String(idx),
          name: p.displayName || 'Rubaru User',
          age: calculatedAge,
          gender: p.gender || 'Other',
          city: p.locationName || 'Nearby, India',
          locationName: p.locationName || 'India',
          distance: p.distance ? `${p.distance} km away` : `${(idx * 1.5 + 1.2).toFixed(1)} km away`,
          imageUri: getAvatarUrl(p.avatarUri || (p.photos && p.photos[0])),
          interests: Array.isArray(p.interests) ? p.interests : [],
          isNew: Boolean(p.createdAt && (Date.now() - new Date(p.createdAt).getTime()) < 30 * 24 * 60 * 60 * 1000),
          isOnline: p.isOnline !== undefined ? Boolean(p.isOnline) : true,
          followersCount: p.followersCount || 0,
          likesCount: p.likesCount || 0,
          createdAt: p.createdAt || new Date().toISOString(),
          bio: p.bio || '',
        };
      });

      setAllUsers(mapped);
    } catch (e) {
      console.log('[DISCOVER USERS FETCH ERROR]', e.message);
      setAllUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadDiscoverUsers();
    }, [selectedInterest, selectedRegion, appliedFilters.lookingFor, appliedFilters.sortBy])
  );

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  // Dynamic Filtering Logic
  const filteredUsers = useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];

    return allUsers
      .filter((u) => {
        // 1. Filter by Selected Indian Region
        if (selectedRegion && selectedRegion !== 'India' && selectedRegion !== 'All India') {
          const regClean = selectedRegion.replace('NCR', '').trim().toLowerCase();
          const cityLower = (u.city || '').toLowerCase();
          const locLower = (u.locationName || '').toLowerCase();
          const matchesRegion = cityLower.includes(regClean) || locLower.includes(regClean);
          if (!matchesRegion) return false;
        }

        // 2. Filter by Selected Interest Chip
        if (selectedInterest && selectedInterest !== 'All') {
          const userInterests = Array.isArray(u.interests) ? u.interests : [];
          const matchesInterest = userInterests.some(
            (int) => String(int).toLowerCase() === selectedInterest.toLowerCase()
          );
          if (userInterests.length > 0 && !matchesInterest) {
            return false;
          }
        }

        // 3. Filter by Gender / Looking For
        if (appliedFilters.lookingFor === 'Men') {
          if (u.gender && u.gender.toLowerCase() !== 'male') return false;
        } else if (appliedFilters.lookingFor === 'Women') {
          if (u.gender && u.gender.toLowerCase() !== 'female') return false;
        }

        // 4. Filter by Age Range
        if (u.age) {
          if (u.age < appliedFilters.minAge || u.age > appliedFilters.maxAge) {
            return false;
          }
        }

        // 5. Filter by Selected City in Modal
        if (appliedFilters.selectedCity && appliedFilters.selectedCity.trim()) {
          const qCity = appliedFilters.selectedCity.trim().toLowerCase();
          const cityLower = (u.city || '').toLowerCase();
          const locLower = (u.locationName || '').toLowerCase();
          if (!cityLower.includes(qCity) && !locLower.includes(qCity)) {
            return false;
          }
        }

        // 6. Filter by Online Status
        if (appliedFilters.onlineStatus === 'online_now' && !u.isOnline) {
          return false;
        }

        // 7. Filter by Modal Interests (multi-select)
        if (appliedFilters.interests && appliedFilters.interests.length > 0) {
          const userInterests = Array.isArray(u.interests) ? u.interests : [];
          const matchesAnyInterest = appliedFilters.interests.some((wanted) =>
            userInterests.some((ui) => String(ui).toLowerCase() === String(wanted).toLowerCase())
          );
          if (userInterests.length > 0 && !matchesAnyInterest) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Dynamic Sorting
        if (appliedFilters.sortBy === 'newest') {
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        }
        if (appliedFilters.sortBy === 'most_popular') {
          return (b.likesCount || 0) - (a.likesCount || 0);
        }
        if (appliedFilters.sortBy === 'nearby') {
          const distA = parseFloat(a.distance) || 0;
          const distB = parseFloat(b.distance) || 0;
          return distA - distB;
        }
        return 0; // 'recommended'
      });
  }, [allUsers, selectedInterest, selectedRegion, appliedFilters]);

  // Selected map user: pick active user or fallback to first filtered user
  const selectedMapUser = useMemo(() => {
    if (filteredUsers.length === 0) return null;
    const found = filteredUsers.find((u) => u.id === selectedMapUserId);
    return found || filteredUsers[0];
  }, [filteredUsers, selectedMapUserId]);

  const isFilterActive =
    appliedFilters.lookingFor !== 'Everyone' ||
    appliedFilters.distance !== '25 km' ||
    appliedFilters.minAge !== 18 ||
    appliedFilters.maxAge !== 35 ||
    appliedFilters.profileType !== 'all' ||
    appliedFilters.onlineStatus !== 'any_status' ||
    appliedFilters.sortBy !== 'recommended' ||
    Boolean(appliedFilters.selectedCity) ||
    selectedInterest !== 'All' ||
    (selectedRegion !== 'India' && selectedRegion !== 'All India');

  const handleResetFilters = () => {
    setAppliedFilters(DEFAULT_FILTERS);
    setSelectedInterest('All');
    setSelectedRegion('India');
    showToast('🔄 Filters reset to India');
  };

  const visibleInterestsList = isViewAllInterests ? ALL_INTERESTS : ALL_INTERESTS.slice(0, 7);

  const filteredIndianRegions = useMemo(() => {
    if (!searchRegionText.trim()) return INDIAN_REGIONS;
    const q = searchRegionText.toLowerCase();
    return INDIAN_REGIONS.filter(
      (r) => r.name.toLowerCase().includes(q) || r.state.toLowerCase().includes(q)
    );
  }, [searchRegionText]);

  const handleSelectRegion = (region) => {
    setSelectedRegion(region.name === 'All India' ? 'India' : region.name);
    setIsCountryModalVisible(false);
    setSearchRegionText('');
    showToast(`📍 Showing people in ${region.name}`);
  };

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF0F3" />

      {/* Soft Warm Pink Gradient Background */}
      <LinearGradient colors={['#FFF0F3', '#FFE3E8', '#FFD8E1']} style={styles.gradientBackground}>
        {/* Floating background watermark hearts */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Ionicons
            name="heart"
            size={52}
            color="#F492A5"
            style={[styles.heart, { top: 20, left: -12, transform: [{ rotate: '-20deg' }], opacity: 0.35 }]}
          />
          <Ionicons
            name="heart"
            size={42}
            color="#F492A5"
            style={[styles.heart, { top: 35, left: 162, transform: [{ rotate: '-15deg' }], opacity: 0.5 }]}
          />
          <Ionicons
            name="heart"
            size={34}
            color="#F492A5"
            style={[styles.heart, { top: 80, left: 210, transform: [{ rotate: '18deg' }], opacity: 0.55 }]}
          />
        </View>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <View style={styles.floatingToast}>
            <Text style={styles.floatingToastText}>{toastMessage}</Text>
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* Header Row */}
          <View style={[styles.discoverHeaderRow, { paddingTop: Math.max(insets.top + 6, 16) }]}>
            <View>
              <Text style={styles.discoverTitle}>{t('discover', 'Discover')}</Text>
              <Text style={styles.discoverSubtitle}>Connect with people across India 🇮🇳</Text>
            </View>

            <View style={styles.headerButtonsRow}>
              <TouchableOpacity
                style={styles.circleIconButton}
                activeOpacity={0.8}
                onPress={() => router.push('/search-users')}
                accessibilityLabel="Search users"
              >
                <Ionicons name="search" size={20} color="#111827" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.circleIconButton,
                  isFilterActive && (isDarkMode ? styles.circleIconButtonActiveDark : styles.circleIconButtonActive),
                ]}
                activeOpacity={0.8}
                onPress={() => setIsFilterModalVisible(true)}
                accessibilityLabel="Open filters"
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={isFilterActive ? (isDarkMode ? '#000000' : '#FF2E63') : '#111827'}
                />
                {isFilterActive && (
                  <View
                    style={[
                      styles.filterActiveDot,
                      isDarkMode && { backgroundColor: '#000000' },
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Filter Tags Bar */}
          {isFilterActive && (
            <View style={styles.activeFiltersBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                {selectedRegion !== 'India' && (
                  <View style={styles.activeFilterTag}>
                    <Text style={styles.activeFilterTagText}>📍 {selectedRegion}</Text>
                  </View>
                )}
                {selectedInterest !== 'All' && (
                  <View style={styles.activeFilterTag}>
                    <Text style={styles.activeFilterTagText}>🏷️ {selectedInterest}</Text>
                  </View>
                )}
                {appliedFilters.lookingFor !== 'Everyone' && (
                  <View style={styles.activeFilterTag}>
                    <Text style={styles.activeFilterTagText}>👥 {appliedFilters.lookingFor}</Text>
                  </View>
                )}
                {(appliedFilters.minAge !== 18 || appliedFilters.maxAge !== 35) && (
                  <View style={styles.activeFilterTag}>
                    <Text style={styles.activeFilterTagText}>🎂 {appliedFilters.minAge}-{appliedFilters.maxAge} yrs</Text>
                  </View>
                )}
                {appliedFilters.onlineStatus === 'online_now' && (
                  <View style={styles.activeFilterTag}>
                    <Text style={styles.activeFilterTagText}>🟢 Online Now</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.clearFiltersBtn}
                  activeOpacity={0.8}
                  onPress={handleResetFilters}
                >
                  <Ionicons name="close-circle" size={14} color="#FF2E63" style={{ marginRight: 4 }} />
                  <Text style={styles.clearFiltersText}>Reset All</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {/* "NEW" Users Carousel */}
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>
              {t('newUsers', 'New Connections')}{' '}
              <Text style={styles.countBadge}>({filteredUsers.length})</Text>
            </Text>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <NewUserCard
                item={item}
                onPress={() =>
                  router.push({
                    pathname: '/user-profile',
                    params: { userId: item.id },
                  })
                }
              />
            )}
            contentContainerStyle={styles.carouselContentContainer}
            style={styles.carouselContainer}
            ListEmptyComponent={
              <View style={styles.emptyCarouselBox}>
                <Ionicons name="people-outline" size={32} color="#9CA3AF" style={{ marginBottom: 6 }} />
                <Text style={styles.emptyCarouselTitle}>No people found matching filters</Text>
                <TouchableOpacity style={styles.emptyResetBtn} onPress={handleResetFilters}>
                  <Text style={styles.emptyResetBtnText}>Reset Filters</Text>
                </TouchableOpacity>
              </View>
            }
          />

          {/* "Interest" Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('interest', 'Interests')}</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setIsViewAllInterests(!isViewAllInterests)}
            >
              <Text style={[styles.viewAllText, isDarkMode && { color: '#000000' }]}>
                {isViewAllInterests ? 'Show Less' : t('viewAll', 'View all (14)')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.interestsChipsWrapper}>
            {visibleInterestsList.map((item) => (
              <InterestChip
                key={item.id}
                label={item.label}
                emoji={item.emoji}
                isSelected={selectedInterest === item.label}
                onPress={() => {
                  setSelectedInterest(item.label);
                  showToast(item.label === 'All' ? '🌟 Showing all interests' : `Filter: ${item.emoji} ${item.label}`);
                }}
              />
            ))}
          </View>

          {/* "Around Me" Section & Interactive Map Canvas */}
          <View style={styles.aroundMeSection}>
            <View style={styles.aroundMeHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.sectionTitle}>{t('aroundMe', 'Around me')}</Text>
                <Text style={styles.aroundMeSubtext} numberOfLines={2}>
                  {selectedInterest === 'All'
                    ? `Connections near ${selectedRegion} (${filteredUsers.length} people)`
                    : `People with "${selectedInterest}" in ${selectedRegion} (${filteredUsers.length} found)`}
                </Text>
              </View>

              {/* Country & Region Dropdown (Showing ONLY India) */}
              <TouchableOpacity
                style={[styles.mapLocationRow, isDarkMode && styles.mapLocationRowDark]}
                activeOpacity={0.8}
                onPress={() => setIsCountryModalVisible(true)}
              >
                <Text style={{ fontSize: 13, marginRight: 4 }}>🇮🇳</Text>
                <Text style={[styles.mapLocationText, isDarkMode && { color: '#000000' }]} numberOfLines={1}>
                  {selectedRegion}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={isDarkMode ? '#000000' : '#E63956'}
                  style={styles.mapChevronIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Interactive Dynamic Map Canvas */}
            <View style={styles.mapContainer}>
              <View style={styles.mapBackground}>
                {/* Dynamic Street Grid Lines */}
                <View style={[styles.streetLine, { top: '28%', left: '-10%', width: '120%', transform: [{ rotate: '-22deg' }] }]} />
                <View style={[styles.streetLine, { top: '56%', left: '-10%', width: '120%', transform: [{ rotate: '18deg' }] }]} />
                <View style={[styles.streetLine, { top: '78%', left: '-10%', width: '120%', transform: [{ rotate: '-12deg' }] }]} />

                {/* Radar Concentric Waves centered on active location */}
                <View style={styles.radarRingOuter} />
                <View style={styles.radarRingInner} />

                {/* Local Indian POI Badges */}
                <View style={[styles.poiBadge, { top: 22, left: 16 }]}>
                  <Ionicons name="cafe" size={12} color="#D97706" style={styles.poiIcon} />
                  <View>
                    <Text style={styles.poiTitle}>Cafe Coffee Day</Text>
                    <Text style={styles.poiSub}>Open • Popular spot</Text>
                  </View>
                </View>

                <View style={[styles.poiBadge, { bottom: 20, right: 16 }]}>
                  <Ionicons name="leaf" size={12} color="#059669" style={styles.poiIcon} />
                  <View>
                    <Text style={styles.poiTitle}>Central Park & Lake</Text>
                    <Text style={styles.poiSub}>Walk & Connect</Text>
                  </View>
                </View>

                {/* Dynamic Map Markers for Filtered Users */}
                {filteredUsers.length > 0 ? (
                  filteredUsers.slice(0, 8).map((user, index) => {
                    const pos = MAP_POSITIONS[index] || MAP_POSITIONS[0];
                    const isSelected = selectedMapUser && selectedMapUser.id === user.id;

                    return (
                      <View key={user.id} style={[styles.markerAbsoluteWrapper, pos]}>
                        {/* Tooltip Bubble for Selected User */}
                        {isSelected && (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            style={styles.tooltipBubbleWrapper}
                            onPress={() =>
                              router.push({
                                pathname: '/user-profile',
                                params: { userId: user.id },
                              })
                            }
                          >
                            <View style={styles.tooltipBubble}>
                              <Ionicons name="pulse" size={13} color="#FF2E63" style={{ marginRight: 5 }} />
                              <Text style={styles.tooltipText}>
                                Connect with <Text style={styles.tooltipBold}>{user.name.split(' ')[0]} 👋</Text>
                              </Text>
                            </View>
                            <View style={styles.tooltipDot} />
                          </TouchableOpacity>
                        )}

                        {/* Avatar Marker */}
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => setSelectedMapUserId(user.id)}
                          style={[
                            styles.mapAvatarMarker,
                            isSelected && styles.mapAvatarMarkerSelected,
                          ]}
                        >
                          <Image source={{ uri: user.imageUri }} style={styles.mapAvatarImg} />
                          {user.isOnline && <View style={styles.mapOnlineBadge} />}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                ) : (
                  /* Empty Map Radar State */
                  <View style={styles.emptyMapCenterBox}>
                    <Ionicons name="compass-outline" size={36} color="#FF2E63" />
                    <Text style={styles.emptyMapTitle}>No people found in {selectedRegion}</Text>
                    <Text style={styles.emptyMapSub}>Try widening your filters or selecting All India</Text>
                    <TouchableOpacity style={styles.emptyMapResetBtn} onPress={handleResetFilters}>
                      <Text style={styles.emptyMapResetBtnText}>Show All in India</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Selected User Floating Quick-Action Card right below map */}
              {selectedMapUser && (
                <View style={styles.selectedUserFloatingCard}>
                  <Image source={{ uri: selectedMapUser.imageUri }} style={styles.quickCardAvatar} />
                  <View style={{ flex: 1, paddingHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.quickCardName} numberOfLines={1}>
                        {selectedMapUser.name}, {selectedMapUser.age}
                      </Text>
                      {selectedMapUser.isOnline && (
                        <View style={styles.quickCardOnlineDot} />
                      )}
                    </View>
                    <Text style={styles.quickCardLoc} numberOfLines={1}>
                      📍 {selectedMapUser.city} • {selectedMapUser.distance}
                    </Text>
                    {selectedMapUser.interests?.[0] && (
                      <View style={styles.quickCardInterestPill}>
                        <Text style={styles.quickCardInterestText}>✨ {selectedMapUser.interests[0]}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.quickCardActions}>
                    <TouchableOpacity
                      style={styles.quickCardBtnPrimary}
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push({
                          pathname: '/user-profile',
                          params: { userId: selectedMapUser.id },
                        })
                      }
                    >
                      <Text style={styles.quickCardBtnPrimaryText}>Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickCardBtnChat}
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push({
                          pathname: `/chat/${selectedMapUser.id}`,
                          params: {
                            recipientId: selectedMapUser.id,
                            name: selectedMapUser.name,
                            avatarUrl: selectedMapUser.imageUri,
                          },
                        })
                      }
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      {/* Country & Indian Region Modal (Showing ONLY India) */}
      <Modal
        visible={isCountryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCountryModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsCountryModalVisible(false)}
        >
          <Pressable style={styles.countryModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalDragHandle} />

            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeaderTitle}>Select Region</Text>
                <Text style={styles.modalHeaderSub}>Rubaru Service Area (India Only 🇮🇳)</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsCountryModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Exclusive Country Banner */}
            <View style={styles.countryExclusiveBanner}>
              <Text style={{ fontSize: 28, marginRight: 12 }}>🇮🇳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.countryExclusiveTitle}>India (Only)</Text>
                <Text style={styles.countryExclusiveSub}>
                  Rubaru is exclusively launched across India. Choose a city or view pan-India.
                </Text>
              </View>
              <View style={styles.verifiedCountryBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
                <Text style={styles.verifiedCountryText}>Exclusive</Text>
              </View>
            </View>

            {/* Search Indian City Input */}
            <View style={styles.modalSearchRow}>
              <Ionicons name="search" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search Indian city or state..."
                placeholderTextColor="#9CA3AF"
                value={searchRegionText}
                onChangeText={setSearchRegionText}
                style={styles.modalSearchInput}
              />
              {searchRegionText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchRegionText('')}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Indian Cities / Regions List */}
            <FlatList
              data={filteredIndianRegions}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected =
                  selectedRegion === item.name ||
                  (item.name === 'All India' && selectedRegion === 'India');

                return (
                  <TouchableOpacity
                    style={[styles.regionItemRow, isSelected && styles.regionItemRowSelected]}
                    activeOpacity={0.7}
                    onPress={() => handleSelectRegion(item)}
                  >
                    <Text style={{ fontSize: 18, marginRight: 12 }}>{item.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.regionItemName, isSelected && styles.regionItemNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.regionItemState}>{item.state}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#FF2E63" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Discover Filters Modal */}
      <DiscoverFiltersModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        initialFilters={appliedFilters}
        onApplyFilters={(newFilters) => {
          setAppliedFilters(newFilters);
          showToast('✨ Discover filters applied!');
        }}
      />

      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Connection"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  gradientBackground: {
    flex: 1,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  heart: {
    position: 'absolute',
  },
  scrollBody: {
    paddingBottom: 90,
  },
  discoverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 10,
  },
  discoverTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
  },
  discoverSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#F2F2F7',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    position: 'relative',
  },
  circleIconButtonActive: {
    backgroundColor: '#FFF0F3',
    borderColor: '#FF2E63',
  },
  circleIconButtonActiveDark: {
    backgroundColor: '#F3F4F6',
    borderColor: '#000000',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF2E63',
  },
  activeFiltersBar: {
    marginBottom: 10,
  },
  activeFilterTag: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginRight: 8,
  },
  activeFilterTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  clearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48',
  },
  floatingToast: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    zIndex: 99,
    backgroundColor: 'rgba(17, 24, 39, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingToastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  carouselHeaderRow: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  carouselContainer: {
    marginBottom: 20,
  },
  carouselContentContainer: {
    paddingHorizontal: 20,
  },
  emptyCarouselBox: {
    width: SCREEN_WIDTH - 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyCarouselTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
    marginBottom: 10,
  },
  emptyResetBtn: {
    backgroundColor: '#FFE4E6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E11D48',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  countBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E11D48',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11D48',
  },
  interestsChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  aroundMeSection: {
    paddingHorizontal: 20,
  },
  aroundMeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aroundMeSubtext: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  mapLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBF0',
    borderWidth: 1,
    borderColor: '#E63956',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    shadowColor: '#E63956',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    maxWidth: 140,
  },
  mapLocationRowDark: {
    backgroundColor: '#F3F4F6',
    borderColor: '#000000',
  },
  mapLocationText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#E63956',
    marginRight: 4,
  },
  mapChevronIcon: {
    marginTop: 1,
  },
  mapContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#EFEFF4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  mapBackground: {
    height: 380,
    backgroundColor: '#F7F3EC',
    position: 'relative',
    overflow: 'hidden',
  },
  streetLine: {
    position: 'absolute',
    height: 18,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EADECE',
    opacity: 0.9,
  },
  radarRingOuter: {
    position: 'absolute',
    top: '20%',
    left: '20%',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: 'rgba(230, 57, 86, 0.15)',
  },
  radarRingInner: {
    position: 'absolute',
    top: '30%',
    left: '30%',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(230, 57, 86, 0.25)',
  },
  poiBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    zIndex: 2,
  },
  poiIcon: {
    marginRight: 5,
  },
  poiTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1F2937',
  },
  poiSub: {
    fontSize: 8,
    color: '#6B7280',
    fontWeight: '500',
  },
  markerAbsoluteWrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipBubbleWrapper: {
    alignItems: 'center',
    marginBottom: 4,
    zIndex: 20,
  },
  tooltipBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  tooltipText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  tooltipBold: {
    fontWeight: '800',
    color: '#FF8DA1',
  },
  tooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E1B2E',
    marginTop: -1,
  },
  mapAvatarMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    position: 'relative',
  },
  mapAvatarMarkerSelected: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3.5,
    borderColor: '#FF2E63',
    shadowColor: '#FF2E63',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  mapAvatarImg: {
    width: '100%',
    height: '100%',
  },
  mapOnlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  emptyMapCenterBox: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyMapTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyMapSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  emptyMapResetBtn: {
    backgroundColor: '#FF2E63',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  emptyMapResetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedUserFloatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  quickCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  quickCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  quickCardOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 6,
  },
  quickCardLoc: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  quickCardInterestPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  quickCardInterestText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E11D48',
  },
  quickCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickCardBtnPrimary: {
    backgroundColor: '#FF2E63',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 6,
  },
  quickCardBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  quickCardBtnChat: {
    backgroundColor: '#111827',
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  countryModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  modalDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  modalHeaderSub: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryExclusiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  countryExclusiveTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  countryExclusiveSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
  },
  verifiedCountryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedCountryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#166534',
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  regionItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  regionItemRowSelected: {
    backgroundColor: '#FFF1F2',
  },
  regionItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  regionItemNameSelected: {
    color: '#E11D48',
  },
  regionItemState: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
});
