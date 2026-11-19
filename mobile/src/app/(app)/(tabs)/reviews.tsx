import { Heading, Loading, Notice, Screen } from '@/components/ui';
import { useAwards } from '@/hooks/use-awards';
import { nextStep } from '@/lib/format/next-step';
import { AwardCard } from '@/screens/award-card';

export default function ReviewsScreen() {
  const { data, error, isPending, isRefetching, refetch } = useAwards();
  if (isPending) return <Loading />;

  const assigned = (data?.awards ?? []).filter((a) => a.my_roles.includes('VERIFIER'));
  // Same rule as the award's own next step, so the queue never lists an award that says "waiting".
  const waiting = assigned.filter((a) => nextStep(a).action === 'review');
  const rest = assigned.filter((a) => !waiting.includes(a));

  return (
    <Screen title="Reviews" refreshing={isRefetching} onRefresh={refetch}>
      {error ? <Notice tone="danger">{error.message}</Notice> : null}
      <Heading>Waiting for your review</Heading>
      {!error && waiting.length === 0 ? <Notice>Nothing is waiting for you right now.</Notice> : null}
      {waiting.map((a) => (
        <AwardCard key={a.id} award={a} subtitle={a.recipient_username} />
      ))}
      {rest.length > 0 ? <Heading>Other assigned awards</Heading> : null}
      {rest.map((a) => (
        <AwardCard key={a.id} award={a} subtitle={a.recipient_username} />
      ))}
    </Screen>
  );
}
