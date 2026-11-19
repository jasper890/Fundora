import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Card, Notice, Row } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { formatTestnetXlm } from '@/lib/format/amount';
import { canCreateWallet, createWallet, deleteWallet, getWalletAddress, walletSupported } from '@/lib/wallet/wallet';
import { fundWithFriendbot, testnetBalance } from '@/lib/wallet/testnet';

const ROLE: Record<string, string> = { SPONSOR: 'Sponsor', VERIFIER: 'Verifier', RECIPIENT: 'Recipient' };

export function useWalletAddress() {
  return useQuery({ queryKey: ['wallet'], queryFn: getWalletAddress, staleTime: Infinity });
}

export function WalletCard() {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const { data: address, isPending } = useWalletAddress();
  const balance = useQuery({
    queryKey: ['wallet-balance', address],
    queryFn: () => testnetBalance(address!),
    enabled: !!address,
  });
  const [busy, setBusy] = useState<null | 'create' | 'fund' | 'delete'>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'neutral'; text: string } | null>(null);

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<string | null>) => {
    setBusy(kind);
    setMessage(null);
    try {
      const text = await task();
      if (text) setMessage({ tone: 'success', text });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusy(null);
      await queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
    }
  };

  if (isPending) return null;

  if (!address) {
    const supported = canCreateWallet();
    return (
      <>
        <Body muted>
          Create a Stellar Testnet wallet on this phone to sign award actions here. Its secret key stays in this
          phone&apos;s secure storage and is unlocked with your fingerprint or face. Testnet XLM has no real value.
        </Body>
        <Notice tone="warning">
          There is no backup. If you lose this phone, delete the wallet, or reset fingerprint or face unlock, the wallet
          is gone and awards linked to it must be signed elsewhere. The wallet belongs to this phone: anyone who signs
          in here uses it.
        </Notice>
        {supported ? null : (
          <Notice tone="warning">
            {walletSupported
              ? 'Set up fingerprint or face unlock on this phone first.'
              : 'The phone wallet needs the Fundora Android app build. It is not available in Expo Go or on iOS yet.'}
          </Notice>
        )}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <Button
          title="Create Testnet wallet"
          disabled={!supported}
          loading={busy === 'create'}
          onPress={() => run('create', async () => (await createWallet(), 'Wallet created.'))}
        />
      </>
    );
  }

  const memberships = user?.memberships ?? [];
  const linked = memberships.filter((m) => m.public_wallet === address);
  const others = [...new Set(memberships.map((m) => m.public_wallet).filter((w) => w && w !== address))];
  const label = (m: (typeof memberships)[number]) => `${m.title} (${ROLE[m.role] ?? m.role})`;
  const funded = balance.data !== null && balance.data !== undefined;

  return (
    <>
      <Card>
        <Row label="Address" value={address} mono />
        <Row
          label="Balance"
          value={
            balance.isPending
              ? 'Checking…'
              : balance.error
                ? 'Unavailable'
                : funded
                  ? formatTestnetXlm(balance.data!)
                  : 'Not funded yet'
          }
        />
      </Card>
      {balance.error ? (
        <Button title="Check balance again" variant="secondary" compact onPress={() => balance.refetch()} />
      ) : null}
      {linked.length > 0 ? <Notice tone="success">Linked to {linked.map(label).join(', ')}.</Notice> : null}
      {others.length > 0 ? (
        <Notice tone="warning">
          {linked.length > 0 ? 'Some of your programs' : 'Your programs'} use a different wallet ({others
            .map((w) => `${w!.slice(0, 6)}…${w!.slice(-6)}`)
            .join(', ')}). Sign those awards on the web with that wallet.
        </Notice>
      ) : null}
      {linked.length === 0 ? (
        <Notice>
          To use this wallet, send its address to your program administrator before your award is created. Wallets cannot
          change after an award is deployed.
        </Notice>
      ) : null}
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      <View style={styles.row}>
        <Button
          title="Copy address"
          variant="secondary"
          grow
          onPress={async () => {
            await Clipboard.setStringAsync(address);
            setMessage({ tone: 'success', text: 'Address copied.' });
          }}
        />
        {funded ? null : (
          <Button
            title="Get Testnet XLM"
            variant="secondary"
            grow
            hint="Free from Stellar's Friendbot; pays transaction fees"
            loading={busy === 'fund'}
            onPress={() =>
              run('fund', async () =>
                (await fundWithFriendbot(address)) ? 'Funded with Testnet XLM.' : 'This wallet is already funded.',
              )
            }
          />
        )}
      </View>
      <Button
        title="Delete wallet from this phone"
        variant="danger"
        loading={busy === 'delete'}
        onPress={() =>
          Alert.alert(
            'Delete this wallet?',
            `There is no backup. ${
              linked.length > 0 ? `It is linked to ${linked.map(label).join(', ')}. ` : ''
            }You will not be able to sign awards linked to this address on this phone, a new wallet will not match them, and its Testnet XLM is lost.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => run('delete', async () => (await deleteWallet(), 'Wallet deleted from this phone.')),
              },
            ],
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
});
