import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../localization/LanguageContext';
import { useTheme } from '../../theme';

export default function SegmentedNotifCallsHeader({
  activeTab = 'calls', // 'notification' | 'calls'
  showBack = false,
  onBack,
  onTabChange,
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { isDarkMode } = useTheme();

  const avatarBg = isDarkMode ? '#111827' : '#FF2E63';
  const avatarInitials = isDarkMode ? 'PS' : 'GB';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const handlePressNotification = () => {
    if (onTabChange) {
      onTabChange('notification');
    } else if (activeTab !== 'notification') {
      router.push('/notification');
    }
  };

  const handlePressCalls = () => {
    if (onTabChange) {
      onTabChange('calls');
    } else if (activeTab !== 'calls') {
      router.push('/call-logs');
    }
  };

  return (
    <View style={styles.headerWrapper}>
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top + 6, 16) }]}>
        <View style={styles.topHeaderRow}>
          <View style={styles.headerLeftGroup}>
            {showBack && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.backButton}
                onPress={handleBack}
              >
                <Ionicons name="chevron-back" size={26} color={isDarkMode ? '#FFFFFF' : '#000000'} />
              </TouchableOpacity>
            )}

            <View style={[styles.tabRowInline, !showBack && { marginLeft: 0 }]}>
              <TouchableOpacity
                style={[
                  styles.tabPill,
                  activeTab === 'notification'
                    ? (isDarkMode ? styles.activeTabPillDark : styles.activeTabPill)
                    : (isDarkMode ? styles.inactiveTabPillDark : styles.inactiveTabPill),
                ]}
                activeOpacity={0.8}
                onPress={handlePressNotification}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    activeTab === 'notification' ? styles.activeTabPillText : styles.inactiveTabPillText,
                  ]}
                >
                  {t('notification', 'Notification')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabPill,
                  activeTab === 'calls'
                    ? (isDarkMode ? styles.activeTabPillDark : styles.activeTabPill)
                    : (isDarkMode ? styles.inactiveTabPillDark : styles.inactiveTabPill),
                ]}
                activeOpacity={0.8}
                onPress={handlePressCalls}
              >
                <Text
                  style={[
                    styles.tabPillText,
                    activeTab === 'calls' ? styles.activeTabPillText : styles.inactiveTabPillText,
                  ]}
                >
                  {t('calls', 'Calls')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[
              styles.profileBadge,
              { backgroundColor: avatarBg },
              isDarkMode && { shadowColor: '#000000' },
            ]}
            onPress={() => router.push('/user-profile')}
          >
            <Text style={styles.profileBadgeText}>{avatarInitials}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginLeft: -6,
    paddingRight: 10,
    paddingVertical: 6,
  },
  tabRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  profileBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FF2E63',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  profileBadgeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    marginRight: 8,
  },
  activeTabPill: {
    backgroundColor: '#FF2E63', // App Pink
  },
  activeTabPillDark: {
    backgroundColor: '#000000', // Black in Dark Mode
  },
  inactiveTabPill: {
    backgroundColor: '#E5E5EA',
  },
  inactiveTabPillDark: {
    backgroundColor: '#E5E5EA',
  },
  tabPillText: {
    fontSize: 14,
  },
  activeTabPillText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inactiveTabPillText: {
    color: '#3A3A3C',
    fontWeight: '600',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#EFEFF4',
  },
});
