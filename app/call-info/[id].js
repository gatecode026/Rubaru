import { Stack } from 'expo-router';
import CallInfoScreen from '../../src/screens/CallInfoScreen';

export default function CallInfoRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CallInfoScreen />
    </>
  );
}
