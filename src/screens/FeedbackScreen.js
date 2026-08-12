import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  TextInput,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rating, setRating] = useState(4);
  const [feedbackText, setFeedbackText] = useState('');

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
              paddingTop: Math.max(insets.top + 12, 40),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.push('/user-profile?openSettings=true')}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back to sidebar"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Feedback</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
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

            {/* Rate Your Experience */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>Rate Your Experience</Text>

              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((starIndex) => {
                  const isSelected = starIndex <= rating;
                  return (
                    <Pressable
                      key={starIndex}
                      onPress={() => setRating(starIndex)}
                      style={styles.starButton}
                    >
                      <Ionicons
                        name={isSelected ? "star" : "star-outline"}
                        size={34}
                        color={isSelected ? "#10B981" : "#D1D5DB"}
                      />
                    </Pressable>
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
              onPress={() => router.back()}
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
    paddingHorizontal: 16,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    marginBottom: 20,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  ratingSection: {
    marginBottom: 20,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  starButton: {
    padding: 2,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 24,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  textAreaInput: {
    height: 110,
    textAlignVertical: 'top',
  },
  submitButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
