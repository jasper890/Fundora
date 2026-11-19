import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Body, Button, Field, Loading, Notice, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useAward } from '@/hooks/use-awards';
import { api } from '@/lib/api/client';
import { anyOk } from '@/lib/api/schemas';

const COPY = {
  APPROVE: {
    title: 'Approve',
    intro:
      "Approve only after you checked the original source. Next you sign the approval with this phone's Testnet wallet. The sponsor then releases payment.",
    field: 'Why is this approved?',
  },
  REQUEST_CHANGES: {
    title: 'Request changes',
    intro:
      'Tell the recipient what to fix. They see this note on the award, and so does the sponsor. It does not change the award on-chain.',
    field: 'What needs to change?',
  },
  DISPUTE: {
    title: 'Ask for a review',
    intro:
      'Explain why a decision should be looked at again. Only the sponsor and verifier of this award see it. It does not pause or block payment.',
    field: 'What should be reviewed?',
  },
} as const;

export default function ReviewNoteScreen() {
  const { id, action } = useLocalSearchParams<{ id: string; action: keyof typeof COPY }>();
  const queryClient = useQueryClient();
  const { data } = useAward(id);
  const [rationale, setRationale] = useState('');
  const [sourceCheck, setSourceCheck] = useState('');
  const [sourceConfirmed, setSourceConfirmed] = useState(false);
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[action];
  if (!copy) {
    return (
      <Screen header>
        <Notice tone="danger">Unknown action.</Notice>
        <Button title="Close" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!data) return <Loading />;
  const latest = data.evidence[0];
  if (!latest) {
    return (
      <Screen header>
        <Notice>There is no evidence to comment on yet.</Notice>
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/awards/${id}/review`, anyOk, {
        method: 'POST',
        body: {
          evidence_id: latest.id,
          action,
          rationale: rationale.trim(),
          expected_version: data.award.version,
          ...(action !== 'DISPUTE' && sourceCheck.trim() ? { source_check_method: sourceCheck.trim() } : {}),
          ...(action === 'APPROVE' ? { source_confirmed: sourceConfirmed } : {}),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['award', id] });
      // The approval note is only a request; it takes effect once the verifier wallet signs it.
      if (action === 'APPROVE') router.replace({ pathname: '/awards/[id]/sign', params: { id, action: 'APPROVE' } });
      else router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header>
      <Stack.Screen options={{ title: copy.title }} />
      <Body muted>{copy.intro}</Body>
      <Body muted>About evidence revision {latest.revision}.</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Field label={copy.field} value={rationale} onChangeText={setRationale} multiline max={2000} />
      {action === 'APPROVE' ? (
        <>
          <Field
            label="How did you check the original source?"
            placeholder="e.g. Compared with the organizer's attendance sheet"
            value={sourceCheck}
            onChangeText={setSourceCheck}
            max={512}
          />
          <View style={styles.switchRow}>
            <Switch
              value={sourceConfirmed}
              onValueChange={setSourceConfirmed}
              trackColor={{ true: theme.accent }}
              accessibilityLabel="I checked the original source"
            />
            <Body>I checked the original source</Body>
          </View>
        </>
      ) : null}
      {action === 'REQUEST_CHANGES' ? (
        <Field
          label="What did you check? (optional)"
          placeholder="e.g. Compared with the organizer's attendance sheet"
          value={sourceCheck}
          onChangeText={setSourceCheck}
          max={512}
        />
      ) : null}
      <Button
        title={action === 'APPROVE' ? 'Continue to sign' : 'Send'}
        onPress={submit}
        loading={busy}
        disabled={
          !rationale.trim() ||
          rationale.length > 2000 ||
          sourceCheck.length > 512 ||
          (action === 'APPROVE' && (!sourceCheck.trim() || !sourceConfirmed))
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
