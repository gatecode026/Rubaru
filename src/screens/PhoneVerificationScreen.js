import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COUNTRIES = [
  { name: 'India', flag: '🇮🇳', code: '+91', digits: 10, placeholder: 'Enter 10-digit mobile number' },
  { name: 'United States', flag: '🇺🇸', code: '+1', digits: 10, placeholder: 'Enter 10-digit mobile number' },
  { name: 'United Kingdom', flag: '🇬🇧', code: '+44', digits: 10, placeholder: 'Enter 10-digit mobile number' },
  { name: 'Canada', flag: '🇨🇦', code: '+1', digits: 10, placeholder: 'Enter 10-digit mobile number' },
  { name: 'United Arab Emirates', flag: '🇦🇪', code: '+971', digits: 9, placeholder: 'Enter 9-digit mobile number' },
  { name: 'Saudi Arabia', flag: '🇸🇦', code: '+966', digits: 9, placeholder: 'Enter 9-digit mobile number' },
];

export default function PhoneVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    // Validate phone number length strictly based on country
    if (!phoneNumber || phoneNumber.trim().length !== selectedCountry.digits) {
      alert(`Please enter a valid ${selectedCountry.digits}-digit mobile number for ${selectedCountry.name}.`);
      return;
    }
    
    const fullPhone = selectedCountry.code + phoneNumber.trim();

    setLoading(true);
    try {
      const response = await api.post('/auth/register-phone', { phone: fullPhone });
      setLoading(false);
      
      router.push({
        pathname: '/otp-verification',
        params: { phone: fullPhone, otp: response.data.otp }
      });
    } catch (error) {
      setLoading(false);
      console.error(error);
      const errMsg = error.response?.data?.message || 'Failed to connect. Please try again.';
      alert(errMsg);
    }
  };

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setPhoneNumber(''); // Reset phone input on country change
    setShowCountryModal(false);
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
              <Pressable 
                onPress={() => setShowCountryModal(true)} 
                style={styles.countryPickerTrigger}
              >
                <Text style={styles.flagEmoji}>{selectedCountry.flag}</Text>
                <Text style={styles.countryCodeText}>({selectedCountry.code})</Text>
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
                placeholder={selectedCountry.placeholder}
                placeholderTextColor="#9CA3AF"
                maxLength={selectedCountry.digits}
              />
            </View>

            {/* Continue Button */}
            <Pressable
              onPress={loading ? null : handleContinue}
              style={({ pressed }) => [styles.continueButton, (pressed || loading) && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </Pressable>
          </View>

          {/* Country Selection Modal */}
          <Modal
            visible={showCountryModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowCountryModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Country</Text>
                <FlatList
                  data={COUNTRIES}
                  keyExtractor={(item) => item.code + item.name}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.countryItem}
                      onPress={() => handleSelectCountry(item)}
                    >
                      <Text style={styles.flagEmoji}>{item.flag}</Text>
                      <Text style={styles.countryItemText}>{item.name}</Text>
                      <Text style={styles.countryItemCode}>{item.code}</Text>
                    </Pressable>
                  )}
                />
                <Pressable
                  style={styles.closeModalButton}
                  onPress={() => setShowCountryModal(false)}
                >
                  <Text style={styles.closeModalButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH - 64,
    maxHeight: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryItemText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },
  countryItemCode: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '700',
  },
  closeModalButton: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
});
