import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 28) : 0;

export default function SegmentedNotifCallsHeader({
  activeTab = 'calls', // 'notification' | 'calls'
  onBack,
  onTabChange,
}) {
  const router = useRouter();

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
      <View style={styles.headerContainer}>
        <View style={styles.topHeaderRow}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.backButton}
              onPress={handleBack}
            >
              <Ionicons name="chevron-back" size={26} color="#000000" />
            </TouchableOpacity>

            <View style={styles.tabRowInline}>
              <TouchableOpacity
                style={[
                  styles.tabPill,
                  activeTab === 'notification' ? styles.activeTabPill : styles.inactiveTabPill,
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
                  Notification
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabPill,
                  activeTab === 'calls' ? styles.activeTabPill : styles.inactiveTabPill,
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
                  Calls
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.profileBadge}
            onPress={() => router.push('/user-profile')}
          >
            <Text style={styles.profileBadgeText}>PS</Text>
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
    paddingTop: STATUSBAR_HEIGHT + 6,
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: '#F04452', // Accent coral red
  },
  inactiveTabPill: {
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
