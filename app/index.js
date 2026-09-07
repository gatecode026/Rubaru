import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingScreen from '@screens/OnboardingScreen';
import api from '../src/services/api';
import storage from '../src/services/storage';
import { connectSocket } from '../src/services/socket';

export default function Index() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      try {
        const token = await storage.getToken();

        // If no token exists, user is NOT signed up / not logged in
        if (!token) {
          if (isMounted) {
            setIsAuthenticated(false);
            setCheckingAuth(false);
          }
          return;
        }

        try {
          // Verify with backend database
          const response = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const userData = response.data;

          if (!isMounted) return;

          // Check 1: Must be verified (isActive === true)
          if (!userData.isActive) {
            console.log('[AUTH CHECK] User is unverified, routing to OTP verification');
            setCheckingAuth(false);
            router.replace({
              pathname: '/otp-verification',
              params: {
                email: userData.email || undefined,
                phone: userData.phone || undefined,
              },
            });
            return;
          }

          // Check 2: Must have completed profile setup
          if (!userData.isProfileSetup) {
            console.log('[AUTH CHECK] Profile setup incomplete, routing to profile-details');
            setCheckingAuth(false);
            router.replace({
              pathname: '/profile-details',
              params: { token },
            });
            return;
          }

          // Fully authenticated & verified user
          await storage.saveSession(token, userData);
          try {
            connectSocket(token);
          } catch (sockErr) {
            console.warn('[AUTH CHECK SOCKET WARNING]', sockErr.message);
          }
          setIsAuthenticated(true);
          setCheckingAuth(false);
          router.replace('/(tabs)');
        } catch (apiErr) {
          console.log('[AUTH CHECK VERIFY ERROR]', apiErr.response?.status, apiErr.message);

          // If token is invalid or user was removed from DB, wipe token and require sign up
          if (apiErr.response?.status === 401 || apiErr.response?.status === 404) {
            await storage.clearSession();
            if (isMounted) {
              setIsAuthenticated(false);
              setCheckingAuth(false);
            }
          } else {
            // Network failure / offline: check cached user session
            try {
              const cachedUser = await storage.getUser();
              if (cachedUser && cachedUser.isActive && cachedUser.isProfileSetup) {
                try {
                  connectSocket(token);
                } catch (_) {}
                if (isMounted) {
                  setIsAuthenticated(true);
                  setCheckingAuth(false);
                  router.replace('/(tabs)');
                }
              } else {
                if (isMounted) {
                  setIsAuthenticated(false);
                  setCheckingAuth(false);
                }
              }
            } catch (_) {
              if (isMounted) {
                setIsAuthenticated(false);
                setCheckingAuth(false);
              }
            }
          }
        }
      } catch (err) {
        console.log('[AUTH CHECK UNEXPECTED ERROR]', err?.stack || err?.message || err);
        if (isMounted) {
          setIsAuthenticated(false);
          setCheckingAuth(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (checkingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2E63" />
      </View>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return <OnboardingScreen />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
