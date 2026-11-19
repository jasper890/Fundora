import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Heading, Loading, Notice, Pill, Row, Screen, StatusPill } from '@/components/ui';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useAward } from '@/hooks/use-awards';
import { config } from '@/lib/config';
import { previewEvidence } from '@/lib/evidence/drafts';
import { formatTestnetXlm } from '@/lib/format/amount';
import { formatDeadline, isPast, timeLeft } from '@/lib/format/date';
import { nextStep } from '@/lib/format/next-step';
import { remindBefore } from '@/lib/reminders';
import { useWalletAddress } from '@/screens/wallet-card';

const short = (wallet: string) => (wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-6)}` : wallet);

export default function AwardDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, isPending, isRefetching, refetch } = useAward(id);
  const wallet = useWalletAddress();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  if (isPending) return <Loading />;
  if (!data) {
    return (
      <Screen header title="Award">
        <Notice tone="danger">{error?.message ?? 'Award not found.'}</Notice>
      </Screen>
    );
  }

  const { award, program, evidence, notes } = data;
  const isRecipient = award.my_roles.includes('RECIPIENT');
  const isVerifier = award.my_roles.includes('VERIFIER');
  const latest = evidence[0];
  const open = award.status === 'FUNDED' || award.status === 'SUBMITTED';
  const claimOpen = !isPast(program.claim_deadline);
  const canAddEvidence =
    isRecipient && open && claimOpen && !award.verifier_sync_required && !award.unresolved_operation;
  const step = nextStep(award);
  const changeRequest =
    award.changes_requested && step.action === 'add-evidence' ? notes.find((n) => n.kind === 'REQUEST_CHANGES') : undefined;
  // The wallet the next signature must come from; a phone wallet that differs can never sign this award.
  const signer =
    step.action === 'review'
      ? award.verifier_member.public_wallet
      : step.sign === 'SUBMIT'
        ? award.recipient_member.public_wallet
        : step.sign === 'PAY'
          ? award.sponsor_member.public_wallet
          : null;
  const phoneCanSign = !signer || wallet.data === signer;
  const canRequestChanges = isVerifier && !!latest && award.status === 'SUBMITTED';
  // A dispute questions a review outcome, so it is offered only once review has started.
  const canDispute = isRecipient && !!latest && (award.status === 'SUBMITTED' || award.status === 'REJECTED');
  const reminder =
    isRecipient && open
      ? { label: 'submission', deadline: program.claim_deadline }
      : isVerifier && award.status === 'SUBMITTED'
        ? { label: 'review', deadline: program.review_deadline }
        : null;

  const openWeb = () => WebBrowser.openBrowserAsync(`${config.webBaseUrl}/awards/${award.id}`);
  const addEvidence = () => router.push(`/awards/${award.id}/evidence/new`);
  const requestChanges = () =>
    router.push({ pathname: '/awards/[id]/review', params: { id: award.id, action: 'REQUEST_CHANGES' } });
  const approve = () => router.push({ pathname: '/awards/[id]/review', params: { id: award.id, action: 'APPROVE' } });
  const sign = () =>
    router.push({ pathname: '/awards/[id]/sign', params: step.sign ? { id: award.id, action: step.sign } : { id: award.id } });

  const run = async (task: () => Promise<string>) => {
    setMessage(null);
    try {
      setMessage({ tone: 'success', text: await task() });
    } catch (e) {
      setMessage({ tone: 'danger', text: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  };

  return (
    <Screen header title={program.title} refreshing={isRefetching} onRefresh={refetch}>
      <View style={styles.pills}>
        <StatusPill status={award.status} />
        {award.sponsor_hold ? <Pill label="Sponsor hold" tone="warning" /> : null}
        {award.verifier_hold ? <Pill label="Verifier hold" tone="warning" /> : null}
      </View>

      <View
        accessibilityRole="summary"
        // Highlighted only when the user has something to do; waiting states stay quiet.
        style={[
          styles.next,
          step.action
            ? { backgroundColor: theme.accentSoft, borderColor: theme.accent }
            : { backgroundColor: theme.surface, borderColor: theme.line },
        ]}>
        <Body muted>Next step</Body>
        <Heading flush>{step.text}</Heading>
        {changeRequest ? <Body>&ldquo;{changeRequest.note}&rdquo; — {changeRequest.author_username}</Body> : null}
        {step.action === 'add-evidence' ? (
          <>
            <Body muted>
              Due {formatDeadline(program.claim_deadline)} · {timeLeft(program.claim_deadline)}
            </Body>
            {canAddEvidence ? <Button title="Add evidence" onPress={addEvidence} /> : null}
          </>
        ) : null}
        {signer && !phoneCanSign && !wallet.isPending ? (
          <Notice tone="warning">
            Signing needs this award&apos;s wallet {short(signer)}
            {wallet.data ? `, but this phone's wallet is ${short(wallet.data)}` : ', and this phone has no wallet'}. Sign
            on the web with that wallet. Wallets cannot change after an award is deployed.
          </Notice>
        ) : null}
        {step.action === 'review' ? (
          <>
            {phoneCanSign ? (
              <Button title="Approve" onPress={approve} hint="Then sign the approval with this phone's Testnet wallet" />
            ) : (
              <Button title="Approve on the web" onPress={openWeb} hint="Sign there with your Freighter wallet" />
            )}
            <Button title="Request changes" variant="secondary" onPress={requestChanges} />
          </>
        ) : null}
        {step.action === 'sign' && phoneCanSign ? (
          <Button
            title={
              step.sign === 'SUBMIT' ? 'Sign submission' : step.sign === 'PAY' ? 'Sign payment release' : 'Check transaction'
            }
            onPress={sign}
            hint={step.sign ? "Signed with this phone's Testnet wallet" : undefined}
          />
        ) : null}
        {step.action === 'web' || (step.action === 'sign' && !phoneCanSign) ? (
          <Button title="Continue on the web" onPress={openWeb} hint="Sign there with your Freighter wallet" />
        ) : null}
      </View>

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <Card>
        <Row label="Amount" value={formatTestnetXlm(data.amount_base_units)} />
        <Row label="Recipient" value={award.recipient_username} />
        <Row label="Payment goes to" value={award.recipient_member.public_wallet} mono />
        <Row label="Sponsor wallet" value={short(award.sponsor_member.public_wallet)} mono />
        <Row label="Verifier wallet" value={short(award.verifier_member.public_wallet)} mono />
      </Card>

      <Heading>Requirement</Heading>
      <Body>{program.requirements_text}</Body>

      <Heading>Deadlines</Heading>
      <Card>
        <Row
          label={`Submission deadline · ${timeLeft(program.claim_deadline)}`}
          value={formatDeadline(program.claim_deadline)}
        />
        <Row
          label={`Review deadline · ${timeLeft(program.review_deadline)}`}
          value={formatDeadline(program.review_deadline)}
        />
        <Row
          label={`Payout deadline · ${timeLeft(program.payout_deadline)}`}
          value={formatDeadline(program.payout_deadline)}
        />
      </Card>
      <Body muted>After the payout deadline, the sponsor can reclaim an unpaid award, even when it is on hold.</Body>

      <Heading>Evidence</Heading>
      {evidence.length === 0 ? <Notice>No evidence uploaded yet.</Notice> : null}
      {evidence.map((version) => (
        <Card key={version.id}>
          <Body>
            Revision {version.revision} · {formatDeadline(version.created_at)}
          </Body>
          <Body>{version.explanation}</Body>
          <Body muted>Source: {version.source_ref}</Body>
          {version.files.map((file) => (
            <Button
              key={file.id}
              title={`Open ${file.filename}`}
              variant="secondary"
              onPress={() =>
                run(async () => {
                  await previewEvidence(file.id, file.filename, file.content_type);
                  return 'Opened privately on this phone.';
                })
              }
            />
          ))}
        </Card>
      ))}
      {canAddEvidence && step.action !== 'add-evidence' ? (
        <Button title="Add a new evidence revision" variant="secondary" onPress={addEvidence} />
      ) : null}

      {notes.length > 0 ? (
        <>
          <Heading>Change requests and disputes</Heading>
          {notes.map((note) => (
            <Card key={note.id}>
              <Body>
                {note.kind === 'REQUEST_CHANGES' ? 'Changes requested' : 'Review of a decision requested'} ·{' '}
                {note.author_username}
              </Body>
              <Body muted>
                About revision {note.evidence_revision} · {formatDeadline(note.created_at)}
              </Body>
              <Body>{note.note}</Body>
              {note.source_check ? <Body muted>Checked: {note.source_check}</Body> : null}
            </Card>
          ))}
          <Body muted>Only this award&apos;s sponsor, verifier and recipient see these notes.</Body>
        </>
      ) : null}

      <Heading>More</Heading>
      {reminder ? (
        <Button
          title={`Remind me a day before the ${reminder.label} deadline`}
          variant="secondary"
          onPress={() =>
            run(async () => {
              const at = await remindBefore(
                award.id,
                reminder.label,
                `${program.title}: ${reminder.label} deadline`,
                reminder.deadline,
              );
              return `Reminder set for ${formatDeadline(at.toISOString())}.`;
            })
          }
        />
      ) : null}
      {canRequestChanges && step.action !== 'review' ? (
        <Button title="Request changes" variant="secondary" onPress={requestChanges} />
      ) : null}
      {canDispute ? (
        <Button
          title="Ask for a review of a decision"
          variant="secondary"
          onPress={() => router.push({ pathname: '/awards/[id]/review', params: { id: award.id, action: 'DISPUTE' } })}
        />
      ) : null}
      {step.action !== 'web' ? (
        <Button
          title="Open this award on the web"
          variant="secondary"
          hint="Funding, holds and rejections are done on the website"
          onPress={openWeb}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  next: { borderWidth: 1.5, borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two },
});
