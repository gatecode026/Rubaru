import { Stack } from 'expo-router';
import GroupsScreen from '../src/screens/GroupsScreen';

export default function GroupsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <GroupsScreen />
    </>
  );
}
