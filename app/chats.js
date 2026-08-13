import { Stack } from 'expo-router';
import ChatsScreen from '../src/screens/ChatsScreen';

export default function ChatsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatsScreen />
    </>
  );
}
