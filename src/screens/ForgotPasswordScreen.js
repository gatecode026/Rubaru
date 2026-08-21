import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ImageBackground,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Step state: 1 = Email/Phone, 2 = Verification Code, 3 = Reset Password, 4 = Success
  const [step, setStep] = useState(1);
  const [resetMethod, setResetMethod] = useState('email'); // 'email' or 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendTimer, setResendTimer] = useState(30);

  // OTP input refs
  const otpRef0 = useRef(null);
  const otpRef1 = useRef(null);
  const otpRef2 = useRef(null);
  const otpRef3 = useRef(null);
  const otpRefs = [otpRef0, otpRef1, otpRef2, otpRef3];

  useEffect(() => {
    let interval = null;
    if (step === 2 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleSendCode = () => {
    setErrorMessage('');
    if (resetMethod === 'email') {
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
    } else {
      if (!phone.trim() || phone.length < 10) {
        setErrorMessage('Please enter a valid phone number.');
        return;
      }
    }
    setStep(2);
    setResendTimer(30);
  };

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = () => {
    setErrorMessage('');
    const code = otp.join('');
    if (code.length < 4) {
      setErrorMessage('Please enter the full 4-digit code.');
      return;
    }
    setStep(3);
  };

  const handleResetPassword = () => {
    setErrorMessage('');
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setStep(4);
  };

  const handleBackToSignIn = () => {
    router.replace('/sign-in');
  };

  const handleResendCode = () => {
    if (resendTimer === 0) {
      setResendTimer(30);
      setOtp(['', '', '', '']);
      setErrorMessage('');
    }
  };

  const renderHeader = () => (
    <View style={styles.topHeaderRow}>
      <Pressable
        onPress={() => {
          if (step > 1 && step < 4) {
            setErrorMessage('');
            setStep(step - 1);
          } else {
            router.back();
          }
        }}
        style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
        hitSlop={12}
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color="#111827" />
      </Pressable>
      
      <View style={styles.stepBadgeContainer}>
        {step < 4 && (
          <Text style={styles.stepBadgeText}>Step {step} of 3</Text>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.rootContainer}>
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingTop: Math.max(insets.top + 16, 44),
                paddingBottom: Math.max(insets.bottom + 24, 36),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderHeader()}

            <View style={styles.formContainer}>
              {/* STEP 1: Enter Email or Phone */}
              {step === 1 && (
                <>
                  <Text style={styles.titleText}>Forgot Password</Text>
                  <Text style={styles.subtitleText}>
                    Don't worry! It happens. Please enter the email address or phone number associated with your account.
                  </Text>

                  {/* Method Toggle Buttons */}
                  <View style={styles.toggleContainer}>
                    <Pressable
                      style={[
                        styles.toggleTab,
                        resetMethod === 'email' && styles.toggleTabActive,
                      ]}
                      onPress={() => {
                        setResetMethod('email');
                        setErrorMessage('');
                      }}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={18}
                        color={resetMethod === 'email' ? '#FF2E63' : '#6B7280'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.toggleTabText,
                          resetMethod === 'email' && styles.toggleTabTextActive,
                        ]}
                      >
                        Email
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.toggleTab,
                        resetMethod === 'phone' && styles.toggleTabActive,
                      ]}
                      onPress={() => {
                        setResetMethod('phone');
                        setErrorMessage('');
                      }}
                    >
                      <Ionicons
                        name="call-outline"
                        size={18}
                        color={resetMethod === 'phone' ? '#FF2E63' : '#6B7280'}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.toggleTabText,
                          resetMethod === 'phone' && styles.toggleTabTextActive,
                        ]}
                      >
                        Phone
                      </Text>
                    </Pressable>
                  </View>

                  {/* Input Card */}
                  {resetMethod === 'email' ? (
                    <View style={[styles.inputCard, errorMessage && styles.inputCardError]}>
                      <Ionicons name="mail-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.textInput}
                        value={email}
                        onChangeText={(val) => {
                          setEmail(val);
                          if (errorMessage) setErrorMessage('');
                        }}
                        placeholder="Enter registered email"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  ) : (
                    <View style={[styles.inputCard, errorMessage && styles.inputCardError]}>
                      <Ionicons name="call-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.textInput}
                        value={phone}
                        onChangeText={(val) => {
                          setPhone(val);
                          if (errorMessage) setErrorMessage('');
                        }}
                        placeholder="Enter phone number"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="phone-pad"
                      />
                    </View>
                  )}

                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}

                  <Pressable
                    onPress={handleSendCode}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.primaryButtonText}>Send Reset Code</Text>
                  </Pressable>

                  <View style={styles.footerRow}>
                    <Text style={styles.rememberText}>Remember your password? </Text>
                    <Pressable onPress={() => router.replace('/sign-in')} hitSlop={8}>
                      <Text style={styles.signInText}>Sign In</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {/* STEP 2: Verification Code */}
              {step === 2 && (
                <>
                  <Text style={styles.titleText}>Verify Code</Text>
                  <Text style={styles.subtitleText}>
                    Enter the 4-digit code sent to{' '}
                    <Text style={{ fontWeight: '700', color: '#111827' }}>
                      {resetMethod === 'email' ? email : phone}
                    </Text>
                  </Text>

                  {/* OTP 4-Box Container */}
                  <View style={styles.otpContainer}>
                    {otp.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        ref={otpRefs[idx]}
                        style={[
                          styles.otpBox,
                          digit ? styles.otpBoxFilled : null,
                          errorMessage ? styles.inputCardError : null,
                        ]}
                        value={digit}
                        onChangeText={(text) => handleOtpChange(text, idx)}
                        onKeyPress={(e) => handleOtpKeyPress(e, idx)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                      />
                    ))}
                  </View>

                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}

                  <Pressable
                    onPress={handleVerifyOtp}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.primaryButtonText}>Verify Code</Text>
                  </Pressable>

                  <View style={styles.resendRow}>
                    {resendTimer > 0 ? (
                      <Text style={styles.resendTimerText}>
                        Resend code in <Text style={{ fontWeight: '700', color: '#FF2E63' }}>{resendTimer}s</Text>
                      </Text>
                    ) : (
                      <Pressable onPress={handleResendCode} hitSlop={8}>
                        <Text style={styles.resendActionText}>Resend Code</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}

              {/* STEP 3: Reset Password */}
              {step === 3 && (
                <>
                  <Text style={styles.titleText}>Create New Password</Text>
                  <Text style={styles.subtitleText}>
                    Your new password must be different from previously used passwords.
                  </Text>

                  {/* New Password Input */}
                  <View style={[styles.inputCard, errorMessage && styles.inputCardError]}>
                    <Ionicons name="lock-closed-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                    <TextInput
                      style={styles.textInput}
                      value={newPassword}
                      onChangeText={(val) => {
                        setNewPassword(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="New password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showNewPassword}
                    />
                    <Pressable onPress={() => setShowNewPassword(!showNewPassword)} hitSlop={8}>
                      <Ionicons
                        name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  </View>

                  {/* Confirm Password Input */}
                  <View style={[styles.inputCard, errorMessage && styles.inputCardError]}>
                    <Ionicons name="lock-closed-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                    <TextInput
                      style={styles.textInput}
                      value={confirmPassword}
                      onChangeText={(val) => {
                        setConfirmPassword(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                      placeholder="Confirm new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showConfirmPassword}
                    />
                    <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                      <Ionicons
                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  </View>

                  {errorMessage ? (
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  ) : null}

                  <Pressable
                    onPress={handleResetPassword}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.primaryButtonText}>Reset Password</Text>
                  </Pressable>
                </>
              )}

              {/* STEP 4: Success Confirmation */}
              {step === 4 && (
                <View style={styles.successContainer}>
                  <View style={styles.successBadge}>
                    <Ionicons name="checkmark-circle" size={72} color="#FF2E63" />
                  </View>
                  <Text style={styles.successTitle}>Password Changed!</Text>
                  <Text style={styles.successSubtitle}>
                    Your password has been reset successfully.{'\n'}Now you can sign in with your new password.
                  </Text>

                  <Pressable
                    onPress={handleBackToSignIn}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.primaryButtonText}>Back to Sign In</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
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
  stepBadgeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  stepBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF2E63',
  },
  formContainer: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
    letterSpacing: -0.5,
    alignSelf: 'flex-start',
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 28,
    alignSelf: 'flex-start',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.8)',
  },
  toggleTab: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTabTextActive: {
    color: '#FF2E63',
    fontWeight: '700',
  },
  inputCard: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputCardError: {
    borderColor: '#EF4444',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: -4,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF2E63',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rememberText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '400',
  },
  signInText: {
    fontSize: 14,
    color: '#FF2E63',
    fontWeight: '700',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'between',
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  otpBox: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(229, 231, 235, 0.9)',
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  otpBoxFilled: {
    borderColor: '#FF2E63',
    backgroundColor: '#FFF5F7',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: -8,
  },
  resendTimerText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  resendActionText: {
    fontSize: 14,
    color: '#FF2E63',
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  successBadge: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
});
