import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@theme';

export default function ChatHeader({ onBackPress, onProfilePress, title = 'Chats', userInitials = 'PS' }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBackPress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>

        <Pressable
          onPress={onProfilePress}
          style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}
          accessibilityLabel="User profile"
          accessibilityRole="button"
        >
          <Text style={styles.profileText}>{userInitials}</Text>
        </Pressable>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.titleText}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.avatarBg,
    justifyContent: 'center',
    alignItems: 'center',
    // subtle shadow for definition
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  profileText: {
    color: colors.avatarText,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  titleRow: {
    marginTop: 12,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});
