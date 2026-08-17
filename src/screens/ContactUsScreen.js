import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Image,
  TextInput,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ContactUsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleBack = () => {
    router.push('/help-support');
  };

  useEffect(() => {
    const onBackPress = () => {
      router.push('/help-support');
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
              paddingTop: Math.max(insets.top + 12, 40),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Contact Us</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Hero Text */}
            <View style={styles.heroContainer}>
              <Text style={styles.heroTitle}>Need Help?</Text>
              <Text style={styles.heroDescription}>
                We’re here to assist you. Reach out to our support team for any questions, technical issues, or account-related concerns.
              </Text>
            </View>

            {/* Card 1: Customer Support */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardLeft}>
                <Text style={styles.infoCardTitle}>Customer Support</Text>
                
                <View style={styles.infoRow}>
                  <Ionicons name="mail-outline" size={16} color="#3B82F6" style={styles.infoIcon} />
                  <Text style={styles.infoText}>support@rubaru.com</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="call-outline" size={16} color="#3B82F6" style={styles.infoIcon} />
                  <Text style={styles.infoText}>+91 XXXXX XXXXX</Text>
                </View>
              </View>

              <Image
                source={require('@assets/images/contact_support_illustration.png')}
                style={styles.cardIllustration}
                resizeMode="contain"
              />
            </View>

            {/* Card 2: Support Hours */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardLeft}>
                <Text style={styles.infoCardTitle}>Support Hours</Text>
                
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={16} color="#3B82F6" style={styles.infoIcon} />
                  <Text style={styles.infoText}>Monday - Friday</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={16} color="#3B82F6" style={styles.infoIcon} />
                  <Text style={styles.infoText}>9:00 AM - 6:00 PM</Text>
                </View>
              </View>

              <Image
                source={require('@assets/images/contact_support_illustration.png')}
                style={styles.cardIllustration}
                resizeMode="contain"
              />
            </View>

            {/* Send Us a Message Section */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>Send Us a Message</Text>

              {/* Full Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.floatingLabel}>Full Name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter Your name"
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
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.textInput}
                />
              </View>

              {/* Subject */}
              <View style={styles.inputContainer}>
                <Text style={styles.floatingLabel}>Subject</Text>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Enter a short title"
                  placeholderTextColor="#9CA3AF"
                  style={styles.textInput}
                />
              </View>

              {/* Message */}
              <View style={styles.inputContainer}>
                <Text style={styles.floatingLabel}>Message</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Tell us what happened in detail."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  style={[styles.textInput, styles.textAreaInput]}
                />
              </View>

              {/* Attach Screenshot - Dashed Upload Box */}
              <View style={styles.uploadSectionContainer}>
                <Text style={styles.uploadSectionLabel}>Attach Screenshot</Text>
                <Pressable
                  style={({ pressed }) => [styles.uploadDashedBox, pressed && styles.buttonPressed]}
                >
                  <Ionicons name="cloud-upload" size={38} color="#64748B" />
                  <Text style={styles.uploadPrimaryText}>Upload a photo</Text>
                  <Text style={styles.uploadSecondaryText}>Drag and drop files here</Text>
                </Pressable>
              </View>

              {/* Bottom Submit Button */}
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [styles.submitButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.submitButtonText}>Submit Request</Text>
              </Pressable>

            </View>

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.7)',
  },
  infoCardLeft: {
    flex: 1,
    paddingRight: 10,
  },
  infoCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
  },
  cardIllustration: {
    width: 90,
    height: 68,
    borderRadius: 10,
  },
  formSection: {
    marginTop: 16,
  },
  formSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
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
  uploadSectionContainer: {
    marginBottom: 16,
  },
  uploadSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  uploadDashedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  uploadSecondaryText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 3,
  },
  submitButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
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
