import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  TextInput,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const SUPPORT_CATEGORIES = [
  { id: 'account', label: 'Account & Login' },
  { id: 'profile', label: 'Profile Issues' },
  { id: 'wallet', label: 'Wallet & Coins' },
  { id: 'payment', label: 'Payment & Transactions' },
  { id: 'audio-call', label: 'Audio Call Issues' },
  { id: 'video-call', label: 'Video Call Issues' },
  { id: 'chat', label: 'Chat Problems' },
  { id: 'report-user', label: 'Report a User' },
  { id: 'privacy', label: 'Privacy & Security' },
  { id: 'technical', label: 'Technical Support' },
  { id: 'other', label: 'Other' },
];

export default function CustomerSupportFlowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('profile');

  // Step 2 Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const handleHeaderBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      router.push('/help-support');
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (step === 2) {
        setStep(1);
        return true;
      }
      router.push('/help-support');
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [step, router]);

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
              onPress={handleHeaderBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Customer Support</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {step === 1 ? (
              /* STEP 1: Choose a Support Category */
              <View style={styles.stepOneContainer}>
                <Text style={styles.categoryHeading}>Choose a Support Category</Text>

                <View style={styles.categoryList}>
                  {SUPPORT_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setSelectedCategory(cat.id)}
                        style={({ pressed }) => [
                          styles.categoryRow,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.categoryLabel}>{cat.label}</Text>
                        
                        {/* Radio Circle */}
                        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Next Button */}
                <Pressable
                  onPress={() => setStep(2)}
                  style={({ pressed }) => [styles.nextButtonRow, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.nextText}>Next</Text>
                  <Ionicons name="arrow-forward" size={18} color="#2563EB" style={{ marginLeft: 4 }} />
                </Pressable>
              </View>
            ) : (
              /* STEP 2: Support Request Form */
              <View style={styles.stepTwoContainer}>
                
                {/* Full Name */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Full Name</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter a short title"
                    placeholderTextColor="#9CA3AF"
                    style={styles.textInput}
                  />
                </View>

                {/* Email Address */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Email Address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="XXXXXXXXXXX"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.textInput}
                  />
                </View>

                {/* Registered Mobile Number */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Registered Mobile Number</Text>
                  <TextInput
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    placeholder="XXXXXXXXXXX"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    style={styles.textInput}
                  />
                </View>

                {/* Subject */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Subject</Text>
                  <TextInput
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="XXXXXXXXXXX"
                    placeholderTextColor="#9CA3AF"
                    style={styles.textInput}
                  />
                </View>

                {/* Describe Your Issue */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Describe Your Issue</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Tell us what happened in detail."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    style={[styles.textInput, styles.textAreaInput]}
                  />
                </View>

                {/* Attach Files */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Attach Files</Text>
                  <Pressable
                    style={({ pressed }) => [styles.uploadBox, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.uploadText}>
                      Upload Screenshot/ Upload Screen Recording
                    </Text>
                    <Ionicons name="arrow-up-outline" size={24} color="#111827" style={styles.uploadIcon} />
                  </Pressable>
                </View>

                {/* Submit Report Button */}
                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </Pressable>

                {/* Contact Us Button */}
                <Pressable
                  onPress={() => router.push('/contact-us')}
                  style={({ pressed }) => [styles.contactUsButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.contactUsButtonText}>Contact Us</Text>
                </Pressable>

              </View>
            )}

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
    marginBottom: 12,
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
  headerRightBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  stepOneContainer: {
    paddingTop: 8,
  },
  categoryHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  categoryList: {
    gap: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#10B981',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10B981',
  },
  nextButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 28,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  stepTwoContainer: {
    paddingTop: 8,
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 16,
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
    height: 90,
    textAlignVertical: 'top',
  },
  uploadBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 18,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadIcon: {
    alignSelf: 'center',
  },
  submitButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
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
  contactUsButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#FF2E63',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  contactUsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
