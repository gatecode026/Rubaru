import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import BottomTabBar from '../components/common/BottomTabBar';

export default function ActiveCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const contactName = params.contactName || 'Rahul Kumawat';
  const avatarUri = params.avatarUri || 'https://i.pravatar.cc/150?img=11';
  const initialStatus = params.initialStatus || 'calling';

  const [callStatus, setCallStatus] = useState(initialStatus); // 'calling' | 'ringing' | 'connected'
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const timerRef = useRef(null);

  useEffect(() => {
    if (initialStatus === 'connected') {
      setCallStatus('connected');
    } else {
      const t1 = setTimeout(() => {
        setCallStatus('ringing');
      }, 2000);

      const t2 = setTimeout(() => {
        setCallStatus('connected');
      }, 4500);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [initialStatus]);

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const formattedMins = String(mins).padStart(2, '0');
    const formattedSecs = String(secs).padStart(2, '0');
    return `${formattedMins}:${formattedSecs}`;
  };

  const handleEndCall = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/call-logs');
    }
  };

  const getStatusText = () => {
    if (callStatus === 'calling') return 'Calling';
    if (callStatus === 'ringing') return 'Ringing';
    if (callStatus === 'connected') return formatDuration(secondsElapsed);
    return 'Calling';
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFF5F5" />

      <LinearGradient
        colors={['#FFF5F5', '#FFEBF0', '#FFD9E0']}
        style={styles.gradientContainer}
      >
        {/* Scattered low opacity watermark hearts */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Ionicons
            name="heart"
            size={48}
            color="#FFC9D4"
            style={[styles.heart, { top: 30, left: 10, transform: [{ rotate: '-15deg' }], opacity: 0.2 }]}
          />
          <Ionicons
            name="heart"
            size={24}
            color="#FFC9D4"
            style={[styles.heart, { top: 80, left: 24, transform: [{ rotate: '20deg' }], opacity: 0.15 }]}
          />
          <Ionicons
            name="heart"
            size={36}
            color="#FFC9D4"
            style={[styles.heart, { top: 50, right: 20, transform: [{ rotate: '10deg' }], opacity: 0.2 }]}
          />
          <Ionicons
            name="heart"
            size={20}
            color="#FFC9D4"
            style={[styles.heart, { top: 120, right: 35, transform: [{ rotate: '-25deg' }], opacity: 0.12 }]}
          />
        </View>

        {/* Centered Top Content */}
        <View style={styles.topContent}>
          <Text style={styles.contactName}>{contactName}</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          <View style={styles.avatarWrapper}>
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          </View>
        </View>

        {/* Bottom Hang Up Area */}
        <View style={styles.bottomCallControls}>
          <TouchableOpacity
            style={styles.endCallButton}
            activeOpacity={0.85}
            onPress={handleEndCall}
          >
            <Ionicons
              name="call"
              size={30}
              color="#FFFFFF"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </TouchableOpacity>
        </View>

        <BottomTabBar
          activeTab="Notification"
          onTabPress={(tabKey) => {
            router.push(tabKey === 'index' ? '/(tabs)' : `/(tabs)/${tabKey}`);
          }}
        />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFF5F5',
  },
  gradientContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'space-between',
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  heart: {
    position: 'absolute',
  },
  topContent: {
    alignItems: 'center',
    paddingTop: 60,
  },
  contactName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 40,
    textAlign: 'center',
  },
  avatarWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarImage: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#E5E5EA',
  },
  bottomCallControls: {
    alignItems: 'center',
    marginBottom: 100,
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
