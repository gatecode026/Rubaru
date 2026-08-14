import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ConnectionTab() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)?tab=connection');
  }, []);
  return null;
}
