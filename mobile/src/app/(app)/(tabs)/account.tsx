import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Body, Button, Card, Heading, Row, Screen } from '@/components/ui';
import { useSession } from '@/hooks/use-session';
import { config } from '@/lib/config';
import { WalletCard } from '@/screens/wallet-card';

const ROLE: Record<string, string> = { SPONSOR: 'Sponsor', VERIFIER: 'Verifier', RECIPIENT: 'Recipient' };

export default function AccountScreen() {
  const { user, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  return (
    <Screen title="Account">
      <Card>
        <Row label="Signed in as" value={user?.username ?? '—'} />
      </Card>
      <Heading>Programs</Heading>
      {user?.memberships.map((m) => (
        <Card key={`${m.program_id}-${m.role}`}>
          <Body>{m.title}</Body>
          <Body muted>{ROLE[m.role] ?? m.role}</Body>
        </Card>
      ))}
      <Heading>Testnet wallet</Heading>
      <WalletCard />
      <Button
        title="Open Fundora on the web"
        variant="secondary"
        onPress={() => WebBrowser.openBrowserAsync(config.webBaseUrl)}
      />
      <Button
        title="Sign out"
        variant="danger"
        loading={busy}
        hint="Also deletes evidence drafts and reminders on this phone"
        onPress={() =>
          Alert.alert('Sign out?', 'Evidence drafts and reminders on this phone will be deleted. Your Testnet wallet stays on this phone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign out',
              style: 'destructive',
              onPress: async () => {
                setBusy(true);
                await signOut();
              },
            },
          ])
        }
      />
      <Body muted>Version {Constants.expoConfig?.version ?? '—'} · Testnet</Body>
    </Screen>
  );
}
