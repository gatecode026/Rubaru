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

export default function EnableNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleEnableNotifications = () => {
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          
          {/* Header Row with Back Button and Skip Link */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
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

          {/* Hero Glassmorphic Chat Bubble Graphic */}
          <View style={styles.graphicContainer}>
            <View style={styles.chatBubblesWrapper}>
              {/* Back Red Chat Bubble */}
              <View style={styles.backChatBubble} />
              
              {/* Front Glassmorphic Chat Bubble */}
              <View style={styles.frontChatBubble}>
                <View style={[styles.chatLine, { width: '70%' }]} />
                <View style={[styles.chatLine, { width: '45%', marginTop: 8 }]} />
              </View>
            </View>
          </View>

          {/* Upper Spacer */}
          <View style={{ flex: 0.5 }} />

          {/* Center Text Section */}
          <View style={styles.textContainer}>
            <Text style={styles.titleText}>Enable notification's</Text>
            <Text style={styles.subtitleText}>
              Get push-notification when you get the match{'\n'}or receive a message.
            </Text>
          </View>

          {/* Flexible Spacer */}
          <View style={{ flex: 1 }} />

          {/* Bottom Primary Action Button */}
          <View style={styles.bottomButtonWrapper}>
            <Pressable
              onPress={handleEnableNotifications}
              style={({ pressed }) => [styles.notifyButton, pressed && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="I want to be notified"
            >
              <Text style={styles.notifyButtonText}>I want to be notified</Text>
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
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBubblesWrapper: {
    width: 190,
    height: 160,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backChatBubble: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 140,
    height: 110,
    borderRadius: 28,
    backgroundColor: '#F44649',
    shadowColor: '#F44649',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  frontChatBubble: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 145,
    height: 110,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 235, 238, 0.92)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  chatLine: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F44649',
    opacity: 0.45,
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
  notifyButton: {
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
  notifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
