import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IncomingCallProvider } from '../src/components/common/IncomingCallContext';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { LanguageProvider } from '../src/localization/LanguageContext';
import { useFonts, Jaro_400Regular } from '@expo-google-fonts/jaro';
import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Jaro_400Regular,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <IncomingCallProvider>
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="signup-options" />
            <Stack.Screen name="email-verification" />
            <Stack.Screen name="phone-verification" />
            <Stack.Screen name="otp-verification" />
            <Stack.Screen name="profile-details" />
            <Stack.Screen name="birthday-picker" />
            <Stack.Screen name="gender-selection" />
            <Stack.Screen name="interests-selection" />
            <Stack.Screen name="search-friends" />
            <Stack.Screen name="enable-notifications" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="user-profile" />
            <Stack.Screen name="notification-settings" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="help-support" />
            <Stack.Screen name="scam-protection" />
            <Stack.Screen name="report-violations" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="safety-notices" />
            <Stack.Screen name="violations" />
            <Stack.Screen name="violation-details" />
            <Stack.Screen name="community-standards" />
            <Stack.Screen name="contact-us" />
            <Stack.Screen name="report-problem" />
            <Stack.Screen name="privacy-security-help" />
            <Stack.Screen name="customer-support-flow" />
            <Stack.Screen name="feedback" />
            <Stack.Screen name="faqs" />
          </Stack>
        </IncomingCallProvider>
      </ThemeProvider>
    </LanguageProvider>
  </QueryClientProvider>
  );
}
