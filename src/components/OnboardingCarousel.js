import React, { useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.68);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.46);
const SPACING = 14;
const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;
const AUTO_SWIPE_INTERVAL = 2200; // reduced from 3200 → faster auto-swipe

export const BASE_ONBOARDING_DATA = [
  {
    id: 'matches',
    realIndex: 0,
    image: require('@assets/images/onboarding1.jpg'),
    title: 'Matches',
    description: 'We match you with people that have a\nlarge array of similar interests.',
  },
  {
    id: 'algorithm',
    realIndex: 1,
    image: require('@assets/images/onboarding2.jpg'),
    title: 'Algorithm',
    description: 'Users going through a vetting process to\nensure you never match with bots.',
  },
  {
    id: 'premium',
    realIndex: 2,
    image: require('@assets/images/onboarding3.jpg'),
    title: 'Premium',
    description: 'Sign up today and enjoy the first month\nof premium benefits on us.',
  },
];

export const ONBOARDING_DATA = BASE_ONBOARDING_DATA;

// Duplicate items 7 times for a lightweight infinite loop buffer
const REPEATS = 7;
export const LOOP_DATA = Array.from({ length: REPEATS }).flatMap((_, repeatIndex) =>
  BASE_ONBOARDING_DATA.map((item) => ({
    ...item,
    uniqueKey: `${repeatIndex}-${item.id}`,
  }))
);

// Start initial scroll at middle set index 7 ('Algorithm')
const INITIAL_LOOP_INDEX = 7;

export default function OnboardingCarousel({ scrollX, onSnapToItem }) {
  const flatListRef = useRef(null);
  const currentLoopIndex = useRef(INITIAL_LOOP_INDEX);
  const isUserInteracting = useRef(false);
  const userInteractionTimeout = useRef(null);
  const autoSwipeTimer = useRef(null);

  const startAutoSwipe = () => {
    if (autoSwipeTimer.current) clearInterval(autoSwipeTimer.current);

    autoSwipeTimer.current = setInterval(() => {
      if (isUserInteracting.current) return;

      const nextLoopIndex = currentLoopIndex.current + 1;
      currentLoopIndex.current = nextLoopIndex;

      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: nextLoopIndex * (CARD_WIDTH + SPACING),
          animated: true,
        });
      }

      const realIndex = nextLoopIndex % BASE_ONBOARDING_DATA.length;
      if (onSnapToItem) {
        onSnapToItem(realIndex);
      }
    }, AUTO_SWIPE_INTERVAL);
  };

  // Auto-swipe infinite loop
  useEffect(() => {
    startAutoSwipe();
    return () => {
      if (autoSwipeTimer.current) clearInterval(autoSwipeTimer.current);
    };
  }, [onSnapToItem]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (event) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / (CARD_WIDTH + SPACING));
        if (index >= 0 && index < LOOP_DATA.length) {
          currentLoopIndex.current = index;
          const realIndex = index % BASE_ONBOARDING_DATA.length;
          if (onSnapToItem) {
            onSnapToItem(realIndex);
          }
        }
      },
    }
  );

  const handleScrollBeginDrag = () => {
    isUserInteracting.current = true;
    if (userInteractionTimeout.current) {
      clearTimeout(userInteractionTimeout.current);
    }
  };

  const handleScrollEndDrag = () => {
    userInteractionTimeout.current = setTimeout(() => {
      isUserInteracting.current = false;
      // Restart auto-swipe after user finishes interacting
      startAutoSwipe();
    }, 2000);
  };

  // Reset scroll position silently if user reaches outer boundaries
  const handleMomentumScrollEnd = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + SPACING));

    if (index < BASE_ONBOARDING_DATA.length || index > LOOP_DATA.length - BASE_ONBOARDING_DATA.length) {
      const realIndex = index % BASE_ONBOARDING_DATA.length;
      const middleIndex = BASE_ONBOARDING_DATA.length * 2 + realIndex;
      currentLoopIndex.current = middleIndex;
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({
          offset: middleIndex * (CARD_WIDTH + SPACING),
          animated: false,
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={LOOP_DATA}
        keyExtractor={(item) => item.uniqueKey}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + SPACING}
        // 'normal' gives much smoother momentum with natural swipe-feel
        decelerationRate={0.92}
        snapToAlignment="center"
        bounces={false}
        windowSize={7}
        maxToRenderPerBatch={5}
        initialNumToRender={5}
        removeClippedSubviews={false}
        contentContainerStyle={{
          paddingHorizontal: SIDE_PADDING,
          alignItems: 'center',
        }}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={8}
        initialScrollIndex={INITIAL_LOOP_INDEX}
        getItemLayout={(data, index) => ({
          length: CARD_WIDTH + SPACING,
          offset: (CARD_WIDTH + SPACING) * index,
          index,
        })}
        renderItem={({ item, index }) => {
          const inputRange = [
            (index - 1.5) * (CARD_WIDTH + SPACING),
            index * (CARD_WIDTH + SPACING),
            (index + 1.5) * (CARD_WIDTH + SPACING),
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.82, 1.0, 0.82],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.75, 1, 0.75],
            extrapolate: 'clamp',
          });

          const rotateY = scrollX.interpolate({
            inputRange,
            outputRange: ['-4deg', '0deg', '4deg'],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              style={[
                styles.cardContainer,
                {
                  transform: [{ scale }, { perspective: 800 }, { rotateY }],
                  opacity,
                },
              ]}
            >
              <Image source={item.image} style={styles.cardImage} resizeMode="cover" />
            </Animated.View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CARD_HEIGHT + 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 0,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: SPACING,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
});
