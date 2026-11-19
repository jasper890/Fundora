import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Card, Pill, StatusPill } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import type { Award } from '@/lib/api/schemas';
import { nextStep } from '@/lib/format/next-step';
import { awardStatus } from '@/lib/format/status';

/** One award row; `subtitle` says whose award it is from the viewer's point of view. */
export function AwardCard({ award, subtitle }: { award: Award; subtitle: string }) {
  const theme = useTheme();
  const held = award.sponsor_hold || award.verifier_hold;
  const step = nextStep(award);
  return (
    <Card
      label={`${subtitle}, ${awardStatus(award.status).label}. Next: ${step.text}`}
      onPress={() => router.push(`/awards/${award.id}`)}>
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.pills}>
            <StatusPill status={award.status} />
            {held ? <Pill label="On hold" tone="warning" /> : null}
            {award.unresolved_operation ? <Pill label="Transaction pending" tone="warning" /> : null}
          </View>
          <Body>{subtitle}</Body>
          <Text style={[styles.next, { color: step.action ? theme.accent : theme.textSecondary }]}>
            {step.action ? 'Next: ' : ''}
            {step.text}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: theme.textSecondary }]} importantForAccessibility="no">
          ›
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  main: { flex: 1, gap: Spacing.two },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  next: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  chevron: { fontSize: 28, fontWeight: '300' },
});
