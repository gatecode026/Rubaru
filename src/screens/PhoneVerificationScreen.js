import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PhoneVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');

  const handleContinue = () => {
    router.push('/otp-verification');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Safe Area Top Container */}
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 48), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          
          {/* Header Row with Back Button */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color="#111827" />
            </Pressable>
          </View>

          {/* Centered Main Content Block */}
          <View style={styles.centeredBlock}>
            {/* Title Header */}
            <Text style={styles.titleText}>My mobile</Text>

            {/* Subtitle instructions */}
            <Text style={styles.subtitleText}>
              Please enter your valid phone number. We will send{'\n'}you a 4-digit code to verify your account.
            </Text>

            {/* Phone Number Input Card */}
            <View style={styles.phoneInputContainer}>
              {/* Country Code Dropdown Trigger */}
              <Pressable style={styles.countryPickerTrigger}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.countryCodeText}>({countryCode})</Text>
                <Ionicons name="chevron-down" size={14} color="#6B7280" style={{ marginLeft: 4 }} />
              </Pressable>

              {/* Vertical Separator Line */}
              <View style={styles.inputDivider} />

              {/* Phone Number Input */}
              <TextInput
                style={styles.phoneTextInput}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                placeholder="Enter mobile number"
                placeholderTextColor="#9CA3AF"
                maxLength={15}
              />
            </View>

            {/* Continue Button */}
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
    height: 44,
    justifyContent: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  centeredBlock: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
    marginTop: 12,
  },
  titleText: {
    fontSize: 32,
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
    marginBottom: 32,
  },
  phoneInputContainer: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 32,
  },
  countryPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 18,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  inputDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 14,
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  continueButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF2E63',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
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
