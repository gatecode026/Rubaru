import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@theme';

export const TAB_ITEMS = [
  {
    key: 'index',
    label: 'Home',
    iconType: 'feather',
    iconName: 'home',
  },
  {
    key: 'connection',
    label: 'Connection',
    iconType: 'feather',
    iconName: 'activity',
  },
  {
    key: 'reels',
    label: 'Reels',
    iconType: 'material',
    iconName: 'movie-play-outline',
  },
  {
    key: 'notification',
    label: 'Notification',
    iconType: 'feather',
    iconName: 'bell',
  },
  {
    key: 'groups',
    label: 'Groups',
    iconType: 'feather',
    iconName: 'users',
  },
];

export default function CustomTabBar({ activeTab = 'index', onTabPress }) {
  const insets = useSafeAreaInsets();

  const renderIcon = (item, isSelected) => {
    const iconColor = isSelected ? colors.tabActive : colors.tabInactive;
    const iconSize = 22;

    if (item.iconType === 'feather') {
      return <Feather name={item.iconName} size={iconSize} color={iconColor} />;
    }
    if (item.iconType === 'material') {
      return <MaterialCommunityIcons name={item.iconName} size={iconSize} color={iconColor} />;
    }
    return <Ionicons name={item.iconName} size={iconSize} color={iconColor} />;
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.content}>
        {TAB_ITEMS.map((item) => {
          const isSelected = activeTab === item.key || (activeTab === 'index' && item.key === 'index');
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
                {renderIcon(item, isSelected)}
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
    backgroundColor: colors.tabBarBg,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
    paddingTop: 8,
    width: '100%',
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
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.tabLabelActive,
    fontWeight: '600',
  },
  tabLabelInactive: {
    color: colors.tabLabelInactive,
  },
  pressed: {
    opacity: 0.6,
  },
});
