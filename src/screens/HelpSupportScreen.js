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

const HELP_ITEMS = [
  { id: 'customer-support', title: 'Customer Support', icon: 'settings-outline' },
  { id: 'report-problem', title: 'Report a Problem', icon: 'time-outline' },
  { id: 'report-violations', title: 'Report and Violations', icon: 'people-outline' },
  { id: 'privacy-security', title: 'Privacy and Security Help', icon: 'shield-checkmark-outline' },
  { id: 'scam-protection', title: 'Scam Protection Center', icon: 'shield-outline' },
  { id: 'contact-us', title: 'Contact Us', icon: 'headset-outline' },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
              onPress={() => router.push('/user-profile?openSettings=true')}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back to sidebar"
            >
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Help & Support</Text>

            {/* Placeholder view for equal flex balancing */}
            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {HELP_ITEMS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.id === 'scam-protection') {
                    router.push('/scam-protection');
                  } else if (item.id === 'report-violations') {
                    router.push('/report-violations');
                  } else if (item.id === 'contact-us') {
                    router.push('/contact-us');
                  } else if (item.id === 'report-a-problem' || item.id === 'report-problem') {
                    router.push('/report-problem');
                  } else if (item.id === 'privacy-security-help' || item.id === 'privacy-security') {
                    router.push('/privacy-security-help');
                  } else if (item.id === 'customer-support' || item.id === 'customer-support-flow') {
                    router.push('/customer-support-flow');
                  } else if (item.id === 'feedback') {
                    router.push('/feedback');
                  } else if (item.id === 'faqs') {
                    router.push('/faqs');
                  }
                }}
                style={({ pressed }) => [styles.itemRow, pressed && styles.buttonPressed]}
              >
                <View style={styles.itemLeftContent}>
                  <Ionicons name={item.icon} size={22} color="#111827" style={styles.itemIcon} />
                  <Text style={styles.itemTitle}>{item.title}</Text>
                </View>
              </Pressable>
            ))}
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
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(229, 231, 235, 0.5)',
  },
  itemLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemIcon: {
    marginRight: 14,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
});
