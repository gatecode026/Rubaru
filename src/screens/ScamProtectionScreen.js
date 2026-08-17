import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Image,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ScamProtectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back to help and support"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Scam Protection Center</Text>
            
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Seamless Dual Warning Badge Image (SCAM & FRAUD) */}
            <View style={styles.badgeImageWrapper}>
              <Image
                source={require('@assets/images/scam_fraud_badge.jpg')}
                style={styles.badgeImage}
                resizeMode="contain"
              />
            </View>

            {/* Protect Yourself Hero Section */}
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Protect Yourself on Rubaru</Text>
              <Text style={styles.heroSubtitle}>
                Learn how to identify fake profiles, avoid scams, and enjoy safe conversations.
              </Text>

              {/* Action Buttons */}
              <Pressable style={({ pressed }) => [styles.reportButton, pressed && styles.buttonPressed]}>
                <Text style={styles.reportButtonText}>Report a Scam</Text>
              </Pressable>

              <Pressable style={({ pressed }) => [styles.viewReportsButton, pressed && styles.buttonPressed]}>
                <Text style={styles.viewReportsButtonText}>View Your Reports</Text>
              </Pressable>
            </View>

            {/* Stay Safe Section Header */}
            <View style={styles.staySafeHeader}>
              <Text style={styles.staySafeTitle}>Stay Safe</Text>
              <Text style={styles.staySafeSubtitle}>Ways to protect yourself and others.</Text>
            </View>

            {/* Safety Cards List */}
            <View style={styles.cardsContainer}>
              
              {/* Card 1: Verify Before You Trust */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Verify Before You Trust</Text>
                <Text style={styles.cardBody}>
                  Only interact with verified profiles. Be cautious of users who avoid profile verification.
                </Text>
              </View>

              {/* Card 2: Never Send Money */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Never Send Money</Text>
                <Text style={styles.cardBody}>
                  Never transfer money, gift cards, or cryptocurrency to anyone you meet on Rubaru outside the app.
                </Text>
              </View>

              {/* Card 3: Use Coins Only */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Use Coins Only</Text>
                <Text style={styles.cardBody}>
                  All voice and video calls should be made using Rubaru Coins inside the app. Do not make payments through personal UPI, bank transfer, or other payment apps.
                </Text>
              </View>

              {/* Card 4: Spot Fake Profiles */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Spot Fake Profiles</Text>
                <Text style={styles.cardSubheading}>Be cautious if someone:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• Asks for money.</Text>
                  <Text style={styles.bulletItem}>• Tries to move the conversation to another app immediately.</Text>
                  <Text style={styles.bulletItem}>• Refuses voice or video calls.</Text>
                  <Text style={styles.bulletItem}>• Uses stolen or unrealistic photos.</Text>
                  <Text style={styles.bulletItem}>• Makes emotional stories to gain sympathy.</Text>
                </View>
              </View>

              {/* Card 5: Stay Inside Rubaru */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Stay Inside Rubaru</Text>
                <Text style={styles.cardBody}>
                  For your safety, keep chats and calls within the Rubaru app whenever possible.
                </Text>
              </View>

              {/* Card 6: Report Suspicious Users */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Report Suspicious Users</Text>
                <Text style={styles.cardSubheading}>Report users who:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• Request money</Text>
                  <Text style={styles.bulletItem}>• Harass or threaten you</Text>
                  <Text style={styles.bulletItem}>• Share inappropriate content</Text>
                  <Text style={styles.bulletItem}>• Impersonate someone else</Text>
                  <Text style={styles.bulletItem}>• Violate community guidelines</Text>
                </View>
              </View>

              {/* Card 7: Protect Your Privacy */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Protect Your Privacy</Text>
                <Text style={styles.cardSubheading}>Never share:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• OTPs</Text>
                  <Text style={styles.bulletItem}>• Bank details</Text>
                  <Text style={styles.bulletItem}>• Aadhaar/PAN information</Text>
                  <Text style={styles.bulletItem}>• Passwords</Text>
                  <Text style={styles.bulletItem}>• Credit/Debit card details</Text>
                  <Text style={styles.bulletItem}>• Personal documents</Text>
                </View>
              </View>

              {/* Card 8: Safe Meeting Tips */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Safe Meeting Tips</Text>
                <Text style={styles.cardSubheading}>If you decide to meet someone:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• Meet in a public place.</Text>
                  <Text style={styles.bulletItem}>• Tell a friend or family member.</Text>
                  <Text style={styles.bulletItem}>• Arrange your own transportation.</Text>
                  <Text style={styles.bulletItem}>• Leave immediately if you feel uncomfortable.</Text>
                </View>
              </View>

              {/* Card 9: Community Guidelines */}
              <View style={styles.cardBox}>
                <Text style={styles.cardTitle}>Community Guidelines</Text>
                <Text style={styles.cardBody}>
                  Respect others and help keep Rubaru a safe and welcoming community.
                </Text>
              </View>

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
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: 8,
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
  badgeImageWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  badgeImage: {
    width: SCREEN_WIDTH - 48,
    height: 180,
  },
  heroSection: {
    alignItems: 'center',
    marginVertical: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  reportButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#FF2A55',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#FF2A55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewReportsButton: {
    width: '100%',
    height: 48,
    backgroundColor: '#E5E7EB',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewReportsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  staySafeHeader: {
    marginTop: 20,
    marginBottom: 14,
  },
  staySafeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  staySafeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  cardsContainer: {
    gap: 12,
  },
  cardBox: {
    backgroundColor: '#FFF0F3',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 226, 226, 0.6)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },
  cardSubheading: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  bulletList: {
    gap: 3,
    paddingLeft: 4,
  },
  bulletItem: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
