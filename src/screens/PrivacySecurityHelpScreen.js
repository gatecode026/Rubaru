import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySecurityHelpScreen() {
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

            <Text style={styles.headerTitle}>Privacy & Security</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Section 1: Your Safety Matters */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Your Safety Matters</Text>
              <Text style={styles.sectionBody}>
                Rubaru is committed to protecting your privacy and providing a secure environment for meaningful conversations.
              </Text>
            </View>

            {/* Section 2: Keep Your Account Secure */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Keep Your Account Secure</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Use a strong password.</Text>
                <Text style={styles.bulletItem}>• Never share your password or OTP with anyone.</Text>
                <Text style={styles.bulletItem}>• Log out from shared or public devices.</Text>
                <Text style={styles.bulletItem}>• Keep your account information up to date.</Text>
              </View>
            </View>

            {/* Section 3: Manage Your Privacy */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Manage Your Privacy</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Control who can view your profile.</Text>
                <Text style={styles.bulletItem}>• Choose who can send you messages.</Text>
                <Text style={styles.bulletItem}>• Manage your online status visibility.</Text>
                <Text style={styles.bulletItem}>• Update your privacy preferences anytime from Settings.</Text>
              </View>
            </View>

            {/* Section 4: Block & Report Users */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Block & Report Users</Text>
              <Text style={styles.subLabel}>If someone makes you uncomfortable:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Block the user to stop all communication.</Text>
                <Text style={styles.bulletItem}>• Report fake, abusive, or suspicious profiles.</Text>
                <Text style={styles.bulletItem}>• Our team reviews reports promptly.</Text>
              </View>
            </View>

            {/* Section 5: Wallet & Payment Security */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Wallet & Payment Security</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Purchase coins only through official payment methods within Rubaru.</Text>
                <Text style={styles.bulletItem}>• Never send money directly to another user.</Text>
                <Text style={styles.bulletItem}>• Review your transaction history regularly.</Text>
                <Text style={styles.bulletItem}>• Report any unauthorized transactions immediately.</Text>
              </View>
            </View>

            {/* Section 6: Protect Your Personal Information */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Protect Your Personal Information</Text>
              <Text style={styles.subLabel}>Never share:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• OTPs</Text>
                <Text style={styles.bulletItem}>• Passwords</Text>
                <Text style={styles.bulletItem}>• Bank account details</Text>
                <Text style={styles.bulletItem}>• Credit/Debit card information</Text>
                <Text style={styles.bulletItem}>• Aadhaar, PAN, Passport, or other ID documents</Text>
                <Text style={styles.bulletItem}>• Home address or confidential personal information</Text>
              </View>
            </View>

            {/* Section 7: Safe Calls & Chats */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Safe Calls & Chats</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Use Rubaru’s built-in chat and calling features.</Text>
                <Text style={styles.bulletItem}>• Be cautious if someone asks you to move to another messaging app immediately.</Text>
                <Text style={styles.bulletItem}>• End conversations that make you feel unsafe.</Text>
              </View>
            </View>

            {/* Section 8: Recognize Scams */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Recognize Scams</Text>
              <Text style={styles.subLabel}>Watch out for users who:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Ask for money or gifts.</Text>
                <Text style={styles.bulletItem}>• Promise investment or lottery returns.</Text>
                <Text style={styles.bulletItem}>• Pretend to be someone else.</Text>
                <Text style={styles.bulletItem}>• Create emotional pressure to gain trust.</Text>
                <Text style={styles.bulletItem}>• Request payments outside Rubaru.</Text>
              </View>
            </View>

            {/* Section 9: Need Help? */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>Need Help?</Text>
              <Text style={styles.subLabel}>If you believe your account has been compromised or you notice suspicious activity:</Text>
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• Contact Customer Support</Text>
                <Text style={styles.bulletItem}>• Report the issue immediately</Text>
                <Text style={styles.bulletItem}>• Change your password if needed</Text>
              </View>
            </View>

            {/* Report a Problem Button */}
            <Pressable
              onPress={() => router.push('/report-problem')}
              style={({ pressed }) => [styles.reportButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.reportButtonText}>Report a Problem</Text>
            </Pressable>

            {/* Footer Text */}
            <Text style={styles.footerText}>
              Your privacy is your responsibility too. Never share sensitive information with people you have just met online, and always report suspicious activity through the app.
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
  reportButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#111827',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  reportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
    textAlign: 'left',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
