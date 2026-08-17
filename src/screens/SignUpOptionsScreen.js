import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Updated layout with eliminated empty middle gap and lowered elements
export default function SignUpOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinueWithEmail = () => {
    router.push('/email-verification');
  };

  const handleUsePhoneNumber = () => {
    router.push('/phone-verification');
  };

  const handleSocialSignUp = (provider) => {
    // Action for social signup (Facebook, Google, Apple)
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Main Content Container with Lowered Top Clearance */}
        <View style={[styles.contentContainer, { paddingTop: Math.max(insets.top + 96, 128), paddingBottom: Math.max(insets.bottom + 12, 28) }]}>

          {/* Top App Branding Logo & Title */}
          <View style={styles.brandingWrapper}>
            <Text style={styles.appNameText}>
              My Dating App<Text style={styles.heartSymbol}>♡</Text>
            </Text>
          </View>

          {/* Central Form Block */}
          <View style={styles.formBlock}>
            {/* Subtitle */}
            <Text style={styles.subtitleText}>Sign up to continue</Text>

            {/* Action Buttons Section */}
            <View style={styles.buttonsSection}>
              {/* Continue with email button */}
              <Pressable
                onPress={handleContinueWithEmail}
                style={({ pressed }) => [styles.emailButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Continue with email"
              >
                <Text style={styles.emailButtonText}>Continue with email</Text>
              </Pressable>

              {/* Use phone number button */}
              <Pressable
                onPress={handleUsePhoneNumber}
                style={({ pressed }) => [styles.phoneButton, pressed && styles.buttonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Use phone number"
              >
                <Text style={styles.phoneButtonText}>Use phone number</Text>
              </Pressable>
            </View>

            {/* Divider with Text */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Sign Up Card Buttons Row */}
            <View style={styles.socialRow}>
              {/* Facebook Card - Black filled square icon with white 'f' */}
              <Pressable
                onPress={() => handleSocialSignUp('facebook')}
                style={({ pressed }) => [styles.socialCard, pressed && styles.cardPressed]}
                accessibilityLabel="Sign up with Facebook"
              >
                <View style={styles.facebookIconBox}>
                  <FontAwesome name="facebook" size={22} color="#FFFFFF" />
                </View>
              </Pressable>

              {/* Google Card - Solid black Google icon */}
              <Pressable
                onPress={() => handleSocialSignUp('google')}
                style={({ pressed }) => [styles.socialCard, pressed && styles.cardPressed]}
                accessibilityLabel="Sign up with Google"
              >
                <FontAwesome name="google" size={30} color="#000000" />
              </Pressable>

              {/* Apple Card - Solid black Apple icon */}
              <Pressable
                onPress={() => handleSocialSignUp('apple')}
                style={({ pressed }) => [styles.socialCard, pressed && styles.cardPressed]}
                accessibilityLabel="Sign up with Apple"
              >
                <Ionicons name="logo-apple" size={32} color="#000000" />
              </Pressable>
            </View>
          </View>

          {/* Terms & Privacy Policy Footer - Positioned naturally below social cards without empty gap */}
          <View style={styles.footerRow}>
            <Pressable hitSlop={8} onPress={() => router.push('/terms-of-use')}>
              <Text style={styles.footerLinkText}>Terms of use</Text>
            </Pressable>
            <View style={styles.footerSpacer} />
            <Pressable hitSlop={8} onPress={() => router.push('/privacy-policy')}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
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
  contentContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    zIndex: 1,
  },
  brandingWrapper: {
    marginBottom: 72,
    alignItems: 'center',
  },
  appNameText: {
    fontFamily: 'Jaro_400Regular',
    fontSize: 38,
    color: '#F44649',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heartSymbol: {
    fontFamily: 'Jaro_400Regular',
    fontSize: 38,
    color: '#F44649',
    fontWeight: '300',
  },
  formBlock: {
    width: '100%',
    maxWidth: 337,
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonsSection: {
    width: '100%',
    marginBottom: 36,
  },
  emailButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#111827',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  emailButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  phoneButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  phoneButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 38,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 12,
    fontWeight: '400',
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
  },
  socialCard: {
    width: 68,
    height: 68,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(243, 244, 246, 0.9)',
  },
  facebookIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 72,
    marginBottom: 8,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  footerSpacer: {
    width: 40,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
});
