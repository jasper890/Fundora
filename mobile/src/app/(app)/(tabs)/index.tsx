import { Redirect } from 'expo-router';

import { Body, Heading, Loading, Notice, Screen } from '@/components/ui';
import { useAwards } from '@/hooks/use-awards';
import { useSession } from '@/hooks/use-session';
import { formatTestnetXlm } from '@/lib/format/amount';
import { awardStatus } from '@/lib/format/status';
import { AwardCard } from '@/screens/award-card';

export default function AwardsScreen() {
  const { user } = useSession();
  const { data, error, isPending, isRefetching, refetch } = useAwards();
  const roles = user?.memberships.map((m) => m.role) ?? [];
  if (!roles.includes('RECIPIENT') && !roles.includes('SPONSOR') && roles.includes('VERIFIER')) {
    return <Redirect href="/reviews" />;
  }
  if (isPending) return <Loading />;

  const awards = data?.awards ?? [];
  const mine = awards.filter((a) => a.my_roles.includes('RECIPIENT'));
  const sponsored = awards.filter((a) => a.my_roles.includes('SPONSOR'));
  const programTitle = (id: string) => user?.memberships.find((m) => m.program_id === id)?.title ?? 'Program';
  const programs = [...new Set(sponsored.map((a) => a.program_id))];

  return (
    <Screen title="Awards" refreshing={isRefetching} onRefresh={refetch}>
      {error ? <Notice tone="danger">{error.message}</Notice> : null}
      {data ? <Body muted>Each award is {formatTestnetXlm(data.amount_base_units)}.</Body> : null}

      {mine.length > 0 ? <Heading>Your awards</Heading> : null}
      {mine.map((a) => (
        <AwardCard key={a.id} award={a} subtitle={programTitle(a.program_id)} />
      ))}

      {programs.map((programId) => {
        const list = sponsored.filter((a) => a.program_id === programId);
        const counts = Object.entries(
          list.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.status]: (acc[a.status] ?? 0) + 1 }), {}),
        )
          .map(([status, n]) => `${n} ${awardStatus(status).label.toLowerCase()}`)
          .join(' · ');
        return [
          <Heading key={`h-${programId}`}>{programTitle(programId)}</Heading>,
          <Body key={`c-${programId}`} muted>
            You sponsor {list.length} award{list.length === 1 ? '' : 's'}: {counts}
          </Body>,
          ...list.map((a) => <AwardCard key={a.id} award={a} subtitle={a.recipient_username} />),
        ];
      })}

      {!error && mine.length === 0 && sponsored.length === 0 ? (
        <Notice>
          {roles.includes('SPONSOR')
            ? 'No awards in your programs yet. Create awards on the web.'
            : 'No awards yet. When a sponsor enrolls you, your award appears here.'}
          {awards.length > 0 ? ' Awards you review are in the Reviews tab.' : ''}
        </Notice>
      ) : null}
    </Screen>
  );
}
