import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';

export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useSession();
  const isVerifier = !!user?.memberships.some((m) => m.role === 'VERIFIER');
  // A verifier-only account has no awards of its own: show Reviews instead of an empty tab.
  const hasAwards = !!user?.memberships.some((m) => m.role === 'RECIPIENT' || m.role === 'SPONSOR');

  return (
    <NativeTabs
      backgroundColor={theme.surface}
      indicatorColor={theme.accentSoft}
      tintColor={theme.accent}
      labelStyle={{ selected: { color: theme.accent } }}>
      <NativeTabs.Trigger name="index" hidden={!hasAwards && isVerifier}>
        <NativeTabs.Trigger.Label>Awards</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="rosette" md="workspace_premium" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reviews" hidden={!isVerifier}>
        <NativeTabs.Trigger.Label>Reviews</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" md="fact_check" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
