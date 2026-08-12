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

const CATEGORIES = [
  { id: 'profile', label: 'Profile Issue' },
  { id: 'audio-call', label: 'Audio Call Issue' },
  { id: 'video-call', label: 'Video Call Issue' },
  { id: 'wallet', label: 'Wallet & Coins' },
  { id: 'payment-failed', label: 'Payment Failed' },
  { id: 'transaction', label: 'Transaction Issue' },
  { id: 'fake-profile', label: 'Fake Profile' },
  { id: 'harassment', label: 'Harassment or Abuse' },
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'scam', label: 'Scam or Fraud' },
  { id: 'account', label: 'Account & Login Issue' },
  { id: 'notification', label: 'Notification Issue' },
  { id: 'app-bug', label: 'App Bug' },
  { id: 'network', label: 'Network / Connection Issue' },
  { id: 'other', label: 'Other' },
];

export default function ReportProblemScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('audio-call');

  // Step 2 Form States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [profileId, setProfileId] = useState('');

  const handleHeaderBack = () => {
    if (step === 2) {
      setStep(1);
    } else {
      router.back();
    }
  };

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

            <Text style={styles.headerTitle}>Report a Problem</Text>

            {step === 2 ? (
              <Pressable onPress={() => setStep(1)} style={styles.headerRightBtn}>
                <Ionicons name="chevron-forward" size={22} color="#111827" />
              </Pressable>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {step === 1 ? (
              /* STEP 1: Select a Category */
              <View style={styles.stepOneContainer}>
                <Text style={styles.categoryHeading}>Select a Category</Text>

                <View style={styles.categoryList}>
                  {CATEGORIES.map((cat) => {
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
              /* STEP 2: Problem Details Form */
              <View style={styles.stepTwoContainer}>
                
                {/* Title */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Title</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter a short title"
                    placeholderTextColor="#9CA3AF"
                    style={styles.textInput}
                  />
                </View>

                {/* Description */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Description</Text>
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

                {/* Upload Evidence */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Upload Evidence</Text>
                  <Pressable
                    style={({ pressed }) => [styles.uploadBox, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.uploadText}>
                      Upload Screenshot/ Upload Screen Recording
                    </Text>
                    <Ionicons name="arrow-up-outline" size={24} color="#111827" style={styles.uploadIcon} />
                  </Pressable>
                </View>

                {/* Transaction ID */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Transaction ID</Text>
                  <TextInput
                    value={transactionId}
                    onChangeText={setTransactionId}
                    placeholder="XXXXXXXXXXX"
                    placeholderTextColor="#9CA3AF"
                    style={styles.textInput}
                  />
                </View>

                {/* Date & Time of Issue */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Date & Time of Issue</Text>
                  <TextInput
                    value={issueDate}
                    onChangeText={setIssueDate}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="#9CA3AF"
                    style={styles.textInput}
                  />
                </View>

                {/* Username/ Profile ID */}
                <View style={styles.inputContainer}>
                  <Text style={styles.floatingLabel}>Username/ Profile ID</Text>
                  <TextInput
                    value={profileId}
                    onChangeText={setProfileId}
                    placeholder="XXXXXXXXXXX"
                    placeholderTextColor="#9CA3AF"
                    style={styles.textInput}
                  />
                </View>

                {/* Submit Report Button */}
                <Pressable
                  onPress={() => router.back()}
                  style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </Pressable>

                {/* Cancel Button */}
                <Pressable
                  onPress={() => setStep(1)}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
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
    backgroundColor: '#FF2A2A',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    shadowColor: '#FF2A2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
