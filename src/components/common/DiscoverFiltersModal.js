import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LOOKING_FOR_OPTIONS = ['Men', 'Women', 'Everyone'];
const DISTANCE_OPTIONS = ['Nearby', '5 km', '10 km', '25 km', '50 km', '100+ km'];

const AGE_MIN = 18;
const AGE_MAX = 60;
const AGE_SPAN = AGE_MAX - AGE_MIN; // 42

const INTEREST_OPTIONS = [
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'nature', label: 'Nature', emoji: '🌿' },
  { id: 'photography', label: 'Photography', emoji: '📷' },
  { id: 'writing', label: 'Writing', emoji: '✍️' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'food', label: 'Food', emoji: '🍕' },
  { id: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
];

const PROFILE_TYPE_OPTIONS = [
  { id: 'all', label: 'All Profiles', icon: 'people-outline' },
  { id: 'verified', label: 'Verified Profiles', icon: 'checkmark-circle', iconColor: '#3B82F6' },
  { id: 'new', label: 'New Users', icon: 'sparkles', iconColor: '#F59E0B' },
  { id: 'active_now', label: 'Active Now', icon: 'ellipse', iconColor: '#10B981' },
];

const RELATIONSHIP_OPTIONS = [
  'Relationship',
  'Friendship',
  'Casual Dating',
  'Long-term Relationship',
  'Just Exploring',
];

const ONLINE_STATUS_OPTIONS = [
  { id: 'online_now', label: 'Online Now', badgeColor: '#10B981' },
  { id: 'recently_active', label: 'Recently Active', badgeColor: '#F59E0B' },
  { id: 'any_status', label: 'Any Status', badgeColor: '#9CA3AF' },
];

const PROFILE_COMPLETENESS_OPTIONS = [
  { id: 'any', label: 'Any Profile' },
  { id: 'complete', label: 'Complete Profiles Only' },
];

const SORT_BY_OPTIONS = [
  { id: 'recommended', label: 'Recommended', icon: 'star-outline' },
  { id: 'nearby', label: 'Nearby', icon: 'location-outline' },
  { id: 'recently_active', label: 'Recently Active', icon: 'time-outline' },
  { id: 'newest', label: 'Newest', icon: 'sparkles-outline' },
  { id: 'most_popular', label: 'Most Popular', icon: 'flame-outline' },
];

export const DEFAULT_FILTERS = {
  lookingFor: 'Everyone',
  minAge: 22,
  maxAge: 30,
  distance: '25 km',
  locationType: 'Current Location',
  selectedCity: '',
  selectedState: '',
  interests: ['Music', 'Travel'],
  profileType: 'all',
  relationship: 'Relationship',
  onlineStatus: 'any_status',
  profileCompleteness: 'any',
  sortBy: 'recommended',
};

const THUMB_SIZE = 24;
const getEffective = (w) => Math.max(1, w - THUMB_SIZE);

/**
 * Ultra-Smooth Dual-Thumb Range Slider
 */
