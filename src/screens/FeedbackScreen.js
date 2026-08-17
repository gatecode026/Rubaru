import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  TextInput,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const [rating, setRating] = useState(4);
  const [feedbackText, setFeedbackText] = useState('');

  const handleStarPress = (starIndex) => {
    if (rating === starIndex) {
      // 1-click deselect: if tapping the highest active star, deselect it (down to 0 if star 1)
      setRating(starIndex - 1);
    } else {
      // Select up to this star
      setRating(starIndex);
    }
  };

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
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Feedback</Text>

            <View style={{ width: 44 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero Section */}
            <View style={styles.heroContainer}>
              <View style={styles.heroTitleRow}>
                <Text style={styles.starEmoji}>⭐</Text>
                <Text style={styles.heroTitle}>Feedback</Text>
              </View>

              <Text style={styles.heroDescription}>
                Your feedback helps us improve Rubaru and create a better experience for everyone. We’d love to hear your thoughts!
              </Text>
            </View>

            {/* Rate Your Experience Section */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>Rate Your Experience</Text>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starIndex) => {
                  const isSelected = starIndex <= rating;
                  return (
                    <TouchableOpacity
                      key={starIndex}
                      activeOpacity={0.65}
                      onPress={() => handleStarPress(starIndex)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={isSelected ? 'star' : 'star-outline'}
                        size={36}
                        color={isSelected ? '#FFB800' : '#D1D5DB'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Your Feedback Text Area */}
            <View style={styles.inputContainer}>
              <Text style={styles.floatingLabel}>Your Feedback</Text>
              <TextInput
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Tell us what happened in detail."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={5}
                style={[styles.textInput, styles.textAreaInput]}
              />
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            </Pressable>
          </ScrollView>
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
    paddingHorizontal: 20,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    marginBottom: 16,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  heroContainer: {
    marginBottom: 24,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starEmoji: {
    fontSize: 20,
    marginRight: 6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.3,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
  ratingSection: {
    marginBottom: 24,
  },
  ratingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  starButton: {
    padding: 4,
    borderRadius: 12,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 28,
    marginTop: 8,
  },
  floatingLabel: {
    position: 'absolute',
    top: -9,
    left: 14,
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    zIndex: 10,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14.5,
    color: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  textAreaInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#FF6584',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
