import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  Image,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

const features = [
  {
    emoji: '💬',
    title: 'Chat Freely',
    description: 'Start conversations with people you are interested in and enjoy real-time messaging.',
  },
  {
    emoji: '📞',
    title: 'Audio & Video Calls',
    description: 'Take your conversations further with audio and video calling. Calls may use My Dating App coins according to the applicable calling rates.',
  },
  {
    emoji: '👤',
    title: 'Discover People',
    description: 'Explore profiles, search for potential partners, and discover people based on your interests and preferences.',
  },
  {
    emoji: '📍',
    title: 'Find People Nearby',
    description: 'Use the connection map to discover people around your location when location access is enabled.',
  },
  {
    emoji: '❤️',
    title: 'Follow & Connect',
    description: 'Follow people you like, build connections, and stay updated with their activities.',
  },
  {
    emoji: '👥',
    title: 'Reels & Videos',
    description: 'Watch, discover, and share short-form videos and reels with the My Dating App community.',
  },
  {
    emoji: '🌄',
    title: 'Share Images',
    description: 'Upload and share your moments through images and visual content.',
  },
  {
    emoji: '👥',
    title: 'Join Communities',
    description: 'Create your own groups or join groups that match your interests and interact with other members.',
  },
  {
    emoji: '🔔',
    title: 'Stay Updated',
    description: 'Receive notifications about messages, connections, followers, groups, calls, and other important activities.',
  },
];

export default function AboutUsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleBack = () => {
    router.push('/user-profile?openSettings=true');
  };

  useEffect(() => {
    const onBackPress = () => {
      router.push('/user-profile?openSettings=true');
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
              paddingTop: Math.max(insets.top + 10, 36),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {/* Top Header Row */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>About Us</Text>

            <View style={{ width: 44 }} />
          </View>

          {/* Scrollable Content - Pure Seamless Layout Without Border Boxes */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Section 1: Welcome to My Dating App */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Welcome to My Dating App</Text>
              <Text style={styles.paragraphText}>
                My Dating App is a modern social connection and dating platform designed to help people discover, connect, communicate, and build meaningful relationships in a comfortable digital environment.
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 14 }]}>
                Whether you are looking to meet someone new, chat with interesting people, share your moments, or become part of a community, My Dating App brings social discovery and connection together in one place.
              </Text>
            </View>

            {/* Section 2: Connect. Chat. Share. Discover. */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Connect. Chat. Share. Discover.</Text>
              <Text style={[styles.paragraphText, { marginBottom: 14 }]}>
                My Dating App gives you multiple ways to interact with people:
              </Text>

              {/* Feature Items List */}
              {features.map((item, index) => (
                <View key={index} style={styles.featureItem}>
                  <Text style={styles.featureTitleLine}>
                    {item.emoji} <Text style={styles.featureTitleBold}>{item.title}</Text>
                  </Text>
                  <Text style={styles.featureDescriptionText}>{item.description}</Text>
                </View>
              ))}
            </View>

            {/* Vision & Mission Banner Image */}
            <View style={styles.bannerContainer}>
              <Image
                source={require('@assets/images/vision_mission.jpg')}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </View>

            {/* Section 3: Our Mission */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Our Mission</Text>
              <Text style={styles.paragraphText}>
                Our mission is to create a platform where people can connect naturally, communicate openly, and discover meaningful relationships.
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 12 }]}>
                We believe that meeting new people should be simple, engaging, and enjoyable. My Dating App combines dating, social interaction, content sharing, and community features to create a complete social experience.
              </Text>
            </View>

            {/* Section 4: Built for Real Connections */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Built for Real Connections</Text>
              <Text style={styles.paragraphText}>
                My Dating App is more than just a dating application. It brings together:
              </Text>
              <Text style={styles.bulletHighlightText}>
                Dating + Social Networking + Chat + Content Sharing + Communities
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 8 }]}>
                This allows users to discover people, start conversations, share experiences, and participate in communities—all from one platform.
              </Text>
            </View>

            {/* Section 5: Your Safety Matters */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Your Safety Matters</Text>
              <Text style={styles.paragraphText}>
                We want My Dating App to remain a respectful and welcoming environment.
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 10 }]}>
                We provide features such as block, report, privacy controls, and account management to help users control their experience.
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 10 }]}>
                We encourage every member to communicate respectfully, protect their personal information, and report suspicious or inappropriate behavior.
              </Text>
            </View>

            {/* Section 6: Join the My Dating App Community */}
            <View style={[styles.sectionBlock, { marginBottom: 12 }]}>
              <Text style={styles.sectionHeading}>Join the My Dating App Community</Text>
              <Text style={styles.paragraphText}>
                Whether you are here to meet someone special, make new connections, share your creativity, or simply discover interesting people, My Dating App gives you a place to connect and express yourself.
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 10 }]}>
                Connect with people. Share your world. Find your My Dating App.
              </Text>
              <Text style={[styles.paragraphText, { marginTop: 6, fontWeight: '600', color: '#111827' }]}>
                My Dating App — Where Connections Begin.
              </Text>
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
  },
  topHeaderRow: {
    width: '100%',
    paddingHorizontal: 20,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sectionBlock: {
    marginBottom: 26,
  },
  sectionHeading: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
    fontWeight: '400',
  },
  featureItem: {
    marginBottom: 14,
  },
  featureTitleLine: {
    fontSize: 14.5,
    marginBottom: 3,
  },
  featureTitleBold: {
    fontWeight: '700',
    color: '#111827',
  },
  featureDescriptionText: {
    fontSize: 13.5,
    lineHeight: 20,
    color: '#4B5563',
    paddingLeft: 2,
  },
  bannerContainer: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bulletHighlightText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
    marginVertical: 6,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
