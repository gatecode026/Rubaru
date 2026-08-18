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
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SearchFriendsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleAccessContacts = () => {
    router.push('/enable-notifications');
  };

  const handleSkip = () => {
    router.push('/enable-notifications');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View
          style={[
            styles.mainWrapper,
            {
              paddingTop: Math.max(insets.top + 16, 44),
              paddingBottom: Math.max(insets.bottom + 16, 32),
            },
          ]}
        >
          {/* Header Row with Back Button and Skip Link */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.buttonPressed,
              ]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <Pressable onPress={handleSkip} hitSlop={12}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          </View>

          {/* Upper Spacer */}
          <View style={{ flex: 0.5 }} />

          {/* Hero Glassmorphic Contacts Illustration */}
          <View style={styles.graphicContainer}>
            <View style={styles.graphicWrapper}>
              {/* Back Red / Coral Sphere */}
              <View style={styles.backCircle} />

              {/* Front Frosted Glassmorphic Sphere */}
              <View style={styles.frontGlassCircle}>
                <View style={styles.innerGlassHighlight} />
              </View>

              {/* Lower Floating Disk/Oval for 3D Depth */}
              <View style={styles.bottomDisk} />
            </View>
          </View>

          {/* Upper Spacer */}
          <View style={{ flex: 0.5 }} />

          {/* Center Text Section */}
          <View style={styles.textContainer}>
            <Text style={styles.titleText}>Search friend's</Text>
            <Text style={styles.subtitleText}>
              You can find friends from your contact lists{'\n'}to connected
            </Text>
          </View>

          {/* Flexible Spacer */}
          <View style={{ flex: 1 }} />

          {/* Bottom Primary Action Button */}
          <View style={styles.bottomButtonWrapper}>
            <Pressable
              onPress={handleAccessContacts}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.buttonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Access to a contact list"
            >
              <Text style={styles.actionButtonText}>
                Access to a contact list
              </Text>
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
  mainWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF2E63',
  },
  graphicContainer: {
    alignSelf: 'center',
    marginVertical: 10,
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphicWrapper: {
    width: 200,
    height: 200,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backCircle: {
    position: 'absolute',
    top: 15,
    right: 25,
    width: 105,
    height: 105,
    borderRadius: 52.5,
    backgroundColor: '#F44649',
    shadowColor: '#F44649',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  frontGlassCircle: {
    position: 'absolute',
    top: 30,
    left: 20,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 230, 235, 0.82)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerGlassHighlight: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  bottomDisk: {
    position: 'absolute',
    bottom: 25,
    width: 135,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(244, 70, 73, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    transform: [{ scaleX: 1.1 }],
    shadowColor: '#F44649',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  textContainer: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  bottomButtonWrapper: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
  },
  actionButton: {
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
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
