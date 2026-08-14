import { Stack } from 'expo-router';
import ActiveCallScreen from '../src/screens/ActiveCallScreen';

export default function ActiveCallRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ActiveCallScreen />
    </>
  );
}
