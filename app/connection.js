import { Stack } from 'expo-router';
import ConnectionScreen from '../src/screens/ConnectionScreen';

export default function ConnectionRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConnectionScreen />
    </>
  );
}
