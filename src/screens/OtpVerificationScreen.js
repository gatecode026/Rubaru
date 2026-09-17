import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import storage from '@services/storage';
import { connectSocket } from '@services/socket';
import { usePointsStore } from '../store/pointsStore';

import {
  confirmFirebasePhoneOtp,
  completeFirebasePhoneLogin,
  sendFirebasePhoneOtp,
} from '@services/firebaseAuth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const isFirebase = params.authProvider === 'firebase' || Boolean(params.sessionInfo);
  const otpLength = isFirebase ? 6 : 4;

  const [otp, setOtp] = useState(Array(otpLength).fill(''));
  const [sessionInfo, setSessionInfo] = useState(params.sessionInfo || null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [verifying, setVerifying] = useState(false);

  // Countdown Timer Interval
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  // Format seconds as MM:SS (e.g. 01:00, 00:59)
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    const m = mins < 10 ? `0${mins}` : `${mins}`;
    const s = remainingSecs < 10 ? `0${remainingSecs}` : `${remainingSecs}`;
    return `${m}:${s}`;
  };

  const verifyOtpCode = async (otpCodeString) => {
    setVerifying(true);
    try {
      if (isFirebase) {
        if (!sessionInfo) {
          throw new Error('Verification session is missing. Please tap Send again.');
        }

        const confirmRes = await confirmFirebasePhoneOtp(sessionInfo, otpCodeString);
        const loginRes = await completeFirebasePhoneLogin(confirmRes.idToken);

        setVerifying(false);

        if (loginRes.isProfileSetup) {
          router.replace('/(tabs)');
        } else {
          router.push({
            pathname: '/create-password',
            params: { token: loginRes.token },
          });
        }
        return;
      }

      const payload = { otpCode: otpCodeString };
      if (params.email) {
        payload.email = params.email;
      } else {
        payload.phone = params.phone;
      }

      const response = await api.post('/auth/verify-otp', payload);
      setVerifying(false);
      const { token, isProfileSetup } = response.data;
      
      // Store session in persistent storage
      await storage.saveSession(token, {
        email: params.email || undefined,
        phone: params.phone || undefined,
        isActive: true,
        isProfileSetup,
      });
      
      // Configure default header for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Update wallet balance from response and sync live balance
      if (response.data?.points !== undefined || response.data?.walletBalance !== undefined) {
        usePointsStore.getState().setBalance(response.data.walletBalance ?? response.data.points);
      }
      usePointsStore.getState().fetchBalance().catch(() => {});

      // Connect socket so real-time chat and calls work from first session
      connectSocket(token);

      if (isProfileSetup) {
        router.replace('/(tabs)');
      } else {
        router.push({
          pathname: '/create-password',
          params: { token }
        });
      }
    } catch (error) {
      setVerifying(false);
      console.error(error);
      const errMsg = error.message || error.response?.data?.message || 'Invalid OTP. Please try again.';
      alert(errMsg);
      setOtp(Array(otpLength).fill(''));
    }
  };

  // Handle number pad tap
  const handleKeyPress = (val) => {
    if (verifying) return;
    
    const emptyIndex = otp.findIndex((digit) => digit === '');
    if (emptyIndex !== -1) {
      const newOtp = [...otp];
      newOtp[emptyIndex] = val.toString();
      setOtp(newOtp);

      // Auto-submit when last digit is typed
      if (emptyIndex === otpLength - 1) {
        const finalOtp = newOtp.join('');
        setTimeout(() => {
          verifyOtpCode(finalOtp);
        }, 250);
      }
    }
  };

  // Handle backspace tap
  const handleBackspace = () => {
    const filledIndices = otp
      .map((digit, idx) => (digit !== '' ? idx : null))
      .filter((val) => val !== null);

    if (filledIndices.length > 0) {
      const lastIndex = filledIndices[filledIndices.length - 1];
      const newOtp = [...otp];
      newOtp[lastIndex] = '';
      setOtp(newOtp);
    }
  };

  // Handle resend OTP
  const handleResend = async () => {
    setOtp(Array(otpLength).fill(''));
    setSecondsLeft(60);
    try {
      if (isFirebase && params.phone) {
        const res = await sendFirebasePhoneOtp(params.phone);
        setSessionInfo(res.sessionInfo);
        alert('A new Firebase verification code has been sent.');
        return;
      }

      const payload = {};
      if (params.email) payload.email = params.email;
      else if (params.phone) payload.phone = params.phone;
      await api.post('/auth/resend-otp', payload);
      alert('A new verification code has been sent.');
    } catch (err) {
      console.warn('[RESEND OTP ERROR]', err.message);
      const errMsg = err.message || err.response?.data?.message || 'Failed to resend code. Please try again.';
      alert(errMsg);
    }
  };

  const keypadRows = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [null, 0, 'backspace'],
  ];

  const boxWidth = isFirebase
    ? Math.min(46, Math.floor((SCREEN_WIDTH - 64) / 6) - 4)
    : 60;
  const boxHeight = isFirebase ? 60 : 70;

  return (
    <View style={styles.rootContainer}>
      {/* Upper Area with Blush Background */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.upperContent, { paddingTop: Math.max(insets.top + 16, 44) }]}>
          
          {/* Header Back Button */}
          <View style={styles.topHeaderRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
              hitSlop={12}
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color="#111827" />
            </Pressable>
          </View>

          {/* Countdown Timer Header */}
          <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitleText}>
            Type the {otpLength}-digit verification code{'\n'}we've sent to your {params.email ? 'email' : 'mobile'}
          </Text>

          {/* OTP Grid Boxes */}
          <View style={styles.otpGridRow}>
            {Array.from({ length: otpLength }).map((_, index) => {
              const digit = otp[index] || '';
              const isFilled = digit !== '';
              const nextEmptyIndex = otp.findIndex((d) => d === '');
              const isCurrentFocus = !isFilled && (nextEmptyIndex === index || (nextEmptyIndex === -1 && index === otpLength - 1));

              return (
                <View
                  key={index}
                  style={[
                    styles.otpBox,
                    { width: boxWidth, height: boxHeight, marginHorizontal: isFirebase ? 3 : 6 },
                    isFilled && styles.otpBoxFilled,
                    isCurrentFocus && styles.otpBoxFocused,
                  ]}
                >
                  <Text
                    style={[
                      styles.otpDigitText,
                      isFirebase && { fontSize: 22 },
                      isFilled && styles.otpDigitTextFilled,
                      isCurrentFocus && styles.otpDigitTextFocused,
                    ]}
                  >
                    {digit}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Custom Number Keypad Area */}
        <View style={styles.keypadContainer}>
          {keypadRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((item, itemIndex) => {
                if (item === null) {
                  return <View key={itemIndex} style={styles.keypadKeyEmpty} />;
                }

                if (item === 'backspace') {
                  return (
                    <Pressable
                      key={itemIndex}
                      onPress={handleBackspace}
                      style={({ pressed }) => [styles.keypadKey, pressed && styles.keyPressed]}
                      accessibilityLabel="Backspace"
                    >
                      <Ionicons name="backspace-outline" size={26} color="#111827" />
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={itemIndex}
                    onPress={() => handleKeyPress(item)}
                    style={({ pressed }) => [styles.keypadKey, pressed && styles.keyPressed]}
                    accessibilityLabel={`Digit ${item}`}
                  >
                    <Text style={styles.keypadNumberText}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Soft Pink Footer with Resend Link */}
        <View style={[styles.bottomFooter, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
          <Pressable onPress={handleResend} hitSlop={12}>
            <Text style={styles.resendText}>Send again</Text>
          </Pressable>
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
  upperContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  topHeaderRow: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  timerText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 15,
    fontWeight: '400',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 36,
  },
  otpGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBox: {
    width: 60,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    backgroundColor: '#FF2E63',
    borderColor: '#FF2E63',
  },
  otpBoxFocused: {
    borderColor: '#FF2E63',
    borderWidth: 1.5,
  },
  otpDigitText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#D1D5DB',
  },
  otpDigitTextFilled: {
    color: '#FFFFFF',
  },
  otpDigitTextFocused: {
    color: '#9CA3AF',
  },
  keypadContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  keypadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 52,
    marginVertical: 4,
  },
  keypadKey: {
    width: SCREEN_WIDTH / 3 - 20,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  keypadKeyEmpty: {
    width: SCREEN_WIDTH / 3 - 20,
    height: 48,
  },
  keypadNumberText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
  },
  keyPressed: {
    backgroundColor: 'rgba(243, 244, 246, 0.8)',
  },
  bottomFooter: {
    width: '100%',
    backgroundColor: '#FDE8E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
