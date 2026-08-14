import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function GroupsTab() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)?tab=groups');
  }, []);
  return null;
}
