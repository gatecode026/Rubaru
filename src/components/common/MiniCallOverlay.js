import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallStore } from '../../store/callStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

function formatDuration(seconds = 0) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function MiniCallOverlay() {
  const router = useRouter();
  const {
    callId,
    callStatus,
    callType,
    peerId,
    peerName,
    peerAvatar,
    isInitiator,
    ratePerMinute,
    durationSeconds,
    isAudioMuted,
    isCallMinimized,
    setMinimized,
    toggleAudio,
    hangupCall,
    tickDuration,
  } = useCallStore();

  const isOngoing = ['ACTIVE', 'CONNECTED', 'CONNECTING', 'RINGING', 'INITIATING', 'RECONNECTING'].includes(callStatus);
  const shouldShow = isOngoing && isCallMinimized;

  // Active duration ticker
  useEffect(() => {
    let interval = null;
    if (callStatus === 'ACTIVE') {
      interval = setInterval(() => {
        tickDuration();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callStatus, tickDuration]);

  // Draggable position
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 210, y: Platform.OS === 'ios' ? 60 : 40 })).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for green status dot
  useEffect(() => {
    if (!shouldShow) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shouldShow, pulseAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  if (!shouldShow) return null;

  const handleExpandToFullScreen = () => {
    setMinimized(false);
    router.push({
      pathname: '/active-call',
      params: {
        contactName: peerName || 'User',
        avatarUri: peerAvatar || '',
        callType: callType || 'audio',
        receiverId: peerId || '',
        callSessionId: callId || '',
        isPaid: 'true',
        isInitiator: isInitiator ? 'true' : 'false',
        ratePerMinute: String(ratePerMinute || 5),
        initialStatus: callStatus.toLowerCase(),
      },
    });
  };

  const handleEnd = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    hangupCall('USER_HUNG_UP');
    useCallStore.getState().resetToIdle();
  };

  const handleToggleMute = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    toggleAudio();
  };

  const isVideo = callType === 'video';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleExpandToFullScreen}
        style={styles.cardTouchArea}
      >
        {/* Left: Avatar / Status indicator */}
        <View style={styles.avatarWrapper}>
          {peerAvatar ? (
            <Image source={{ uri: peerAvatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {peerName ? peerName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          <Animated.View
            style={[
              styles.statusDot,
              callStatus === 'ACTIVE' ? styles.statusDotActive : styles.statusDotPending,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
        </View>

        {/* Center: Info */}
        <View style={styles.infoWrapper}>
          <Text style={styles.peerNameText} numberOfLines={1}>
            {peerName || 'User'}
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={11}
              color={callStatus === 'ACTIVE' ? '#10B981' : '#F59E0B'}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.timerText, callStatus === 'ACTIVE' && styles.timerTextActive]}>
              {callStatus === 'ACTIVE'
                ? formatDuration(durationSeconds)
                : callStatus === 'RINGING'
                ? 'Ringing...'
                : 'Connecting...'}
            </Text>
          </View>
        </View>

        {/* Right: Quick Action Buttons */}
        <View style={styles.actionsWrapper}>
          <TouchableOpacity
            style={[styles.smallActionBtn, isAudioMuted && styles.mutedBtn]}
            activeOpacity={0.7}
            onPress={handleToggleMute}
          >
            <Ionicons
              name={isAudioMuted ? 'mic-off' : 'mic'}
              size={14}
              color={isAudioMuted ? '#EF4444' : '#FFFFFF'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.smallEndBtn}
            activeOpacity={0.7}
            onPress={handleEnd}
          >
            <Ionicons name="call" size={13} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 999999,
    elevation: 999,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
  cardTouchArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 195,
    maxWidth: 220,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
  },
  avatarPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotPending: {
    backgroundColor: '#F59E0B',
  },
  infoWrapper: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
  },
  peerNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  timerText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  timerTextActive: {
    color: '#10B981',
    fontWeight: '600',
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  smallActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  smallEndBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
