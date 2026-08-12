import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import OnboardingCarousel, { BASE_ONBOARDING_DATA, ONBOARDING_DATA } from '@components/OnboardingCarousel';
import { colors } from '@theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.68);
const SPACING = 14;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(1);
  const scrollX = useRef(new Animated.Value((CARD_WIDTH + SPACING) * 10)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dataList = BASE_ONBOARDING_DATA || ONBOARDING_DATA || [];
  const currentItem = dataList[activeIndex] || dataList[1] || dataList[0] || {};

  const handleSnapToItem = (newIndex) => {
    if (newIndex !== activeIndex) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setActiveIndex(newIndex);
    }
  };

  const handleCreateAccount = () => {
    router.push('/signup-options');
  };

  const handleSignIn = () => {
    router.push('/sign-in');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* 3-Image Auto-Swiping Infinite Loop Carousel */}
        <View style={styles.carouselWrapper}>
          <OnboardingCarousel
            scrollX={scrollX}
            onSnapToItem={handleSnapToItem}
          />
        </View>

        {/* Text Content & Pagination Footer Area */}
        <View style={[styles.bottomContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
          <Animated.View style={[styles.textWrapper, { opacity: fadeAnim }]}>
            {/* Active Title */}
            <Text style={styles.titleText}>{currentItem.title}</Text>

            {/* Active Description */}
            <Text style={styles.descriptionText}>{currentItem.description}</Text>
          </Animated.View>

          {/* Dynamic 3-Dot Pagination Indicators */}
          <View style={styles.paginationContainer}>
            {BASE_ONBOARDING_DATA.map((_, index) => {
              const isActive = index === activeIndex;
              return (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    isActive ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              );
            })}
          </View>

          {/* Create an Account Button */}
          <Pressable
            onPress={handleCreateAccount}
            style={({ pressed }) => [styles.createButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
          >
            <Text style={styles.createButtonText}>Create an account</Text>
          </Pressable>

          {/* Already have an account? Sign In */}
          <View style={styles.signInRow}>
            <Text style={styles.alreadyText}>Already have an account? </Text>
            <Pressable onPress={handleSignIn} hitSlop={8}>
              <Text style={styles.signInText}>Sign In</Text>
            </Pressable>
          </View>
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
  carouselWrapper: {
    flex: 1,
    justifyContent: 'center',
    zIndex: 1,
  },
  bottomContent: {
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  textWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  descriptionText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 8,
    backgroundColor: '#111111',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#E5E7EB',
  },
  createButton: {
    width: '100%',
    height: 58,
    backgroundColor: '#111827',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  alreadyText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '400',
  },
  signInText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