function AgeRangeSlider({ minAge, maxAge, onChange, onSlidingChange }) {
  const { isDarkMode } = useTheme();
  const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 84);
  const [activeThumb, setActiveThumb] = useState(null);

  const minRef = useRef(minAge);
  const maxRef = useRef(maxAge);
  const widthRef = useRef(trackWidth);
  const dragRef = useRef(null);
  const trackPageXRef = useRef(0);
  const trackViewRef = useRef(null);

  useEffect(() => { minRef.current = minAge; }, [minAge]);
  useEffect(() => { maxRef.current = maxAge; }, [maxAge]);
  useEffect(() => { widthRef.current = trackWidth; }, [trackWidth]);

  const posForAge = (age) => {
    const c = Math.max(AGE_MIN, Math.min(AGE_MAX, age));
    return ((c - AGE_MIN) / AGE_SPAN) * getEffective(trackWidth);
  };

  const ageForX = (trackX) => {
    const eff = getEffective(widthRef.current);
    const leftEdge = trackX - THUMB_SIZE / 2;
    const ratio = Math.max(0, Math.min(1, leftEdge / eff));
    return Math.round(AGE_MIN + ratio * AGE_SPAN);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        onSlidingChange && onSlidingChange(true);
        const pageX = evt.nativeEvent.pageX;
        const localX = pageX - trackPageXRef.current;

        const eff = getEffective(widthRef.current);
        const minCx = ((minRef.current - AGE_MIN) / AGE_SPAN) * eff + THUMB_SIZE / 2;
        const maxCx = ((maxRef.current - AGE_MIN) / AGE_SPAN) * eff + THUMB_SIZE / 2;

        const distMin = Math.abs(localX - minCx);
        const distMax = Math.abs(localX - maxCx);

        let chosen = 'min';
        if (distMin < distMax) {
          chosen = 'min';
        } else if (distMax < distMin) {
          chosen = 'max';
        } else {
          chosen = localX < minCx ? 'min' : 'max';
        }

        dragRef.current = chosen;
        setActiveThumb(chosen);

        const newAge = ageForX(localX);
        if (chosen === 'min') {
          const clamped = Math.min(newAge, maxRef.current - 1);
          minRef.current = clamped;
          onChange(clamped, maxRef.current);
        } else {
          const clamped = Math.max(newAge, minRef.current + 1);
          maxRef.current = clamped;
          onChange(minRef.current, clamped);
        }
      },

      onPanResponderMove: (evt) => {
        const pageX = evt.nativeEvent.pageX;
        const localX = pageX - trackPageXRef.current;
        const newAge = ageForX(localX);
        const chosen = dragRef.current || 'min';

        if (chosen === 'min') {
          const clamped = Math.max(AGE_MIN, Math.min(newAge, maxRef.current - 1));
          if (clamped !== minRef.current) {
            minRef.current = clamped;
            onChange(clamped, maxRef.current);
          }
        } else {
          const clamped = Math.min(AGE_MAX, Math.max(newAge, minRef.current + 1));
          if (clamped !== maxRef.current) {
            maxRef.current = clamped;
            onChange(minRef.current, clamped);
          }
        }
      },

      onPanResponderRelease: () => {
        dragRef.current = null;
        setActiveThumb(null);
        onSlidingChange && onSlidingChange(false);
      },

      onPanResponderTerminate: () => {
        dragRef.current = null;
        setActiveThumb(null);
        onSlidingChange && onSlidingChange(false);
      },
    })
  ).current;

  const leftPos = posForAge(minAge);
  const rightPos = posForAge(maxAge);

  return (
    <View style={styles.rangeSliderWrapper}>
      {/* Slider Header */}
      <View style={styles.sliderHeaderRow}>
        <Text style={styles.sectionHeading}>Age Range</Text>
        <Text style={[styles.rangeValueText, isDarkMode && { color: '#000000' }]}>
          {minAge} - {maxAge >= 60 ? '60+' : maxAge} yrs
        </Text>
      </View>

      {/* Slider Container with Tooltip Bubbles and Track */}
      <View
        style={styles.sliderContainer}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            setTrackWidth(w);
            widthRef.current = w;
          }
          if (trackViewRef.current) {
            trackViewRef.current.measure((_x, _y, _w, _h, px) => {
              trackPageXRef.current = px;
            });
          }
        }}
      >
        {/* Tooltip Bubbles Area */}
        <View style={styles.tooltipsRow} pointerEvents="none">
          {/* Left Bubble */}
          <View style={[styles.bubbleWrapper, { left: leftPos + THUMB_SIZE / 2 }]}>
            <View
              style={[
                styles.bubbleBody,
                isDarkMode && { backgroundColor: '#000000', shadowColor: '#000000' },
                activeThumb === 'min' && (isDarkMode ? styles.bubbleBodyActiveDark : styles.bubbleBodyActive),
              ]}
            >
              <Text style={styles.bubbleText}>{minAge}</Text>
            </View>
            <View style={[styles.bubbleBeak, isDarkMode && { borderTopColor: '#000000' }]} />
          </View>

          {/* Right Bubble */}
          <View style={[styles.bubbleWrapper, { left: rightPos + THUMB_SIZE / 2 }]}>
            <View
              style={[
                styles.bubbleBody,
                isDarkMode && { backgroundColor: '#000000', shadowColor: '#000000' },
                activeThumb === 'max' && (isDarkMode ? styles.bubbleBodyActiveDark : styles.bubbleBodyActive),
              ]}
            >
              <Text style={styles.bubbleText}>{maxAge >= 60 ? '60+' : maxAge}</Text>
            </View>
            <View style={[styles.bubbleBeak, isDarkMode && { borderTopColor: '#000000' }]} />
          </View>
        </View>

        {/* Track Line Area with Full PanResponder Touch Layer */}
        <View
          ref={trackViewRef}
          style={styles.trackTouchLayer}
          {...panResponder.panHandlers}
        >
          {/* Inactive Gray Base Track */}
          <View style={styles.baseTrack} />

          {/* Active Highlighted Track */}
          <View
            style={[
              styles.activeTrack,
              isDarkMode && { backgroundColor: '#000000' },
              {
                left: leftPos + THUMB_SIZE / 2,
                width: Math.max(4, rightPos - leftPos),
              },
            ]}
          />

          {/* Left Thumb Knob */}
          <View
            style={[
              styles.thumbNode,
              isDarkMode && { backgroundColor: '#000000' },
              { left: leftPos },
              activeThumb === 'min' && (isDarkMode ? styles.thumbNodeActiveDark : styles.thumbNodeActive),
            ]}
          />

          {/* Right Thumb Knob */}
          <View
            style={[
              styles.thumbNode,
              isDarkMode && { backgroundColor: '#000000' },
              { left: rightPos },
              activeThumb === 'max' && (isDarkMode ? styles.thumbNodeActiveDark : styles.thumbNodeActive),
            ]}
          />
        </View>

        {/* Axis Tick Marks & Numbers */}
        <View style={styles.axisTicksRow}>
          <TouchableOpacity onPress={() => onChange(18, maxAge)} hitSlop={10}>
            <Text style={[styles.tickLabel, minAge === 18 && (isDarkMode ? { color: '#000000', fontWeight: '800' } : styles.activeTickLabel)]}>18</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChange(25, maxAge)} hitSlop={10}>
            <Text style={styles.tickLabel}>25</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChange(minAge, 35)} hitSlop={10}>
            <Text style={styles.tickLabel}>35</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChange(minAge, 60)} hitSlop={10}>
            <Text style={[styles.tickLabel, maxAge >= 60 && (isDarkMode ? { color: '#000000', fontWeight: '800' } : styles.activeTickLabel)]}>60+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function DiscoverFiltersModal({
  visible,
  onClose,
  initialFilters = DEFAULT_FILTERS,
  onApplyFilters,
}) {
  const { isDarkMode } = useTheme();
  const [filters, setFilters] = useState(initialFilters);
  const [showMoreInterests, setShowMoreInterests] = useState(false);
  const [cityInput, setCityInput] = useState(filters.selectedCity || '');
  const [stateInput, setStateInput] = useState(filters.selectedState || '');
  const [scrollEnabled, setScrollEnabled] = useState(true);

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setCityInput('');
    setStateInput('');
  };

  const handleApply = () => {
    onApplyFilters({
      ...filters,
      selectedCity: cityInput,
      selectedState: stateInput,
    });
    onClose();
  };

  const toggleInterest = (interestLabel) => {
    setFilters((prev) => {
      const exists = prev.interests.includes(interestLabel);
      if (exists) {
        return { ...prev, interests: prev.interests.filter((i) => i !== interestLabel) };
      } else {
        return { ...prev, interests: [...prev.interests, interestLabel] };
      }
    });
  };

  const visibleInterests = showMoreInterests
    ? INTEREST_OPTIONS
    : INTEREST_OPTIONS.slice(0, 10);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Top Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="options" size={22} color={isDarkMode ? '#000000' : '#FF2E63'} style={{ marginRight: 8 }} />
              <Text style={styles.modalTitle}>Discover Filters</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.closeIconBtn}>
              <Ionicons name="close" size={22} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Filters Content */}
          <ScrollView
            scrollEnabled={scrollEnabled}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Looking For */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Looking For</Text>
              <View style={styles.chipsRow}>
                {LOOKING_FOR_OPTIONS.map((option) => {
                  const isSelected = filters.lookingFor === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      activeOpacity={0.75}
                      style={[
                        styles.chipButton,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipButtonSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, lookingFor: option })}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      )}
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Age Range */}
            <View style={styles.sectionContainer}>
              <AgeRangeSlider
                minAge={filters.minAge}
                maxAge={filters.maxAge}
                onChange={(min, max) =>
                  setFilters((prev) => ({ ...prev, minAge: min, maxAge: max }))
                }
                onSlidingChange={(isSliding) => setScrollEnabled(!isSliding)}
              />
            </View>

            {/* 3. Distance */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderBetween}>
                <Text style={styles.sectionHeading}>Distance</Text>
                <Text style={[styles.selectedMetaText, isDarkMode && { color: '#000000' }]}>{filters.distance}</Text>
              </View>
              <View style={styles.chipsRow}>
                {DISTANCE_OPTIONS.map((dist) => {
                  const isSelected = filters.distance === dist;
                  return (
                    <TouchableOpacity
                      key={dist}
                      activeOpacity={0.75}
                      style={[
                        styles.smallChip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.smallChipSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, distance: dist })}
                    >
                      <Text
                        style={[
                          styles.smallChipText,
                          isSelected && styles.smallChipTextSelected,
                        ]}
                      >
                        {dist}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Location */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Location</Text>
              
              <TouchableOpacity
                activeOpacity={0.75}
                style={[
                  styles.locationTypeBtn,
                  filters.locationType === 'Current Location' && (isDarkMode ? styles.locationTypeBtnSelectedDark : styles.locationTypeBtnSelected),
                ]}
                onPress={() =>
                  setFilters({ ...filters, locationType: 'Current Location' })
                }
              >
                <View style={styles.locationIconWrap}>
                  <Ionicons name="navigate" size={18} color={isDarkMode ? '#000000' : '#FF2E63'} />
                </View>
                <Text style={styles.locationTypeBtnText}>Use Current Location (GPS)</Text>
                {filters.locationType === 'Current Location' && (
                  <Ionicons name="checkmark-circle" size={20} color={isDarkMode ? '#000000' : '#FF2E63'} />
                )}
              </TouchableOpacity>

              <View style={styles.locationInputsGrid}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputSubLabel}>Select City</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="business-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                    <TextInput
                      placeholder="e.g. Mumbai, Jaipur"
                      placeholderTextColor="#9CA3AF"
                      style={styles.textInput}
                      value={cityInput}
                      onChangeText={(text) => {
                        setCityInput(text);
                        setFilters((prev) => ({ ...prev, locationType: 'Custom' }));
                      }}
                    />
                  </View>
                </View>

                <View style={styles.inputCol}>
                  <Text style={styles.inputSubLabel}>Select State</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="map-outline" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
                    <TextInput
                      placeholder="e.g. Maharashtra"
                      placeholderTextColor="#9CA3AF"
                      style={styles.textInput}
                      value={stateInput}
                      onChangeText={(text) => {
                        setStateInput(text);
                        setFilters((prev) => ({ ...prev, locationType: 'Custom' }));
                      }}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* 5. Interests */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderBetween}>
                <Text style={styles.sectionHeading}>Interests</Text>
                <Text style={[styles.selectedMetaText, isDarkMode && { color: '#000000' }]}>
                  {filters.interests.length} selected
                </Text>
              </View>
              <View style={styles.chipsRow}>
                {visibleInterests.map((item) => {
                  const isSelected = filters.interests.includes(item.label);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      style={[
                        styles.interestChip,
                        isSelected && (isDarkMode ? styles.interestChipSelectedDark : styles.interestChipSelected),
                      ]}
                      onPress={() => toggleInterest(item.label)}
                    >
                      <Text style={{ marginRight: 6, fontSize: 14 }}>{item.emoji}</Text>
                      <Text
                        style={[
                          styles.interestChipText,
                          isSelected && styles.interestChipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    styles.moreInterestBtn,
                    isDarkMode && { borderColor: 'rgba(0,0,0,0.3)', backgroundColor: 'rgba(0,0,0,0.06)' },
                  ]}
                  onPress={() => setShowMoreInterests(!showMoreInterests)}
                >
                  <Text style={[styles.moreInterestBtnText, isDarkMode && { color: '#000000' }]}>
                    {showMoreInterests ? 'Show Less' : '+ More'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 6. Profile Type */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Profile Type</Text>
              <View style={styles.chipsRow}>
                {PROFILE_TYPE_OPTIONS.map((item) => {
                  const isSelected = filters.profileType === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      style={[
                        styles.profileTypeChip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.profileTypeChipSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, profileType: item.id })}
                    >
                      <Ionicons
                        name={item.icon}
                        size={16}
                        color={isSelected ? '#FFFFFF' : item.iconColor || '#4B5563'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.profileTypeChipText,
                          isSelected && styles.profileTypeChipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 7. Relationship Preference */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Relationship Preference</Text>
              <View style={styles.chipsRow}>
                {RELATIONSHIP_OPTIONS.map((rel) => {
                  const isSelected = filters.relationship === rel;
                  return (
                    <TouchableOpacity
                      key={rel}
                      activeOpacity={0.75}
                      style={[
                        styles.chipButton,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipButtonSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, relationship: rel })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {rel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 8. Online Status */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Online Status</Text>
              <View style={styles.chipsRow}>
                {ONLINE_STATUS_OPTIONS.map((status) => {
                  const isSelected = filters.onlineStatus === status.id;
                  return (
                    <TouchableOpacity
                      key={status.id}
                      activeOpacity={0.75}
                      style={[
                        styles.statusChip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.statusChipSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, onlineStatus: status.id })}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isSelected ? '#FFFFFF' : status.badgeColor },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusChipText,
                          isSelected && styles.statusChipTextSelected,
                        ]}
                      >
                        {status.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 9. Profile Completeness */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Profile Completeness</Text>
              <View style={styles.chipsRow}>
                {PROFILE_COMPLETENESS_OPTIONS.map((comp) => {
                  const isSelected = filters.profileCompleteness === comp.id;
                  return (
                    <TouchableOpacity
                      key={comp.id}
                      activeOpacity={0.75}
                      style={[
                        styles.chipButton,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipButtonSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, profileCompleteness: comp.id })}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {comp.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 10. Sort By (Last Section - zero bottom margin/gap) */}
            <View style={styles.lastSectionContainer}>
              <Text style={styles.sectionHeading}>Sort By</Text>
              <View style={styles.chipsRow}>
                {SORT_BY_OPTIONS.map((sortItem) => {
                  const isSelected = filters.sortBy === sortItem.id;
                  return (
                    <TouchableOpacity
                      key={sortItem.id}
                      activeOpacity={0.75}
                      style={[
                        styles.sortChip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.sortChipSelected),
                      ]}
                      onPress={() => setFilters({ ...filters, sortBy: sortItem.id })}
                    >
                      <Ionicons
                        name={sortItem.icon}
                        size={16}
                        color={isSelected ? '#FFFFFF' : '#4B5563'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.sortChipText,
                          isSelected && styles.sortChipTextSelected,
                        ]}
                      >
                        {sortItem.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* 11. Bottom Action Buttons Bar */}
          <View style={styles.bottomBarContainer}>
            <TouchableOpacity
              style={styles.resetButton}
              activeOpacity={0.8}
              onPress={handleReset}
            >
              <Ionicons name="refresh-outline" size={18} color="#6B7280" style={{ marginRight: 6 }} />
              <Text style={styles.resetButtonText}>Reset Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.applyButton,
                isDarkMode && { shadowColor: '#000000' },
              ]}
              activeOpacity={0.85}
              onPress={handleApply}
            >
              <LinearGradient
                colors={isDarkMode ? ['#27272A', '#000000'] : ['#FF527B', '#FF2E63']}
                style={styles.applyButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="checkmark-sharp" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.9,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  closeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionContainer: {
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastSectionContainer: {
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF2E63',
  },

  /* ----------------- Option 3 Slider Styles ----------------- */
  ageSliderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  ageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ageCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  agePillBadge: {
    backgroundColor: 'rgba(255, 46, 99, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 99, 0.15)',
  },
  agePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2E63',
  },
  sliderContainer: {
    width: '100%',
    marginVertical: 4,
    position: 'relative',
  },
  tooltipsRow: {
    height: 36,
    width: '100%',
    position: 'relative',
  },
  bubbleWrapper: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    width: 38,
    marginLeft: -19,
  },
  bubbleBody: {
    backgroundColor: '#FF2E63',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 28,
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  bubbleBodyActive: {
    backgroundColor: '#E01E50',
    transform: [{ scale: 1.08 }],
  },
  bubbleBodyActiveDark: {
    backgroundColor: '#000000',
    transform: [{ scale: 1.08 }],
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  bubbleBeak: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF2E63',
    alignSelf: 'center',
  },
  trackTouchLayer: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  baseTrack: {
    height: 6,
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
  },
  activeTrack: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#FF2E63',
    borderRadius: 3,
  },
  thumbNode: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FF2E63',
    borderWidth: 3.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbNodeActive: {
    transform: [{ scale: 1.2 }],
    shadowColor: '#FF2E63',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 7,
  },
  thumbNodeActiveDark: {
    transform: [{ scale: 1.2 }],
    backgroundColor: '#000000',
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 7,
  },
  axisTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingHorizontal: 2,
  },
  tickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTickLabel: {
    color: '#FF2E63',
    fontWeight: '800',
  },

  /* ----------------- Common Category Styles ----------------- */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipButtonSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chipSelectedDark: {
    backgroundColor: '#000000',
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  interestChipSelectedDark: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  locationTypeBtnSelectedDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderColor: '#000000',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  smallChip: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  smallChipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  smallChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  smallChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 10,
  },
  locationTypeBtnSelected: {
    backgroundColor: 'rgba(255, 46, 99, 0.06)',
    borderColor: '#FF2E63',
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  locationTypeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  locationInputsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  inputCol: {
    flex: 1,
  },
  inputSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    height: 42,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  interestChipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  interestChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  moreInterestBtn: {
    backgroundColor: 'rgba(255, 46, 99, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 46, 99, 0.25)',
  },
  moreInterestBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2E63',
  },
  profileTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileTypeChipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  profileTypeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  profileTypeChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusChipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  statusChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sortChipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  sortChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
  },
  applyButton: {
    flex: 1.5,
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
