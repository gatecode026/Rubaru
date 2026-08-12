import { Stack } from 'expo-router';
import CallLogsScreen from '../src/screens/CallLogsScreen';

export default function CallLogsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <CallLogsScreen />
    </>
  );
}
