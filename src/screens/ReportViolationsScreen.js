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

export default function ReportViolationsScreen() {
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
              paddingTop: Math.max(insets.top + 12, 40),
              paddingBottom: Math.max(insets.bottom + 16, 24),
            },
          ]}
        >
          {/* Top Header Row with Back Button */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back to help and support"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Help & Support</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Section 1: Reports */}
            <Pressable
              onPress={() => router.push('/reports')}
              style={({ pressed }) => [styles.sectionBlock, pressed && styles.buttonPressed]}
            >
              <View style={styles.titleRow}>
                <Ionicons name="settings-outline" size={22} color="#111827" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Reports</Text>
              </View>
              <Text style={styles.sectionDescription}>
                These are reports thtat you’ve submitted.
              </Text>
            </Pressable>

            {/* Section 2: Safety Notices */}
            <Pressable
              onPress={() => router.push('/safety-notices')}
              style={({ pressed }) => [styles.sectionBlock, pressed && styles.buttonPressed]}
            >
              <View style={styles.titleRow}>
                <Ionicons name="settings-outline" size={22} color="#111827" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Safety Notices</Text>
              </View>
              <Text style={styles.sectionDescription}>
                Find resources to help you recover from a difficult experience.
              </Text>
            </Pressable>

            {/* Section 3: Violations */}
            <Pressable
              onPress={() => router.push('/violations')}
              style={({ pressed }) => [styles.sectionBlock, pressed && styles.buttonPressed]}
            >
              <View style={styles.titleRow}>
                <Ionicons name="settings-outline" size={22} color="#111827" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Violations</Text>
              </View>
              <Text style={styles.sectionDescription}>
                This is content that you’ve shared that goes against our guidelines.
              </Text>
            </Pressable>

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
    marginBottom: 20,
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
    paddingBottom: 32,
  },
  sectionBlock: {
    marginBottom: 28,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    paddingLeft: 32,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
