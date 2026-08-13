import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function NotificationTab() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)?tab=notification');
  }, []);
  return null;
}
