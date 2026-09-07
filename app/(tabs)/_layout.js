import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import storage from '../../src/services/storage';

export default function TabLayout() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkTabAccess = async () => {
      try {
        const token = await storage.getToken();
        if (!token) {
          console.log('[TAB AUTH GUARD] No token found, blocking access to tabs');
          if (isMounted) {
            setIsAuthorized(false);
            setChecking(false);
            router.replace('/');
          }
          return;
        }

        // Token exists
        if (isMounted) {
          setIsAuthorized(true);
          setChecking(false);
        }
      } catch (err) {
        console.warn('[TAB AUTH GUARD ERROR]', err);
        if (isMounted) {
          setIsAuthorized(false);
          setChecking(false);
          router.replace('/');
        }
      }
    };

    checkTabAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF2E63" />
      </View>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <Slot />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
  },
});


