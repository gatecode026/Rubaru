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

export default function CommunityStandardsScreen() {
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
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Community Standards</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Section 1: Welcome to Rubaru */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Welcome to Rubaru</Text>
              <Text style={styles.sectionBody}>
                Our goal is to create a safe, respectful, and enjoyable community for everyone. Please follow these standards whenever you use Rubaru.
              </Text>
            </View>

            {/* Section 2: Respect Everyone */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Respect Everyone</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Treat all users with kindness and respect.</Text>
                <Text style={styles.bulletItem}>• Do not bully, insult, threaten, or harass anyone.</Text>
                <Text style={styles.bulletItem}>• Respect personal boundaries and consent.</Text>
              </View>
            </View>

            {/* Section 3: Be Authentic */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Be Authentic</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Use your own photos and accurate profile information.</Text>
                <Text style={styles.bulletItem}>• Do not impersonate another person or create fake accounts.</Text>
                <Text style={styles.bulletItem}>• Complete profile verification when available.</Text>
              </View>
            </View>

            {/* Section 4: Keep Conversations Respectful */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Keep Conversations Respectful</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Avoid abusive, hateful, or offensive language.</Text>
                <Text style={styles.bulletItem}>• Do not send repeated unwanted messages (spam).</Text>
                <Text style={styles.bulletItem}>• Respect another user's decision if they don't want to continue chatting.</Text>
              </View>
            </View>

            {/* Section 5: No Scams or Fraud */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>No Scams or Fraud</Text>
              <Text style={styles.subLabel}>You must not:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Ask users for money or financial assistance.</Text>
                <Text style={styles.bulletItem}>• Request OTPs, passwords, or banking information.</Text>
                <Text style={styles.bulletItem}>• Promote investment, crypto, or lottery schemes.</Text>
                <Text style={styles.bulletItem}>• Direct users to make payments outside Rubaru.</Text>
              </View>
            </View>

            {/* Section 6: Safe Calls & Payments */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Safe Calls & Payments</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Use Rubaru Coins only for voice and video calls.</Text>
                <Text style={styles.bulletItem}>• Never request payments through UPI, bank transfer, or third-party payment apps.</Text>
                <Text style={styles.bulletItem}>• Report anyone asking for money outside the app.</Text>
              </View>
            </View>

            {/* Section 7: Inappropriate Content */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Inappropriate Content</Text>
              <Text style={styles.subLabel}>Do not share:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Nudity or sexually explicit content.</Text>
                <Text style={styles.bulletItem}>• Violent or disturbing images.</Text>
                <Text style={styles.bulletItem}>• Illegal or harmful content.</Text>
                <Text style={styles.bulletItem}>• Content involving minors.</Text>
                <Text style={styles.bulletItem}>• Copyrighted content without permission.</Text>
              </View>
            </View>

            {/* Section 8: Protect Your Privacy */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Protect Your Privacy</Text>
              <Text style={styles.subLabel}>Never share:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• OTPs</Text>
                <Text style={styles.bulletItem}>• Passwords</Text>
                <Text style={styles.bulletItem}>• Bank account details</Text>
                <Text style={styles.bulletItem}>• Aadhaar, PAN, Passport, or other ID documents</Text>
                <Text style={styles.bulletItem}>• Credit or debit card information</Text>
              </View>
            </View>

            {/* Section 9: Report Violations */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Report Violations</Text>
              <Text style={styles.sectionBody}>
                If you notice fake profiles, scams, harassment, or inappropriate behavior, use the Report feature immediately. Our moderation team reviews all reports.
              </Text>
            </View>

            {/* Section 10: Consequences */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Consequences</Text>
              <Text style={styles.subLabel}>Violating these standards may result in:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Warning</Text>
                <Text style={styles.bulletItem}>• Temporary account restrictions</Text>
                <Text style={styles.bulletItem}>• Permanent account suspension</Text>
                <Text style={styles.bulletItem}>• Removal of content</Text>
                <Text style={styles.bulletItem}>• Loss of account access</Text>
              </View>
            </View>

            {/* Footer Text */}
            <Text style={styles.footerText}>
              Together, we can make Rubaru a safe, trusted, and welcoming place for meaningful conversations. ❤️
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
    paddingHorizontal: 24,
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
  sectionBox: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.6)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 4,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },
  bulletList: {
    gap: 4,
    paddingLeft: 2,
  },
  bulletItem: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    textAlign: 'left',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
