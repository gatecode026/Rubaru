import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { useLanguage } from '../../localization/LanguageContext';

const reelIcon = require('../../assets/icons/solar_reel.png');

// Custom component for the Reels icon using the PNG asset with tintColor
function ReelIcon({ color }) {
  return (
    <Image
      source={reelIcon}
      style={[styles.reelIcon, { tintColor: color }]}
      resizeMode="contain"
    />
  );
}

export const TAB_ITEMS = [
  {
    key: 'index',
    label: 'Home',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },
  {
    key: 'connection',
    label: 'Connection',
    activeIcon: 'pulse',
    inactiveIcon: 'pulse-outline',
  },
  {
    key: 'reels',
    label: 'Reels',
    activeIcon: null,
    inactiveIcon: null,
  },
  {
    key: 'notification',
    label: 'Notification',
    activeIcon: 'notifications',
    inactiveIcon: 'notifications-outline',
  },
  {
    key: 'groups',
    label: 'Groups',
    activeIcon: 'people',
    inactiveIcon: 'people-outline',
  },
];

export default function BottomTabBar({ activeTab = 'index', onTabPress }) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const { t } = useLanguage();

  const getIsActive = (itemKey, activeName) => {
    if (!activeName) return false;
    const normalizedActive = String(activeName).toLowerCase();
    const normalizedItem = itemKey.toLowerCase();
    if (normalizedItem === 'index' && normalizedActive === 'home') return true;
    if (normalizedItem === 'home' && normalizedActive === 'index') return true;
    return normalizedActive === normalizedItem;
  };

  const getTabLabel = (key, fallback) => {
    if (key === 'index') return t('tabHome', 'Home');
    if (key === 'connection') return t('tabConnection', 'Connection');
    if (key === 'reels') return t('tabReels', 'Reels');
    if (key === 'notification') return t('tabNotification', 'Notification');
    if (key === 'groups') return t('tabGroups', 'Groups');
    return fallback;
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.tabBarBg || (isDarkMode ? '#18181B' : '#FFFFFF'),
          borderTopColor: colors.tabBarBorder || (isDarkMode ? '#27272A' : '#EFEFF4'),
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.content}>
        {TAB_ITEMS.map((item) => {
          const isSelected = getIsActive(item.key, activeTab);
          const iconColor = isSelected ? '#FF2E63' : (isDarkMode ? '#9CA3AF' : '#000000');
          const iconName = isSelected ? item.activeIcon : item.inactiveIcon;
          const displayLabel = getTabLabel(item.key, item.label);

          return (
            <Pressable
              key={item.key}
              onPress={() => onTabPress && onTabPress(item.key)}
              style={({ pressed }) => [
                styles.tabButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={displayLabel}
            >
              <View style={styles.iconContainer}>
                {item.key === 'reels' ? (
                  <ReelIcon color={iconColor} />
                ) : (
                  <Ionicons name={iconName} size={24} color={iconColor} />
                )}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isSelected
                    ? [styles.tabLabelActive, { color: '#FF2E63' }]
                    : [styles.tabLabelInactive, { color: isDarkMode ? '#9CA3AF' : '#000000' }],
                ]}
                numberOfLines={1}
              >
                {displayLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EFEFF4',
    paddingTop: 8,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#FF2E63',
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: '#000000',
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.6,
  },
  reelIcon: {
    width: 24,
    height: 24,
  },
});
