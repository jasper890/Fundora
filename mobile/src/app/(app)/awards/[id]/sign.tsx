import { useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';

import { Body, Button, Card, Loading, Notice, Row, Screen } from '@/components/ui';
import { useAward } from '@/hooks/use-awards';
import { api } from '@/lib/api/client';
import { anyOk, openOperationSchema, operationSchema, type Operation, type OpStatus } from '@/lib/api/schemas';
import { config } from '@/lib/config';
import { formatTestnetXlm } from '@/lib/format/amount';
import { testnetBalance } from '@/lib/wallet/testnet';
import { signOperation } from '@/lib/wallet/wallet';
import { useWalletAddress } from '@/screens/wallet-card';

/** Actions the phone wallet signs; everything else stays on the website. */
const ACTIONS = { SUBMIT: 'Sign submission', APPROVE: 'Sign approval', PAY: 'Sign payment release' } as const;
type SignAction = keyof typeof ACTIONS;
const isSignAction = (action: string | undefined): action is SignAction => !!action && action in ACTIONS;

const TERMINAL = new Set<OpStatus>(['CONFIRMED_SUCCESS', 'CONFIRMED_FAILED', 'ABANDONED']);
const short = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-6)}`;

function abandon(id: string) {
  return api(`/api/v1/operations/${id}/abandon`, anyOk, { method: 'POST', body: {} });
}

export default function SignScreen() {
  // No action means "resume the transaction I already have open on this award".
  const { id, action } = useLocalSearchParams<{ id: string; action?: string }>();
  const queryClient = useQueryClient();
  const award = useAward(id);
  const wallet = useWalletAddress();
  // One key per attempt; "Try again" takes a new one, and the open-operation lookup still finds any earlier one.
  const [idempotencyKey, setIdempotencyKey] = useState(randomUUID);
  const [sentId, setSentId] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'sign' | 'cancel'>(null);
  const [error, setError] = useState<string | null>(null);
  const settled = useRef(false);
  // Guards the biometric prompt against a double tap and against cancelling while a signature is in flight.
  const signing = useRef(false);

  const start = useQuery({
    queryKey: ['sign', id, action ?? 'resume', idempotencyKey],
    enabled: !!award.data,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    queryFn: async (): Promise<{ op: Operation; preparedHere: boolean } | null> => {
      const { operation } = await api(`/api/v1/awards/${id}/operations/open`, openOperationSchema);
      if (operation) return { op: operation, preparedHere: false };
      if (!isSignAction(action)) return null;
      const params = action === 'SUBMIT' ? { evidence_id: award.data!.evidence[0]?.id } : {};
      const op = await api(`/api/v1/awards/${id}/prepare/${action}`, operationSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: { expected_version: award.data!.award.version, params },
      });
      return { op, preparedHere: true };
    },
  });

  const op = start.data?.op;
  const preparedHereId = start.data?.preparedHere ? start.data.op.id : null;
  // Closing the screen without signing must not leave a preparation that blocks the next attempt for minutes.
  useEffect(() => {
    if (!preparedHereId) return;
    return () => {
      if (settled.current || signing.current) return;
      abandon(preparedHereId)
        .catch(() => undefined)
        .finally(() => queryClient.invalidateQueries({ queryKey: ['award', id] }));
    };
  }, [preparedHereId, queryClient, id]);

  const watchId = sentId ?? (op && op.status !== 'PREPARED' ? op.id : null);
  const status = useQuery({
    queryKey: ['operation', watchId],
    enabled: !!watchId,
    queryFn: async () => {
      const result = await api(`/api/v1/operations/${watchId}/status`, operationSchema);
      if (TERMINAL.has(result.status)) {
        await queryClient.invalidateQueries({ queryKey: ['award', id] });
        await queryClient.invalidateQueries({ queryKey: ['awards'] });
      }
      return result;
    },
    refetchInterval: (query) => (query.state.data && TERMINAL.has(query.state.data.status) ? false : 2500),
  });

  const live = op?.preview?.mode === 'live';
  const balance = useQuery({
    queryKey: ['wallet-balance', wallet.data],
    queryFn: () => testnetBalance(wallet.data!),
    enabled: live && !!wallet.data,
  });

  if (award.isPending || start.isPending || wallet.isPending) return <Loading />;

  const close = <Button title="Close" variant="secondary" onPress={() => router.back()} />;

  if (start.error || !op) {
    return (
      <Screen header>
        <Stack.Screen options={{ title: 'Transaction' }} />
        <Notice tone={start.error ? 'danger' : 'neutral'}>
          {start.error?.message ??
            'Another member has a transaction open on this award. It settles on its own; check back shortly.'}
        </Notice>
        {start.error ? (
          <Button
            title="Try again"
            onPress={() => {
              void award.refetch();
              setIdempotencyKey(randomUUID());
            }}
          />
        ) : null}
        {close}
      </Screen>
    );
  }

  const opAction = op.preview?.action ?? op.action;
  if (!isSignAction(opAction)) {
    return (
      <Screen header>
        <Stack.Screen options={{ title: 'Transaction' }} />
        <Notice>This transaction was prepared on the web. Finish it there.</Notice>
        <Button
          title="Continue on the web"
          onPress={() => WebBrowser.openBrowserAsync(`${config.webBaseUrl}/awards/${id}`)}
          hint="Sign there with your Freighter wallet"
        />
        {close}
      </Screen>
    );
  }
  const title = ACTIONS[opAction];
  const header = <Stack.Screen options={{ title }} />;
  const otherOpen = isSignAction(action) && action !== opAction;

  if (watchId) {
    const current = status.data?.status ?? op.status;
    return (
      <Screen header>
        {header}
        {current === 'CONFIRMED_SUCCESS' ? (
          <Notice tone="success">
            {op.preview?.mode === 'fakerpc'
              ? 'Confirmed by the local test server. No Testnet transaction was sent.'
              : 'Confirmed on Stellar Testnet.'}
          </Notice>
        ) : current === 'CONFIRMED_FAILED' ? (
          <Notice tone="danger">The transaction failed on Testnet. The award did not change.</Notice>
        ) : current === 'ABANDONED' ? (
          <Notice>This transaction was cancelled.</Notice>
        ) : current === 'UNKNOWN' ? (
          <Notice tone="warning">Outcome not confirmed yet. We keep checking Stellar. Do not sign again.</Notice>
        ) : current === 'BUILDING' ? (
          <Notice tone="progress">Preparing the transaction…</Notice>
        ) : (
          <Notice tone="progress">Sent. Waiting for Testnet to confirm… This usually takes a few seconds.</Notice>
        )}
        {status.error ? <Notice tone="danger">{status.error.message}</Notice> : null}
        {TERMINAL.has(current) ? (
          <Button title="Done" onPress={() => router.back()} />
        ) : (
          <>
            <Body muted>You can close this and check again from the award.</Body>
            {close}
          </>
        )}
      </Screen>
    );
  }

  const preview = op.preview;
  if (!preview || !op.unsigned_xdr) {
    return (
      <Screen header>
        {header}
        <Notice>This transaction is still being prepared. Close and try again in a moment.</Notice>
        {close}
      </Screen>
    );
  }

  const mismatch = !!wallet.data && wallet.data !== preview.signer;
  const unfunded = live && balance.data === null;
  const amount = formatTestnetXlm(preview.amount_base_units);

  const sign = async () => {
    if (signing.current) return;
    signing.current = true;
    setBusy('sign');
    setError(null);
    try {
      const signed = await signOperation(op.unsigned_xdr!, preview);
      await api(`/api/v1/operations/${op.id}/submit`, anyOk, { method: 'POST', body: { signed_xdr: signed } });
      settled.current = true;
      setSentId(op.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed. Nothing was sent.');
    } finally {
      signing.current = false;
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    try {
      await abandon(op.id);
      settled.current = true;
      await queryClient.invalidateQueries({ queryKey: ['award', id] });
      await queryClient.invalidateQueries({ queryKey: ['awards'] });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel. Try again.');
      setBusy(null);
    }
  };

  return (
    <Screen header>
      {header}
      {otherOpen ? (
        <Notice tone="warning">
          You already have this open transaction on the award. Sign or cancel it before starting another.
        </Notice>
      ) : null}
      <Body muted>Check this before you sign. Your phone signs exactly this Testnet transaction.</Body>
      <Card>
        {opAction === 'PAY' ? (
          <>
            <Row label="Pays" value={amount} />
            {preview.recipient ? <Row label="To wallet" value={preview.recipient} mono /> : null}
          </>
        ) : (
          <>
            {preview.evidence_revision ? <Row label="Evidence revision" value={String(preview.evidence_revision)} /> : null}
            <Row label="Award amount (not moved by this step)" value={amount} />
          </>
        )}
        <Row label="Maximum network fee" value={formatTestnetXlm(preview.maximum_fee_base_units)} />
        <Row label="Signs as" value={short(preview.signer)} mono />
        <Row label="Network" value="Stellar Testnet" />
      </Card>
      {preview.mode === 'fakerpc' ? (
        <Notice>Local test server: nothing is sent to the Stellar network.</Notice>
      ) : null}
      {!wallet.data ? (
        <Notice tone="warning">
          This phone has no wallet. Sign on the web with the award&apos;s wallet ({short(preview.signer)}).
        </Notice>
      ) : mismatch ? (
        <Notice tone="danger">
          This award is linked to wallet {short(preview.signer)}, but this phone&apos;s wallet is {short(wallet.data)}.
          Sign on the web with that wallet. Wallets cannot change after an award is deployed.
        </Notice>
      ) : unfunded ? (
        <Notice tone="warning">
          This wallet has no Testnet XLM for fees yet. Tap Get Testnet XLM on the Account tab.
        </Notice>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button
        title="Sign with this phone"
        hint="Unlocks your wallet with fingerprint or face unlock"
        disabled={!wallet.data || mismatch || unfunded || busy !== null}
        loading={busy === 'sign'}
        onPress={sign}
      />
      <Button
        title="Cancel transaction"
        variant="secondary"
        hint={opAction === 'APPROVE' ? 'Your approval note stays until you approve or request changes again' : undefined}
        loading={busy === 'cancel'}
        disabled={busy !== null}
        onPress={cancel}
      />
    </Screen>
  );
}
