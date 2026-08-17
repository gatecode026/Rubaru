import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>
            <Text style={styles.headerTitle}>Privacy Policy</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.lastUpdated}>Last Updated: 11/04/2026</Text>
            
            <Text style={styles.paragraph}>
              The security of your personal information is important to us. This Privacy Policy explains how we collect, use, share and protect your personal information when you use our mobile application.
              {'\n\n'}
              By using the app, you agree to the collection and use of information in accordance with this policy.
            </Text>

            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={styles.paragraph}>
              When you register or use the app, we may collect the following details:
            </Text>
            
            <Text style={styles.subTitle}>Personal Information:</Text>
            <Text style={styles.paragraph}>
              • Name and username{'\n'}
              • Email address and phone number{'\n'}
              • Date of birth{'\n'}
              • Gender{'\n'}
              • Profile photo{'\n'}
              • Chats, voice and video files{'\n'}
              • Device location and IP address
            </Text>

            <Text style={styles.subTitle}>Device & Technical Information:</Text>
            <Text style={styles.paragraph}>
              We may collect information about the device you are using, including:{'\n'}
              • Device model{'\n'}
              • OS version{'\n'}
              • Unique device ID{'\n'}
              • Mobile network information{'\n'}
              • App performance and crash logs{'\n'}
              • Battery level and network status
            </Text>

            <Text style={styles.subTitle}>Sensors Information:</Text>
            <Text style={styles.paragraph}>
              With your permission, we may access the following sensors to enhance your experience:{'\n'}
              • Audio levels from mic{'\n'}
              • Camera for media capture{'\n'}
              • Location sensor for search{'\n'}
              • Steps count/sensor
            </Text>
            <Text style={[styles.paragraph, { fontStyle: 'italic', marginTop: 10, color: '#374151' }]}>
              "You control whether to share this information via your device settings."
            </Text>

            <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
            <Text style={styles.paragraph}>
              We use your information to:{'\n'}
              • Create and manage your account{'\n'}
              • Provide connection services on the app{'\n'}
              • Deliver voice and video calling features{'\n'}
              • Recommend connections near you based on location{'\n'}
              • Prevent fraud and ensure security{'\n'}
              • Send you updates, alerts and promotional notifications{'\n'}
              • Fix technical issues and improve app performance{'\n'}
              • Understand how users interact with our features{'\n'}
              • Personalize your in-app experience{'\n'}
              • Support search and match suggestions
            </Text>

            <Text style={styles.sectionTitle}>3. Shared Access & Contacts</Text>
            <Text style={styles.paragraph}>
              With your permission, we may access your contacts lists to help you find friends already on the app.{'\n\n'}
              We do not store your contacts lists on our servers permanently; they are only processed temporarily to check for matches.{'\n\n'}
              We do not send messages or invitations to your contacts without your explicit action.{'\n\n'}
              The app does not share your contact list details with any third parties or advertisers.
            </Text>

            <Text style={styles.sectionTitle}>4. Calls & Payments</Text>
            <Text style={styles.paragraph}>
              Voice and video calls on the app are routed through secure, encrypted servers.{'\n\n'}
              When you purchase points packages, payment transactions are processed securely through App Store/Google Play in-app purchases.{'\n\n'}
              We do not store your credit card or billing details on our servers; transaction histories are managed by your app store account.
            </Text>

            <Text style={styles.sectionTitle}>5. Data Security & Retention</Text>
            <Text style={styles.paragraph}>
              We employ industry-standard security measures to protect your personal information.{'\n\n'}
              Your data is stored securely on servers located in India and other secure facilities.{'\n\n'}
              We will retain your personal information only for as long as your account is active or as needed to provide you with app services.{'\n\n'}
              We will delete your data if you request to delete your account or if you remain inactive for more than 2 years.
            </Text>

            <Text style={styles.sectionTitle}>6. Deletion of Personal Data</Text>
            <Text style={styles.paragraph}>
              You can request the deletion of your personal data at any time through the app settings.{'\n\n'}
              If you delete your account:{'\n'}
              • Your profile and personal details will be permanently removed.{'\n'}
              • All chats, voice/video files on our servers will be deleted.{'\n'}
              • Any unused points packages will be deactivated.{'\n'}
              • Your username will become available for new users.{'\n\n'}
              Please note that some transaction histories may be retained as required by law.
            </Text>

            <Text style={styles.sectionTitle}>7. Changes to this Privacy Policy</Text>
            <Text style={styles.paragraph}>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.{'\n\n'}
              We will also notify you via email or in-app notification before the changes become effective.{'\n\n'}
              You are advised to review this Privacy Policy periodically for any changes.
            </Text>

            <Text style={styles.sectionTitle}>8. Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions or suggestions about this Privacy Policy, please contact us:
              {'\n\n'}
              <Text style={{ fontWeight: '600' }}>By email:</Text> support@gatecode026.com{'\n'}
              <Text style={{ fontWeight: '600' }}>By website:</Text> www.gatecode026.com{'\n'}
              <Text style={{ fontWeight: '600' }}>By address:</Text> [Insert support address]
            </Text>
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
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  scrollContent: {
    paddingBottom: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  lastUpdated: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
  },
});
