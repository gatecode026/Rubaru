import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import OnboardingScreen from '@screens/OnboardingScreen';
import api from '../src/services/api';

export default function Index() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token && isMounted) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setIsAuthenticated(true);
          router.replace('/(tabs)');
          return;
        }
      } catch (err) {
        console.log('[AUTH CHECK ERROR]', err);
      } finally {
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    };
    checkAuth();
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
