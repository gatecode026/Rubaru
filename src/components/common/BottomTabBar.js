import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

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

  const getIsActive = (itemKey, activeName) => {
    if (!activeName) return false;
    const normalizedActive = String(activeName).toLowerCase();
    const normalizedItem = itemKey.toLowerCase();
    if (normalizedItem === 'index' && normalizedActive === 'home') return true;
    if (normalizedItem === 'home' && normalizedActive === 'index') return true;
    return normalizedActive === normalizedItem;
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.content}>
        {TAB_ITEMS.map((item) => {
          const isSelected = getIsActive(item.key, activeTab);
          const iconColor = isSelected ? '#F04452' : '#000000';
          const iconName = isSelected ? item.activeIcon : item.inactiveIcon;

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
              accessibilityLabel={item.label}
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
                  isSelected ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
                numberOfLines={1}
              >
                {item.label}
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
    color: '#F04452',
    fontWeight: '600',
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
