import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { PrivacyLock } from '@/components/privacy-lock';
import { Notice, Screen } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { ApiError } from '@/lib/api/client';
import { configError } from '@/lib/config';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Retry network blips, never 4xx answers.
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
    },
  },
});

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const theme = useTheme();
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.accent,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.line,
    },
  };
  return (
    <ThemeProvider value={navTheme}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <RootStack />
          <PrivacyLock />
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function RootStack() {
  const { status } = useSession();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (status !== 'loading' || configError) SplashScreen.hideAsync();
  }, [status]);

  // Reminder tap → the award it is about.
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (status === 'signed-in' && typeof url === 'string' && url.startsWith('/awards/')) {
      router.push(url as Href);
      Notifications.clearLastNotificationResponse();
    }
  }, [response, status]);

  if (configError) {
    return (
      <Screen title="Setup needed">
        <Notice tone="warning">{configError}</Notice>
      </Screen>
    );
  }
  if (status === 'loading') return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signed-in'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status !== 'signed-in'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
