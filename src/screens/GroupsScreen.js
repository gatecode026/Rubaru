import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '../theme';
import BottomTabBar from '../components/common/BottomTabBar';

export default function GroupsScreen({ isNestedInPager }) {
  const router = useRouter();
  const { isDarkMode } = useTheme();

  return (
    <View style={[styles.safeContainer, isDarkMode && styles.safeContainerDark]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#121212' : '#FFF0F3'}
      />

      <LinearGradient
        colors={isDarkMode ? ['#18181B', '#121212', '#09090B'] : ['#FFF0F3', '#FFE3E8', '#FFFFFF']}
        style={styles.gradientBackground}
      >
        <View style={styles.centerContainer}>
          <Text style={[styles.comingSoonText, isDarkMode && styles.comingSoonTextDark]}>
            Coming Soon
          </Text>
        </View>
      </LinearGradient>

      {!isNestedInPager && (
        <BottomTabBar
          activeTab="Groups"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
  },
  safeContainerDark: {
    backgroundColor: '#121212',
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  comingSoonText: {
    fontSize: 26,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  comingSoonTextDark: {
    color: '#F9FAFB',
  },
});
