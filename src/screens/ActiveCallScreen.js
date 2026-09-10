import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Modal,
  Pressable,
  Share,
  AppState,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallController } from '../hooks/useCallController';
import { useCallStore } from '../store/callStore';
import { RTCView } from '../services/webRTCService';
import { usePointsStore } from '../store/pointsStore';
import { PaidSessionLiveBadge, PaidSessionReceiptModal } from '../components/common/PaidCommunicationModal';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const callController = useCallController();
  const {
    callId,
    callStatus,
    callType,
    peerName,
    peerAvatar,
    ratePerMinute,
    durationSeconds,
    isAudioMuted,
    isVideoEnabled,
    isFrontCamera,
    isSpeakerOn,
    localStream,
    remoteStream,
    billingSummary,
    toggleAudio,
    toggleVideo,
    switchCamera,
    toggleSpeaker,
    hangupCall,
    initiateCall,
    cleanup,
  } = callController;

  const rawContactName = params.contactName || peerName;
  const contactName = rawContactName && rawContactName !== 'User' && rawContactName !== 'Rubaru User'
    ? rawContactName
    : (peerName || params.contactName || 'Rubaru Member');

  const rawAvatar = params.avatarUri || peerAvatar;
  const avatarUri = rawAvatar && typeof rawAvatar === 'string' && rawAvatar.trim().startsWith('http')
    ? rawAvatar.trim()
    : '';

  const balance = usePointsStore((state) => state.balance);
  const errorMessage = useCallStore((state) => state.errorMessage);
  const endReason = useCallStore((state) => state.endReason);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [enteredDigits, setEnteredDigits] = useState('');
  const [hasFilter, setHasFilter] = useState(false);
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(false);
  const hasInitiatedRef = useRef(false);

  // AppState listener for background/foreground video suspension & audio preservation
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const isBg = nextState === 'background' || nextState === 'inactive';
      setIsAppBackgrounded(isBg);
      if (isBg && callType === 'video') {
        console.log('[ACTIVE CALL] App backgrounded: video preview suspended, audio preserved.');
      } else if (!isBg) {
        console.log('[ACTIVE CALL] App foregrounded: video preview restored.');
      }
    });

    return () => {
      sub.remove();
    };
  }, [callType]);

  // Mark screen un-minimized when entered
  useEffect(() => {
    useCallStore.getState().setMinimized(false);
  }, []);

  const exitScreen = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  const handleMinimize = useCallback(() => {
    const status = useCallStore.getState().callStatus;
    if (status === 'ENDED' || status === 'IDLE') {
      useCallStore.getState().resetToIdle();
      exitScreen();
      return;
    }
    useCallStore.getState().setMinimized(true);
    exitScreen();
  }, [exitScreen]);

  // Android hardware back press support -> minimize call
  useEffect(() => {
    const onBackPress = () => {
      handleMinimize();
      return true;
    };
    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [handleMinimize]);

  // If initiated from screen params and not yet active
  useEffect(() => {
    if (params.receiverId && params.isInitiator !== 'false' && !hasInitiatedRef.current) {
      hasInitiatedRef.current = true;
      const currentStatus = useCallStore.getState().callStatus;
      if (currentStatus === 'ENDED') {
        useCallStore.getState().resetToIdle();
      }
      initiateCall({
        receiverId: params.receiverId,
        callType: params.callType === 'video' ? 'video' : 'audio',
        contactName: params.contactName || 'User',
        avatarUri: params.avatarUri || '',
      });
    }
  }, [params.receiverId, initiateCall, params.callType, params.contactName, params.avatarUri, params.isInitiator]);

  // Handle call completion / receipt modal
  useEffect(() => {
    if (callStatus === 'ENDED') {
      if (billingSummary) {
        setShowReceiptModal(true);
      } else {
        const delay = errorMessage ? 1800 : 600;
        const timeout = setTimeout(() => {
          useCallStore.getState().resetToIdle();
          exitScreen();
        }, delay);
        return () => clearTimeout(timeout);
      }
    }
  }, [callStatus, billingSummary, errorMessage, exitScreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const status = useCallStore.getState().callStatus;
      if (status === 'ENDED') {
        useCallStore.getState().resetToIdle();
      }
    };
  }, []);

  const handleEndCall = () => {
    if (callStatus === 'ENDED' || callStatus === 'IDLE') {
      useCallStore.getState().resetToIdle();
      exitScreen();
      return;
    }
    hangupCall('USER_HUNG_UP');
    setTimeout(() => {
      if (!useCallStore.getState().billingSummary) {
        useCallStore.getState().resetToIdle();
        exitScreen();
      }
    }, 400);
  };

  const getSubStatusText = () => {
    switch (callStatus) {
      case 'INITIATING':
        return 'Starting call...';
      case 'RINGING':
        return 'Ringing...';
      case 'CONNECTING':
        return 'Connecting media...';
      case 'RECONNECTING':
        return 'Reconnecting...';
      case 'ACTIVE':
        return formatDuration(durationSeconds);
      case 'ENDED':
        if (errorMessage) return errorMessage;
        if (endReason === 'INITIATION_FAILED') return 'Unable to place call';
        if (endReason === 'REJECTED') return 'Call declined';
        if (endReason === 'BUSY') return 'User is busy on another call';
        if (endReason === 'TIMEOUT') return 'No answer';
        return 'Call ended';
      default:
        return 'Calling...';
    }
  };

  const handleShareCall = async () => {
    try {
      await Share.share({
        message: `Join my call on Rubaru: ${contactName} (${phoneNumber})`,
      });
    } catch (e) {}
  };

  const handleDigitPress = (digit) => {
    setEnteredDigits((prev) => prev + digit);
  };

  const isVideoCall = callType === 'video';

  return (
    <View style={styles.safeContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Main Video View / Backdrop */}
      <View style={styles.fullScreenVideoWrapper}>
        {isVideoCall && remoteStream && RTCView ? (
          <RTCView
            streamURL={typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : ''}
            style={StyleSheet.absoluteFillObject}
            objectFit="cover"
            mirror={false}
          />
        ) : avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.35 }]}
            blurRadius={20}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#0B141B', '#1E293B']}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Gradient overlays */}
        <View style={styles.topGradientOverlay} />
        <View style={styles.bottomGradientOverlay} />

        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={[styles.headerCircleBtn, { top: Math.max(insets.top + 8, 20) }]}
            activeOpacity={0.7}
            onPress={handleMinimize}
            accessibilityLabel="Minimize call"
          >
            <Ionicons name="chevron-down" size={24} color="#E9EDEF" />
          </TouchableOpacity>

          <View style={[styles.headerCenter, { paddingTop: Math.max(insets.top + 8, 20) }]}>
            <Text style={styles.contactTitleText} numberOfLines={1}>
              {contactName}
            </Text>
            <View style={styles.encryptedRow}>
              {callStatus === 'ACTIVE' ? (
                <Text style={styles.subStatusText}>{getSubStatusText()}</Text>
              ) : (
                <>
                  <Ionicons name="lock-closed" size={12} color="#CBD5E1" style={{ marginRight: 4 }} />
                  <Text style={styles.subStatusText}>{getSubStatusText()}</Text>
                </>
              )}
            </View>

            {callStatus === 'ACTIVE' && (
              <PaidSessionLiveBadge
                isInitiator={callController.isInitiator}
                ratePerMinute={ratePerMinute || (isVideoCall ? 10 : 5)}
                billedMinutes={Math.max(1, Math.ceil(durationSeconds / 60))}
                totalCoins={Math.max(1, Math.ceil(durationSeconds / 60)) * (ratePerMinute || (isVideoCall ? 10 : 5))}
                currentBalance={balance}
              />
            )}
          </View>

          {/* Right Tools Column */}
          <View style={[styles.rightVerticalTools, { top: Math.max(insets.top + 8, 20) }]}>
            <TouchableOpacity
              style={styles.toolCircleBtn}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)')}
              accessibilityLabel="Open chat"
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            {isVideoCall && (
              <TouchableOpacity
                style={styles.toolCircleBtn}
                activeOpacity={0.7}
                onPress={switchCamera}
                accessibilityLabel="Switch Camera"
              >
                <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}

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

        {/* Local Camera Self-Preview (PiP Floating Thumbnail) */}
        {isVideoCall && isVideoEnabled && (
          <View style={styles.pipThumbnailContainer}>
            {localStream && RTCView ? (
              <RTCView
                streamURL={typeof localStream.toURL === 'function' ? localStream.toURL() : ''}
                style={styles.pipThumbnailImage}
                objectFit="cover"
                mirror={isFrontCamera}
              />
            ) : (
              <View style={[styles.pipThumbnailImage, styles.avatarPlaceholderSmall]}>
                <Ionicons name="person" size={28} color="#94A3B8" />
              </View>
            )}
            <View style={styles.pipBorderRing} />
          </View>
        )}

        {/* Center Avatar for Audio Calls */}
        {!isVideoCall && (
          <View style={styles.centerAvatarContainer}>
            <View style={styles.avatarRingOuter}>
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.avatarImage, styles.avatarPlaceholderLarge]}>
                  <Text style={styles.avatarInitialLarge}>
                    {contactName ? contactName.charAt(0).toUpperCase() : 'R'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.callerDisplayName}>{contactName}</Text>
            {callStatus === 'ACTIVE' && (
              <Text style={styles.callDurationTimer}>{formatDuration(durationSeconds)}</Text>
            )}
          </View>
        )}

        {/* Bottom Floating Control Bar */}
        <View style={[styles.bottomCapsuleWrapper, { paddingBottom: Math.max(insets.bottom + 12, 28) }]}>
          <View style={styles.capsuleBar}>
            {/* 1. More Options */}
            <TouchableOpacity
              style={styles.capsuleCircleBtn}
              activeOpacity={0.75}
              onPress={() => setShowMoreModal(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            {/* 2. Camera Toggle */}
            {isVideoCall && (
              <TouchableOpacity
                style={[
                  styles.capsuleCircleBtn,
                  !isVideoEnabled && styles.capsuleBtnDeactivated,
                ]}
                activeOpacity={0.75}
                onPress={toggleVideo}
              >
                <Ionicons
                  name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {/* 3. Speaker / Audio Route */}
            <TouchableOpacity
              style={[
                styles.capsuleCircleBtn,
                !isSpeakerOn && styles.capsuleBtnDeactivated,
              ]}
              activeOpacity={0.75}
              onPress={toggleSpeaker}
            >
              <Ionicons
                name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* 4. Microphone Mute / Unmute */}
            <TouchableOpacity
              style={[
                styles.capsuleCircleBtn,
                isAudioMuted && styles.capsuleBtnDeactivated,
              ]}
              activeOpacity={0.75}
              onPress={toggleAudio}
            >
              <Ionicons
                name={isAudioMuted ? 'mic-off' : 'mic'}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* 5. Hangup Button */}
            <TouchableOpacity
              style={styles.capsuleEndCallBtn}
              activeOpacity={0.8}
              onPress={handleEndCall}
            >
              <Ionicons name="call" size={26} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
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
            <Text style={styles.sheetTitle}>Call Options</Text>

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

      {/* Authoritative End-of-Session Financial Receipt Modal */}
      <PaidSessionReceiptModal
        visible={showReceiptModal}
        sessionData={billingSummary}
        onClose={() => {
          setShowReceiptModal(false);
          cleanup('COMPLETED');
          useCallStore.getState().resetToIdle();
          exitScreen();
        }}
        onViewTransactions={() => {
          setShowReceiptModal(false);
          cleanup('COMPLETED');
          useCallStore.getState().resetToIdle();
          router.push('/transactions');
        }}
      />
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
  },
  rightVerticalTools: {
    position: 'absolute',
    right: 16,
    zIndex: 35,
    gap: 12,
  },
  toolCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  toolBtnActive: {
    backgroundColor: 'rgba(0, 168, 132, 0.25)',
    borderColor: '#00A884',
  },
  pipThumbnailContainer: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    width: 100,
    height: 145,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    zIndex: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  pipThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  pipBorderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  centerAvatarContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarRingOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 116,
    height: 116,
    borderRadius: 58,
  },
  avatarPlaceholderLarge: {
    backgroundColor: '#FF2E63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialLarge: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarPlaceholderSmall: {
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerDisplayName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  callDurationTimer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  bottomCapsuleWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  capsuleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 36,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  capsuleCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capsuleBtnDeactivated: {
    backgroundColor: 'rgba(239, 68, 68, 0.35)',
  },
  capsuleEndCallBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  moreSheetContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetGrabHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#475569',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sheetOptionText: {
    fontSize: 15.5,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  keypadSheetContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  keypadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  keypadDigitsText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  keypadGrid: {
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  keypadDigitBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadDigitText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  clearDigitsBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  clearDigitsText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
