import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  StatusBar,
  Modal,
  Pressable,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ActiveCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const contactName = params.contactName || 'Rahul Kumawat';
  const phoneNumber = params.phoneNumber || '+91 73404 45907';
  const avatarUri = params.avatarUri || 'https://i.pravatar.cc/150?img=11';
  const initialStatus = params.initialStatus || 'calling';
  const initialCallType = params.callType === 'video';

  const [callStatus, setCallStatus] = useState(initialStatus); // 'calling' | 'ringing' | 'connected'
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // In-call toggles
  const [isVideo, setIsVideo] = useState(initialCallType !== false); // Video Call mode active
  const [isSpeaker, setIsSpeaker] = useState(true); // Video calls default to speaker on
  const [isMuted, setIsMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [hasFilter, setHasFilter] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredDigits, setEnteredDigits] = useState('');

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

  const getSubStatusText = () => {
    if (callStatus === 'calling') return 'Calling...';
    if (callStatus === 'ringing') return 'Ringing...';
    if (callStatus === 'connected') return formatDuration(secondsElapsed);
    return 'Calling...';
  };

  const handleShareCall = async () => {
    try {
      await Share.share({
        message: `Join my video call on Rubaru: ${contactName} (${phoneNumber})`,
      });
    } catch (error) {
      // ignore
    }
  };

  const handleDigitPress = (digit) => {
    setEnteredDigits((prev) => prev + digit);
  };

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Main Full-Screen Video Feed / Background */}
      <View style={styles.fullScreenVideoWrapper}>
        {/* Remote Camera Feed Image */}
        <Image
          source={{
            uri: isVideo
              ? 'https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?w=1080'
              : avatarUri,
          }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />

        {/* Subtle dark gradient overlay on top and bottom for readability */}
        <View style={styles.topGradientOverlay} />
        <View style={styles.bottomGradientOverlay} />

        {/* Top Header Section */}
        <View style={styles.topHeader}>
          {/* Left Minimize Chevron */}
          <TouchableOpacity
            style={[styles.headerCircleBtn, { top: Math.max(insets.top + 8, 20) }]}
            activeOpacity={0.7}
            onPress={handleEndCall}
            accessibilityLabel="Minimize call"
          >
            <Ionicons name="chevron-down" size={24} color="#E9EDEF" />
          </TouchableOpacity>

          {/* Center Contact Number & Encrypted Subtitle */}
          <View style={[styles.headerCenter, { paddingTop: Math.max(insets.top + 8, 20) }]}>
            <Text style={styles.contactTitleText} numberOfLines={1}>
              {phoneNumber || contactName}
            </Text>
            <View style={styles.encryptedRow}>
              {callStatus === 'connected' ? (
                <Text style={styles.subStatusText}>{getSubStatusText()}</Text>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={12} color="#CBD5E1" style={{ marginRight: 4 }} />
                  <Text style={styles.subStatusText}>End-to-end encrypted</Text>
                </>
              )}
            </View>
          </View>

          {/* Right Vertical Tool Column (Add Person, Chat, Flip Camera, Magic Filters) */}
          <View style={[styles.rightVerticalTools, { top: Math.max(insets.top + 8, 20) }]}>
            {/* 1. Add Person */}
            <TouchableOpacity
              style={styles.toolCircleBtn}
              activeOpacity={0.7}
              onPress={() => {}}
              accessibilityLabel="Add person"
            >
              <Ionicons name="person-add" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 2. In-Call Chat */}
            <TouchableOpacity
              style={styles.toolCircleBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)')}
              accessibilityLabel="Open chat"
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 3. Flip Camera */}
            <TouchableOpacity
              style={styles.toolCircleBtn}
              activeOpacity={0.7}
              onPress={() => setIsFrontCamera(!isFrontCamera)}
              accessibilityLabel="Flip camera"
            >
              <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 4. Magic Filters / Effects */}
            <TouchableOpacity
              style={[styles.toolCircleBtn, hasFilter && styles.toolBtnActive]}
              activeOpacity={0.7}
              onPress={() => setHasFilter(!hasFilter)}
              accessibilityLabel="Effects and filters"
            >
              <Ionicons
                name={hasFilter ? 'sparkles' : 'color-wand'}
                size={22}
                color={hasFilter ? '#00A884' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Self Camera PiP Floating Thumbnail (Bottom-Right Corner above controls) */}
        {isVideo && (
          <View style={styles.pipThumbnailContainer}>
            <Image
              source={{ uri: 'https://images.pexels.com/photos/1580271/pexels-photo-1580271.jpeg?w=400' }}
              style={styles.pipThumbnailImage}
              resizeMode="cover"
            />
            <View style={styles.pipBorderRing} />
          </View>
        )}

        {/* Voice Call Avatar Fallback (when video is toggled off) */}
        {!isVideo && (
          <View style={styles.centerAvatarContainer}>
            <View style={styles.avatarRingOuter}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.callerDisplayName}>{contactName}</Text>
          </View>
        )}

        {/* WhatsApp Video Call Floating Bottom Control Capsule Bar */}
        <View style={[styles.bottomCapsuleWrapper, { paddingBottom: Math.max(insets.bottom + 12, 28) }]}>
          <View style={styles.capsuleBar}>
            {/* 1. More / Options */}
            <TouchableOpacity
              style={styles.capsuleCircleBtn}
              activeOpacity={0.75}
              onPress={() => setShowMoreModal(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 2. Camera Toggle (Off/On) */}
            <TouchableOpacity
              style={[
                styles.capsuleCircleBtn,
                !isVideo && styles.capsuleBtnDeactivated,
              ]}
              activeOpacity={0.75}
              onPress={() => setIsVideo(!isVideo)}
            >
              <Ionicons
                name={isVideo ? 'videocam' : 'videocam-off'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* 3. Speaker (White Active Circle / Dark Toggle) */}
            <TouchableOpacity
              style={[
                styles.capsuleCircleBtn,
                isSpeaker && styles.capsuleBtnWhiteActive,
              ]}
              activeOpacity={0.75}
              onPress={() => setIsSpeaker(!isSpeaker)}
            >
              <Ionicons
                name={isSpeaker ? 'volume-high' : 'volume-medium-outline'}
                size={22}
                color={isSpeaker ? '#000000' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* 4. Mute Microphone (Mic with slash when muted) */}
            <TouchableOpacity
              style={[
                styles.capsuleCircleBtn,
                isMuted && styles.capsuleBtnMuted,
              ]}
              activeOpacity={0.75}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic-outline'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* 5. Red End Call Button */}
            <TouchableOpacity
              style={styles.capsuleEndBtn}
              activeOpacity={0.85}
              onPress={handleEndCall}
            >
              <Ionicons
                name="call"
                size={24}
                color="#FFFFFF"
                style={{ transform: [{ rotate: '135deg' }] }}
              />
            </TouchableOpacity>
          </View>
        </View>

      </View>

      {/* More Options Sheet */}
      <Modal
        visible={showMoreModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMoreModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoreModal(false)}>
          <Pressable style={styles.moreSheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetGrabHandle} />
            <Text style={styles.sheetTitle}>Video Call Options</Text>

            <TouchableOpacity
              style={styles.sheetOptionRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowMoreModal(false);
                setShowKeypad(true);
              }}
            >
              <View style={styles.sheetOptionIconBox}>
                <Ionicons name="keypad-outline" size={22} color="#E9EDEF" />
              </View>
              <Text style={styles.sheetOptionText}>Keypad / Dialpad</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOptionRow}
              activeOpacity={0.7}
              onPress={() => {
                setShowMoreModal(false);
                handleShareCall();
              }}
            >
              <View style={styles.sheetOptionIconBox}>
                <Ionicons name="share-social-outline" size={22} color="#E9EDEF" />
              </View>
              <Text style={styles.sheetOptionText}>Share Call Invite</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOptionRow}
              activeOpacity={0.7}
              onPress={() => {
                setIsFrontCamera(!isFrontCamera);
                setShowMoreModal(false);
              }}
            >
              <View style={styles.sheetOptionIconBox}>
                <Ionicons name="camera-reverse-outline" size={22} color="#E9EDEF" />
              </View>
              <Text style={styles.sheetOptionText}>Switch to {isFrontCamera ? 'Back' : 'Front'} Camera</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Keypad Modal */}
      <Modal
        visible={showKeypad}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKeypad(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowKeypad(false)}>
          <Pressable style={styles.keypadSheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetGrabHandle} />
            <View style={styles.keypadHeader}>
              <Text style={styles.keypadDigitsText}>{enteredDigits || 'Dial Number'}</Text>
              <TouchableOpacity onPress={() => setShowKeypad(false)} hitSlop={10}>
                <Ionicons name="close-circle" size={26} color="#8696A0" />
              </TouchableOpacity>
            </View>

            {/* 4x3 Grid */}
            <View style={styles.keypadGrid}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['*', '0', '#'],
              ].map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((digit) => (
                    <TouchableOpacity
                      key={digit}
                      style={styles.keypadDigitBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDigitPress(digit)}
                    >
                      <Text style={styles.keypadDigitText}>{digit}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </View>

            {enteredDigits.length > 0 && (
              <TouchableOpacity
                style={styles.clearDigitsBtn}
                onPress={() => setEnteredDigits('')}
              >
                <Text style={styles.clearDigitsText}>Clear</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#0B141B',
  },
  fullScreenVideoWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'space-between',
  },

  /* ── Gradients ── */
  topGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  bottomGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  /* ── Top Header ── */
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  headerCircleBtn: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 35,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  headerCenter: {
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 68,
  },
  contactTitleText: {
    fontSize: 18.5,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  encryptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subStatusText: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ── Right Vertical Tool Column ── */
  rightVerticalTools: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 12,
    zIndex: 35,
  },
  toolCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.70)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(0, 168, 132, 0.35)',
    borderColor: '#00A884',
  },

  /* ── Self Video PiP Thumbnail ── */
  pipThumbnailContainer: {
    position: 'absolute',
    bottom: 120,
    right: 18,
    width: 100,
    height: 145,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 15,
  },
  pipThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  pipBorderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  /* ── Center Avatar fallback ── */
  centerAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  avatarRingOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#1E2B33',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 16,
  },
  avatarImage: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: '#2A3942',
  },
  callerDisplayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  /* ── Floating Capsule Bottom Bar (WhatsApp Video Call) ── */
  bottomCapsuleWrapper: {
    paddingHorizontal: 20,
    zIndex: 20,
  },
  capsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(24, 34, 41, 0.92)',
    borderRadius: 40,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  capsuleCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capsuleBtnWhiteActive: {
    backgroundColor: '#FFFFFF',
  },
  capsuleBtnMuted: {
    backgroundColor: 'rgba(234, 0, 56, 0.35)',
  },
  capsuleBtnDeactivated: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  capsuleEndBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EA0038',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EA0038',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },

  /* ── Modals & Bottom Sheets ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  moreSheetContainer: {
    backgroundColor: '#1E2B33',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 36,
  },
  keypadSheetContainer: {
    backgroundColor: '#1E2B33',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 32,
    paddingTop: 14,
    paddingBottom: 36,
  },
  sheetGrabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8696A0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E9EDEF',
    marginBottom: 16,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3942',
  },
  sheetOptionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2A3942',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E9EDEF',
  },
  keypadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A3942',
  },
  keypadDigitsText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E9EDEF',
    letterSpacing: 2,
  },
  keypadGrid: {
    gap: 14,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  keypadDigitBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#2A3942',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadDigitText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#E9EDEF',
  },
  clearDigitsBtn: {
    alignSelf: 'center',
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  clearDigitsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00A884',
  },
});
