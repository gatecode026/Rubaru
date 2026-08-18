import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  ScrollView,
  BackHandler,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../localization/LanguageContext';
import { useTheme } from '../theme';

const PERMISSION_ITEMS = [
  {
    id: 'location',
    title: 'Location Access',
    icon: 'location-outline',
    description:
      'To discover people near you, show nearby connections on the map, and provide location-based recommendations.',
  },
  {
    id: 'camera',
    title: 'Camera Access',
    icon: 'camera-outline',
    description:
      'To take profile photos, capture images, create reels, and use the camera during live features.',
  },
  {
    id: 'microphone',
    title: 'Microphone Access',
    icon: 'mic-outline',
    description:
      'To enable audio during voice and video calls and for reel recording features.',
  },
  {
    id: 'photos_media',
    title: 'Photos & Media Access',
    icon: 'images-outline',
    description:
      'To upload profile pictures, images, reels, and other media to your profile or posts.',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: 'notifications-outline',
    description:
      'To notify you about new messages, calls, connection requests, and important updates.',
  },
  {
    id: 'contacts',
    title: 'Contacts Access',
    icon: 'people-outline',
    description:
      'To help you discover and connect with friends from your address book.',
  },
];

export default function PermissionGrantScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const [permissionStates, setPermissionStates] = useState({
    location: true,
    camera: true,
    microphone: true,
    photos_media: true,
    notifications: true,
    contacts: false,
  });

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

  const togglePermission = (id) => {
    setPermissionStates((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleAllowAll = () => {
    setPermissionStates({
      location: true,
      camera: true,
      microphone: true,
      photos_media: true,
      notifications: true,
      contacts: true,
    });
  };

  const handleDenyAll = () => {
    setPermissionStates({
      location: false,
      camera: false,
      microphone: false,
      photos_media: false,
      notifications: false,
      contacts: false,
    });
  };

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
              paddingBottom: Math.max(insets.bottom, 6),
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
              <Ionicons name="chevron-back" size={22} color="#111827" />
            </Pressable>

            <Text style={styles.headerTitle}>Permission Grant</Text>

            <View style={{ width: 40 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Toggle Card Container matching the APK design */}
            <View style={styles.toggleCard}>
              {PERMISSION_ITEMS.map((item, index) => {
                const isEnabled = !!permissionStates[item.id];
                const isLast = index === PERMISSION_ITEMS.length - 1;

                return (
                  <View key={item.id}>
                    <Pressable
                      onPress={() => togglePermission(item.id)}
                      style={({ pressed }) => [
                        styles.toggleRow,
                        pressed && { backgroundColor: 'rgba(0, 0, 0, 0.02)' },
                      ]}
                    >
                      {/* Left Icon Badge */}
                      <View
                        style={[
                          styles.iconBadge,
                          {
                            backgroundColor: isEnabled
                              ? isDarkMode
                                ? 'rgba(0, 0, 0, 0.08)'
                                : 'rgba(255, 46, 99, 0.1)'
                              : 'rgba(156, 163, 175, 0.12)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={isEnabled ? (isDarkMode ? '#000000' : '#FF2E63') : '#6B7280'}
                        />
                      </View>

                      {/* Middle Text Info */}
                      <View style={styles.textContainer}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        <Text style={styles.itemDescription} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>

                      {/* Right Switch */}
                      <Switch
                        value={isEnabled}
                        onValueChange={() => togglePermission(item.id)}
                        trackColor={{ false: '#D1D5DB', true: isDarkMode ? '#000000' : '#FF2E63' }}
                        thumbColor="#FFFFFF"
                        style={styles.switchControl}
                      />
                    </Pressable>

                    {/* Divider */}
                    {!isLast && <View style={styles.rowDivider} />}
                  </View>
                );
              })}
            </View>

            {/* Permission Control Info Box */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeaderRow}>
                <Ionicons name="shield-checkmark-outline" size={18} color={isDarkMode ? '#000000' : '#FF2E63'} style={{ marginRight: 6 }} />
                <Text style={styles.infoTitle}>Permission Control</Text>
              </View>
              <Text style={styles.infoBodyText}>
                You can change or revoke permissions at any time through your device's settings. Some features may not work if required permissions are disabled.
              </Text>
            </View>

            {/* Action Buttons: Allow All & Continue */}
            <View style={styles.buttonRow}>
              <Pressable
                onPress={handleAllowAll}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.buttonPressed]}
              >
                <Text style={styles.secondaryBtnText}>Allow All</Text>
              </Pressable>

              <Pressable
                onPress={handleDenyAll}
                style={({ pressed }) => [styles.secondaryBtn, pressed && styles.buttonPressed]}
              >
                <Text style={styles.secondaryBtnText}>Deny All</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [
                styles.continueBtn,
                isDarkMode && styles.continueBtnDark,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.continueBtnText}>Save & Continue</Text>
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
    paddingHorizontal: 18,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: 10,
  },
  introText: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
    fontWeight: '400',
  },
  toggleCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 18,
    paddingVertical: 4,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 11.5,
    color: '#6B7280',
    lineHeight: 15,
  },
  switchControl: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginLeft: 64,
    marginRight: 14,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  infoBodyText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  secondaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  continueBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FF2E63',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  continueBtnDark: {
    backgroundColor: '#000000',
    shadowColor: '#000000',
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
