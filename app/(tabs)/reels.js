import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ReelsTab() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)?tab=reels');
  }, []);
  return null;
}
