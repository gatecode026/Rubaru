import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'all', label: 'All Categories', icon: 'apps-outline' },
  { id: 'gaming', label: 'Gaming Group', icon: 'game-controller-outline' },
  { id: 'gossip', label: 'Gossip Group', icon: 'chatbubbles-outline' },
  { id: 'entertainment', label: 'Entertainment', icon: 'musical-notes-outline' },
  { id: 'dating', label: 'Dating & Chat', icon: 'heart-outline' },
  { id: 'sports', label: 'Sports & Fitness', icon: 'fitness-outline' },
];

const SORT_OPTIONS = [
  { id: 'popular', label: 'Most Popular', icon: 'flame-outline' },
  { id: 'active', label: 'Most Active', icon: 'flash-outline' },
  { id: 'recent', label: 'Recently Created', icon: 'time-outline' },
  { id: 'alphabetical', label: 'Alphabetical (A-Z)', icon: 'text-outline' },
];

const GROUP_STATUS_OPTIONS = [
  { id: 'all', label: 'All Groups' },
  { id: 'online', label: 'Active Now 🟢' },
  { id: 'open', label: 'Open to Join' },
];

const GROUP_SIZE_OPTIONS = [
  { id: 'any', label: 'Any Size' },
  { id: 'small', label: '< 50 Members' },
  { id: 'medium', label: '50 - 500' },
  { id: 'large', label: '500+ Members' },
];

export default function GroupFilterModal({ visible, onClose, onApplyFilters, initialFilters }) {
  const { isDarkMode } = useTheme();

  const [category, setCategory] = useState(initialFilters?.category || 'all');
  const [sortBy, setSortBy] = useState(initialFilters?.sortBy || 'popular');
  const [status, setStatus] = useState(initialFilters?.status || 'all');
  const [groupSize, setGroupSize] = useState(initialFilters?.groupSize || 'any');

  const handleReset = () => {
    setCategory('all');
    setSortBy('popular');
    setStatus('all');
    setGroupSize('any');
  };

  const handleApply = () => {
    if (onApplyFilters) {
      onApplyFilters({
        category,
        sortBy,
        status,
        groupSize,
      });
    }
    onClose();
  };

  // Button gradient colors for light mode vs dark mode
  const applyBtnColors = isDarkMode ? ['#1C1C1E', '#3A3A3C'] : ['#FF2E63', '#E63956'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdropOverlay}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        {/* Bottom Sheet Card - Keep light background intact in dark mode */}
        <View style={styles.sheetContainer}>
          {/* Sheet Handle */}
          <View style={styles.handlePill} />

          {/* Header Row */}
          <View style={styles.headerRow}>
            <Pressable onPress={handleReset} hitSlop={12}>
              <Text style={[styles.resetText, isDarkMode && styles.resetTextDark]}>
                Reset
              </Text>
            </Pressable>

            <Text style={styles.headerTitle}>
              Filter Groups
            </Text>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Category Filter Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Category</Text>
              <View style={styles.chipsContainer}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCategory(cat.id)}
                      style={[
                        styles.chip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipSelected),
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
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Sort By Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Sort By</Text>
              <View style={styles.chipsContainer}>
                {SORT_OPTIONS.map((sort) => {
                  const isSelected = sortBy === sort.id;
                  return (
                    <Pressable
                      key={sort.id}
                      onPress={() => setSortBy(sort.id)}
                      style={[
                        styles.chip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipSelected),
                      ]}
                    >
                      <Ionicons
                        name={sort.icon}
                        size={14}
                        color={isSelected ? '#FFFFFF' : '#6B7280'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {sort.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Group Status Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Group Status</Text>
              <View style={styles.chipsContainer}>
                {GROUP_STATUS_OPTIONS.map((item) => {
                  const isSelected = status === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setStatus(item.id)}
                      style={[
                        styles.chip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipSelected),
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Group Size Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeading}>Group Size</Text>
              <View style={styles.chipsContainer}>
                {GROUP_SIZE_OPTIONS.map((item) => {
                  const isSelected = groupSize === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setGroupSize(item.id)}
                      style={[
                        styles.chip,
                        isSelected && (isDarkMode ? styles.chipSelectedDark : styles.chipSelected),
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          isSelected && styles.chipTextSelected,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Footer Action Button */}
          <View style={styles.footerContainer}>
            <TouchableOpacity
              onPress={handleApply}
              activeOpacity={0.88}
              style={[styles.applyBtn, isDarkMode && styles.applyBtnDarkShadow]}
            >
              <LinearGradient
                colors={applyBtnColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyBtnGradient}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: SCREEN_HEIGHT * 0.82,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  handlePill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF2E63',
  },
  resetTextDark: {
    color: '#1C1C1E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionContainer: {
    marginBottom: 22,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  chipSelectedDark: {
    backgroundColor: '#1C1C1E',
    borderColor: '#1C1C1E',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#F3F4F6',
  },
  applyBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  applyBtnDarkShadow: {
    shadowColor: '#1C1C1E',
  },
  applyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
