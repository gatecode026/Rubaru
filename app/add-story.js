import React from 'react';
import { Stack } from 'expo-router';
import AddStoryScreen from '../src/screens/AddStoryScreen';

export default function AddStory() {
  return (
    <>
      <Stack.Screen options={{ presentation: 'modal', headerShown: false }} />
      <AddStoryScreen />
    </>
  );
}
