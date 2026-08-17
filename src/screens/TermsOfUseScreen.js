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

export default function TermsOfUseScreen() {
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
            <Text style={styles.headerTitle}>Terms of Use</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.lastUpdated}>Last Updated: 05/11/2026</Text>
            
            <Text style={styles.paragraph}>
              Please read these Terms of Use ("Terms", "Terms of Use") carefully before using the Rubaru mobile application.
              {'\n\n'}
              Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms. By using the app, you agree to be bound by these Terms.
            </Text>

            <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
            <Text style={styles.paragraph}>
              By accessing or using the Service, you agree to comply with and be bound by these Terms of Use. If you do not agree, you must not access or use the Service.
              {'\n\n'}
              We reserve the right to modify these Terms at any time, and your continued use of the app constitutes acceptance of the revised Terms.
            </Text>

            <Text style={styles.sectionTitle}>2. Eligibility</Text>
            <Text style={styles.paragraph}>
              By creating an account on the app, you represent and warrant that:
              {'\n'}• You are at least 18 years of age.
              {'\n'}• You can form a binding contract with us.
              {'\n'}• You will comply with these Terms and all applicable laws.
              {'\n'}• You have never been convicted of a felony or any sexual crime.
            </Text>

            <Text style={styles.sectionTitle}>3. Accounts & Security</Text>
            <Text style={styles.paragraph}>
              To use the app, you must register and create a profile. You are responsible for:
              {'\n'}• Keeping your account password confidential.
              {'\n'}• All activities that occur under your account.
              {'\n'}• Providing accurate, complete and truthful information.
              {'\n\n'}
              We reserve the right to terminate accounts that violate security or provide false information.
            </Text>

            <Text style={styles.sectionTitle}>4. User-Generated Content</Text>
            <Text style={styles.paragraph}>
              You are solely responsible for the content (photos, messages, voice notes) you post or transmit on the app.
              {'\n\n'}
              You agree not to post content that:
              {'\n'}• Is illegal, offensive, harmful or threatening.
              {'\n'}• Promotes hate speech, discrimination or violence.
              {'\n'}• Infringes on any intellectual property or privacy rights.
              {'\n'}• Contains explicit nudity, pornography or sexual abuse material.
              {'\n'}• Impersonates any person or entity.
              {'\n\n'}
              We reserve the right to review, edit or delete any content that violates these Terms.
            </Text>

            <Text style={styles.sectionTitle}>5. Prohibited Activities</Text>
            <Text style={styles.paragraph}>
              You agree not to engage in any of the following activities:
              {'\n'}• Harassing, stalking or abusing other users.
              {'\n'}• Using the app for commercial purposes, sales or advertising.
              {'\n'}• Creating multiple accounts or fake profiles.
              {'\n'}• Using automated scripts or bots to interact with the app.
              {'\n'}• Attempting to hack, disrupt or compromise our server security.
              {'\n'}• Sharing other users' private contact details without consent.
            </Text>

            <Text style={styles.sectionTitle}>6. Voice & Video Calls</Text>
            <Text style={styles.paragraph}>
              Our Service provides voice and video calling features to connect you with other users.
              {'\n\n'}
              You agree to use these features respectfully and in accordance with these Terms.
              {'\n\n'}
              Recording or publishing calls without the explicit consent of the other participant is strictly prohibited.
              {'\n\n'}
              We do not monitor your private calls, but we may investigate reports of abuse or harassment.
            </Text>

            <Text style={styles.sectionTitle}>7. Points & Payments</Text>
            
            <Text style={styles.subTitle}>Points:</Text>
            <Text style={styles.paragraph}>
              • Points are non-refundable and have no cash value.
              {'\n'}• We reserve the right to change points prices and package options at any time.
              {'\n'}• Unused points will expire if your account is inactive for more than 2 years.
            </Text>

            <Text style={styles.subTitle}>Payments:</Text>
            <Text style={styles.paragraph}>
              • All transactions are securely processed via App Store or Google Play billing.
              {'\n'}• We do not store your credit card or payment credentials on our servers.
            </Text>

            <Text style={styles.sectionTitle}>8. Community Standards</Text>
            <Text style={styles.paragraph}>
              We strive to maintain a friendly, safe and respectful community. You agree to comply with our Community Standards, which include:
              {'\n'}• Respecting other users' boundaries.
              {'\n'}• Reporting any abusive behavior or scam profiles immediately.
              {'\n'}• Not using the app to solicit money or financial assistance.
              {'\n\n'}
              We take a zero-tolerance approach to scams, fraud, and financial exploitation.
            </Text>

            <Text style={styles.sectionTitle}>9. Termination</Text>
            <Text style={styles.paragraph}>
              We reserve the right to suspend or terminate your account and access to the app at any time, without prior notice, if you violate these Terms or engage in conduct that we deem harmful to the community.
              {'\n\n'}
              Upon termination:
              {'\n'}• Your right to use the app will immediately cease.
              {'\n'}• Any unused points packages will be forfeited and will not be refunded.
            </Text>

            <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
            <Text style={styles.paragraph}>
              To the maximum extent permitted by law, the app and its creators shall not be liable for any indirect, incidental, special or consequential damages arising out of or in connection with your use of the app, including:
              {'\n'}• Personal injury or distress resulting from interactions with other users.
              {'\n'}• Loss of data, points or transaction history.
              {'\n'}• Unauthorised access to your account or data transmissions.
            </Text>

            <Text style={styles.sectionTitle}>11. Governing Law</Text>
            <Text style={styles.paragraph}>
              These Terms of Use and any disputes arising out of your use of the app shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law principles.
            </Text>

            <Text style={styles.sectionTitle}>12. Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions or concerns about these Terms of Use, please contact us:
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
