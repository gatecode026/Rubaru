import React from 'react';
import { Stack } from 'expo-router';
import ViewStoryScreen from '../src/screens/ViewStoryScreen';

export default function ViewStory() {
  return (
    <>
      <Stack.Screen options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <ViewStoryScreen />
    </>
  );
}
