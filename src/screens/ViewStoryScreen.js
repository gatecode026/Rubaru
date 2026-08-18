import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
  StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORY_DURATION = 5000; // 5 seconds per story frame

const USER_STORIES = {
  "Karan": [
    { id: 'k1', type: 'image', uri: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080', text: 'Chasing sunsets in the mountains 🏔️🌅' },
    { id: 'k2', type: 'image', uri: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1080', text: 'Roadtrip vibes only! 🚗💨' }
  ],
  "Sneha": [
    { id: 's1', type: 'image', uri: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=1080', text: 'Sunday brunch layout ☕🥞✨' },
    { id: 's2', type: 'image', uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1080', text: 'Eating healthy never tasted so good!' }
  ],
  "Amit": [
    { id: 'a1', type: 'image', uri: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080', text: 'Mist rolling over the forest hills 🌲 Mist is love.' }
  ],
  "Riya": [
    { id: 'r1', type: 'image', uri: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=1080', text: 'Coding late at night with lo-fi beats 💻🎧' },
    { id: 'r2', type: 'image', uri: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080', text: 'Workspace upgrades complete! 🔥' }
  ]
};

export default function ViewStoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const userName = params.name || 'Friend';
  const userAvatar = params.imageUrl || 'https://i.pravatar.cc/150?img=33';

  // Get user stories
  const stories = USER_STORIES[userName] || [
    { id: 'f1', type: 'image', uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1080', text: 'Feeling good today! ✨' },
    { id: 'f2', type: 'image', uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1080', text: 'Coffee runs are my therapy ☕' }
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [liked, setLiked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Animated values for progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef(null);
  const startTime = useRef(0);
  const elapsedBeforePause = useRef(0);

  const activeStory = stories[currentIdx];

  useEffect(() => {
    // Reset index on mount
    setCurrentIdx(0);
  }, [userName]);

  useEffect(() => {
    // Trigger animation when current index changes
    progressAnim.setValue(0);
    elapsedBeforePause.current = 0;
    if (!isPaused) {
      startStoryTimer(STORY_DURATION);
    }
    return () => {
      if (animationRef.current) animationRef.current.stop();
    };
  }, [currentIdx]);

  const startStoryTimer = (duration) => {
    startTime.current = Date.now();
    animationRef.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    });

    animationRef.current.start(({ finished }) => {
      if (finished) {
        handleNextStory();
      }
    });
  };

  const handleNextStory = () => {
    if (currentIdx < stories.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      // End of stories for this user, return back
      router.back();
    }
  };

  const handlePrevStory = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    } else {
      // Restart current first story
      progressAnim.setValue(0);
      elapsedBeforePause.current = 0;
      if (animationRef.current) animationRef.current.stop();
      startStoryTimer(STORY_DURATION);
    }
  };

  // Pause story on touch hold
  const handlePressIn = () => {
    setIsPaused(true);
    if (animationRef.current) {
      animationRef.current.stop();
    }
    // Record elapsed time
    const timePassed = Date.now() - startTime.current;
    elapsedBeforePause.current = elapsedBeforePause.current + timePassed;
  };

  // Resume story on release
  const handlePressOut = () => {
    setIsPaused(false);
    const remainingTime = STORY_DURATION - elapsedBeforePause.current;
    if (remainingTime > 0) {
      startStoryTimer(remainingTime);
    } else {
      handleNextStory();
    }
  };

  const handleScreenTap = (event) => {
    const touchX = event.nativeEvent.locationX;
    const thirdOfScreen = SCREEN_WIDTH / 3;

    if (touchX < thirdOfScreen) {
      // Tap left: previous story
      handlePrevStory();
    } else {
      // Tap right: next story
      handleNextStory();
    }
  };

  const handleSendReply = () => {
    if (replyText.trim() === '') return;
    Alert.alert('Sent', `Reply sent to ${userName}! 🩷`);
    setReplyText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar hidden />

      {/* Main Full-Screen Media View */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleScreenTap}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.mediaContainer}
      >
        <Image source={{ uri: activeStory.uri }} style={styles.storyImage} />

        {/* Text Overlay Card */}
        {activeStory.text && (
          <View style={styles.textOverlayContainer}>
            <Text style={styles.textOverlay}>{activeStory.text}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Top Overlay Controls */}
      <View style={[styles.topControlsContainer, { top: insets.top + 10 }]}>
        {/* Progress Bars Indicator Segment */}
        <View style={styles.progressRow}>
          {stories.map((item, idx) => {
            let widthInterpolation;
            if (idx < currentIdx) {
              widthInterpolation = '100%';
            } else if (idx === currentIdx) {
              widthInterpolation = progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              });
            } else {
              widthInterpolation = '0%';
            }

            return (
              <View key={item.id} style={styles.progressTrack}>
                <Animated.View style={[styles.progressBar, { width: widthInterpolation }]} />
              </View>
            );
          })}
        </View>

        {/* User Profile Header details */}
        <View style={styles.headerInfo}>
          <View style={styles.userProfile}>
            <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
            <View style={styles.usernameWrapper}>
              <Text style={styles.usernameText}>{userName}</Text>
              <Text style={styles.timeText}>2h ago</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Reply Control Panel */}
      <View style={[styles.bottomControlPanel, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.replyRow}>
          <TextInput
            style={styles.replyInput}
            placeholder={`Reply to ${userName}...`}
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={replyText}
            onChangeText={setReplyText}
            onSubmitEditing={handleSendReply}
          />

          <TouchableOpacity 
            style={[styles.actionIconButton, liked && styles.likedButton]} 
            onPress={() => setLiked(!liked)}
          >
            <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? "#FF3B30" : "#FFFFFF"} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionIconButton} onPress={handleSendReply}>
            <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  mediaContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  textOverlayContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  textOverlay: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  topControlsContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 10,
  },
  progressRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 6,
    gap: 4,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  usernameWrapper: {
    justifyContent: 'center',
  },
  usernameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    padding: 6,
  },
  bottomControlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 10,
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    color: '#FFFFFF',
    fontSize: 14,
  },
  actionIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  likedButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});
