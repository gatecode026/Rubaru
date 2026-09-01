import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '@services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectSocket } from '@services/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('email'); // 'email' | 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (activeTab === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email.trim())) {
        alert('Please enter a valid email address.');
        return;
      }
    } else {
      if (!phone || phone.trim().length < 10) {
        alert('Please enter a valid phone number (minimum 10 digits).');
        return;
      }
    }

    if (!password || password.trim().length < 6) {
      alert('Please enter your password (minimum 6 characters).');
      return;
    }

    setLoading(true);
    try {
      const payload = { password: password.trim() };
      if (activeTab === 'email') {
        payload.email = email.trim().toLowerCase();
      } else {
        payload.phone = phone.trim();
      }

      const response = await api.post('/auth/login', payload);
      setLoading(false);

      const { token, isProfileSetup } = response.data;

      // Store JWT token
      await AsyncStorage.setItem('userToken', token);

      // Set headers for all future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Connect socket with the fresh token so real-time events work immediately
      connectSocket(token);

      if (isProfileSetup) {
        router.replace('/(tabs)');
      } else {
        router.push({
          pathname: '/profile-details',
          params: { token }
        });
      }
    } catch (error) {
      setLoading(false);
      console.error(error);
      const errMsg = error.response?.data?.message || 'Invalid email or password. Please try again.';
      alert(errMsg);
    }
  };

  const handleSignUpLink = () => {
    router.push('/signup-options');
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Full-Screen Blush Hearts Background Image */}
      <ImageBackground
        source={require('@assets/images/app_background.jpg')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={[styles.mainWrapper, { paddingTop: Math.max(insets.top + 16, 44), paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
          
          {/* Top Safe Area Header Row with Back Button */}
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

          {/* Form Container */}
          <View style={styles.formContainer}>
            {/* Header Title */}
            <Text style={styles.titleText}>Welcome back</Text>

            {/* Subtitle Description */}
            <Text style={styles.subtitleText}>
              Sign in to continue discovering matches{'\n'}and connecting with people.
            </Text>

            {/* Segmented Tab Selector */}
            <View style={styles.tabContainer}>
              <Pressable
                style={[styles.tabButton, activeTab === 'email' && styles.activeTabButton]}
                onPress={() => setActiveTab('email')}
              >
                <Text style={[styles.tabText, activeTab === 'email' && styles.activeTabText]}>Email</Text>
              </Pressable>
              <Pressable
                style={[styles.tabButton, activeTab === 'phone' && styles.activeTabButton]}
                onPress={() => setActiveTab('phone')}
              >
                <Text style={[styles.tabText, activeTab === 'phone' && styles.activeTabText]}>Phone</Text>
              </Pressable>
            </View>

            {/* Email Input Field Card */}
            {activeTab === 'email' ? (
              <View style={styles.inputCard}>
                <Ionicons name="mail-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            ) : (
              /* Phone Input Field Card */
              <View style={styles.inputCard}>
                <Ionicons name="call-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.textInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone number (e.g. +91...)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Password Input Field Card */}
            <View style={styles.inputCard}>
              <Ionicons name="lock-closed-outline" size={22} color="#9CA3AF" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.textInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9CA3AF"
                />
              </Pressable>
            </View>

            {/* Forgot Password Row */}
            <Pressable onPress={handleForgotPassword} style={styles.forgotRow} hitSlop={8}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {/* Primary Sign In Button */}
            <Pressable
              onPress={loading ? null : handleSignIn}
              style={({ pressed }) => [styles.signInButton, (pressed || loading) && styles.buttonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </Pressable>

            {/* Don't have an account? Sign Up */}
            <View style={styles.signUpRow}>
              <Text style={styles.dontHaveText}>Don't have an account? </Text>
              <Pressable onPress={handleSignUpLink} hitSlop={8}>
                <Text style={styles.signUpText}>Sign Up</Text>
              </Pressable>
            </View>
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
  mainWrapper: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topHeaderRow: {
    width: '100%',
    height: 44,
    justifyContent: 'center',
    marginBottom: 36,
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
  formContainer: {
    width: Math.min(SCREEN_WIDTH - 48, 340),
    alignSelf: 'center',
  },
  titleText: {
    fontSize: 34,
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
    lineHeight: 20,
    marginBottom: 36,
    alignSelf: 'flex-start',
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
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 0,
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 36,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF2E63',
  },
  signInButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FF2E63',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#FF2E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dontHaveText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '400',
  },
  signUpText: {
    fontSize: 15,
    color: '#FF2E63',
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(243, 244, 246, 0.9)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 11,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#111827',
    fontWeight: '700',
  },
});
