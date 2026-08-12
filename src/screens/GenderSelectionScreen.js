import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GenderSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedGender, setSelectedGender] = useState('man');

  const handleContinue = () => {
    router.push('/interests-selection');
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

          {/* Centered Main Form Block */}
          <View style={styles.formContainer}>
            {/* Title Header */}
            <Text style={styles.titleText}>I am a</Text>

            {/* Gender Options Cards Stack */}
            <View style={styles.optionsStack}>
              
              {/* Option 1: Woman */}
              <Pressable
                onPress={() => setSelectedGender('woman')}
                style={({ pressed }) => [
                  styles.optionCard,
                  selectedGender === 'woman' && styles.optionCardSelected,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Woman"
              >
                <Text style={[styles.optionText, selectedGender === 'woman' && styles.optionTextSelected]}>
                  Woman
                </Text>
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={selectedGender === 'woman' ? '#FFFFFF' : 'rgba(209, 213, 219, 0.8)'}
                />
              </Pressable>

              {/* Option 2: Man */}
              <Pressable
                onPress={() => setSelectedGender('man')}
                style={({ pressed }) => [
                  styles.optionCard,
                  selectedGender === 'man' && styles.optionCardSelected,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Man"
              >
                <Text style={[styles.optionText, selectedGender === 'man' && styles.optionTextSelected]}>
                  Man
                </Text>
                <Ionicons
                  name="checkmark"
                  size={20}
                  color={selectedGender === 'man' ? '#FFFFFF' : 'rgba(209, 213, 219, 0.8)'}
                />
              </Pressable>

              {/* Option 3: Choose another */}
              <Pressable
                onPress={() => setSelectedGender('other')}
                style={({ pressed }) => [
                  styles.optionCard,
                  selectedGender === 'other' && styles.optionCardSelected,
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Choose another"
              >
                <Text style={[styles.optionText, selectedGender === 'other' && styles.optionTextSelected]}>
                  Choose another
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={selectedGender === 'other' ? '#FFFFFF' : '#9CA3AF'}
                />
              </Pressable>

            </View>
          </View>

          {/* Flexible Spacer */}
          <View style={{ flex: 1 }} />

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
    marginBottom: 28,
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
  formContainer: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 36,
    letterSpacing: -0.5,
    alignSelf: 'flex-start',
  },
  optionsStack: {
    width: '100%',
  },
  optionCard: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCardSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomButtonWrapper: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
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
