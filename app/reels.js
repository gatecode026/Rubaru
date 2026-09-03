import { Stack } from 'expo-router';
import ReelsScreen from '../src/screens/ReelsScreen';

export default function ReelsRoute() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReelsScreen isNestedInPager={false} isTabFocused={true} />
    </>
  );
}
