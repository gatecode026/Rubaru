import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INTERESTS_LIST = [
  { id: 'photography', label: 'Photography', icon: 'camera-outline' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle-outline' },
  { id: 'karaoke', label: 'Karaoke', icon: 'mic-outline' },
  { id: 'yoga', label: 'Yoga', icon: 'flower-outline' },
  { id: 'cooking', label: 'Cooking', icon: 'restaurant-outline' },
  { id: 'tennis', label: 'Tennis', icon: 'tennisball-outline' },
  { id: 'run', label: 'Run', icon: 'walk-outline' },
  { id: 'swimming', label: 'Swimming', icon: 'water-outline' },
  { id: 'art', label: 'Art', icon: 'color-palette-outline' },
  { id: 'traveling', label: 'Traveling', icon: 'airplane-outline' },
  { id: 'extreme', label: 'Extreme', icon: 'diamond-outline' },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { id: 'drink', label: 'Drink', icon: 'wine-outline' },
  { id: 'videogames', label: 'Video games', icon: 'game-controller-outline' },
];

export default function InterestsSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState(['shopping', 'run', 'traveling']);

  const toggleInterest = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    router.push('/search-friends');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          
          {/* Header Row with Back Button and Skip Link */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <Pressable onPress={handleSkip} hitSlop={12}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Title Header */}
            <Text style={styles.titleText}>Your interests</Text>

            {/* Subtitle */}
            <Text style={styles.subtitleText}>
              Select a few of your interests and let everyone know{'\n'}what you're passionate about.
            </Text>

            {/* 2-Column Grid of Interest Cards */}
            <View style={styles.gridContainer}>
              {INTERESTS_LIST.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleInterest(item.id)}
                    style={({ pressed }) => [
                      styles.interestCard,
                      isSelected && styles.interestCardSelected,
                      pressed && styles.buttonPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isSelected ? '#FFFFFF' : '#111827'}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={[styles.interestText, isSelected && styles.interestTextSelected]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Bottom Continue Button */}
          <View style={styles.bottomButtonWrapper}>
            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>

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
    justifyContent: 'space-between',
    marginBottom: 20,
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
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  titleText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 28,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  interestCard: {
    width: (SCREEN_WIDTH - 62) / 2,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  interestCardSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  interestTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomButtonWrapper: {
    width: '100%',
    paddingTop: 8,
  },
  continueButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#111827',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
