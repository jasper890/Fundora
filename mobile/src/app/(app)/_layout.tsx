import { Stack } from 'expo-router';

import { useTheme } from '@/constants/theme';

export default function AppLayout() {
  const theme = useTheme();
  return (
    <Stack screenOptions={{ headerTintColor: theme.accent, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="awards/[id]/index" options={{ title: 'Award' }} />
      <Stack.Screen name="awards/[id]/evidence/new" options={{ title: 'Add evidence', presentation: 'modal' }} />
      <Stack.Screen name="awards/[id]/review" options={{ title: 'Send a note', presentation: 'modal' }} />
      <Stack.Screen name="awards/[id]/sign" options={{ title: 'Sign on Testnet', presentation: 'modal' }} />
    </Stack>
  );
}
