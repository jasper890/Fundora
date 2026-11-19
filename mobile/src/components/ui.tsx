import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, toneColors, useTheme } from '@/constants/theme';
import { awardStatus, type Tone } from '@/lib/format/status';

/** Shown on every screen (A10). */
export function TestnetBanner() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Testnet only. Testnet XLM has no real monetary value."
      style={[styles.banner, { backgroundColor: theme.coralSoft }]}>
      <Text style={[styles.bannerText, { color: theme.coral }]}>Testnet XLM — no real monetary value</Text>
    </View>
  );
}

/**
 * Scrollable screen body with the Testnet banner, optional large title and pull-to-refresh.
 * `header`: the screen sits under a native stack header, which already clears the status bar.
 */
export function Screen({
  title,
  children,
  refreshing,
  onRefresh,
  header = false,
}: {
  title?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentInsetAdjustmentBehavior={header ? 'automatic' : 'never'}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.screen, !header && { paddingTop: insets.top + Spacing.two }]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={theme.accent} /> : undefined
      }>
      <TestnetBanner />
      {title ? (
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, onPress, label }: { children: ReactNode; onPress?: () => void; label?: string }) {
  const theme = useTheme();
  const style = [styles.card, { backgroundColor: theme.surface, borderColor: theme.line }];
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [...style, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

/** `flush`: no top margin, for a heading inside a card. */
export function Heading({ children, flush }: { children: ReactNode; flush?: boolean }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }, flush && { marginTop: 0 }]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, mono }: { children: ReactNode; muted?: boolean; mono?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      selectable={mono}
      style={[styles.body, { color: muted ? theme.textSecondary : theme.text }, mono && { fontFamily: Fonts?.mono }]}>
      {children}
    </Text>
  );
}

export function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Body muted>{label}</Body>
      <Body mono={mono}>{value}</Body>
    </View>
  );
}

export function Pill({ label, tone }: { label: string; tone: Tone }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = awardStatus(status);
  return <Pill label={s.label} tone={s.tone} />;
}

export function Notice({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const theme = useTheme();
  const c = toneColors(theme, tone);
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'text'}
      style={[styles.notice, { backgroundColor: c.bg, borderColor: tone === 'neutral' ? theme.line : c.bg }]}>
      <Text style={[styles.body, { color: tone === 'neutral' ? theme.text : c.fg }]}>{children}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  hint,
  label,
  compact,
  grow,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  hint?: string;
  /** Spoken name when the visible title is short ("Remove" → "Remove photo-1.jpg"). */
  label?: string;
  /** Smaller inline button; still a 44 pt touch target. */
  compact?: boolean;
  /** Share a row equally with sibling buttons. */
  grow?: boolean;
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const fg = primary ? theme.onAccent : variant === 'danger' ? theme.danger : theme.accent;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        grow && styles.grow,
        primary
          ? { backgroundColor: theme.accent }
          : { backgroundColor: theme.surface, borderColor: variant === 'danger' ? theme.danger : theme.line, borderWidth: 1 },
        (pressed || inactive) && { opacity: inactive ? 0.5 : 0.8 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  max,
  value,
  ...input
}: TextInputProps & { label: string; error?: string; max?: number; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        value={value}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.line },
          input.multiline && styles.multiline,
        ]}
        {...input}
      />
      <View style={styles.fieldFoot}>
        {error ? <Text style={[styles.small, { color: theme.danger }]}>{error}</Text> : <View />}
        {max ? (
          <Text style={[styles.small, { color: value.length > max ? theme.danger : theme.textSecondary }]}>
            {value.length}/{max}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.loading, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.two }]}>
      <TestnetBanner />
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} accessibilityLabel="Loading" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six * 2 },
  banner: { borderRadius: Radius.small, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  bannerText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  title: { fontSize: 32, fontWeight: '700', marginTop: Spacing.two, fontFamily: Fonts?.serif },
  heading: { fontSize: 20, fontWeight: '700', marginTop: Spacing.three },
  body: { fontSize: 16, lineHeight: 22 },
  small: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.four, gap: Spacing.two },
  row: { gap: 2 },
  pill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  pillText: { fontSize: 13, fontWeight: '700' },
  notice: { borderWidth: 1, borderRadius: Radius.small, padding: Spacing.three },
  button: {
    minHeight: 48,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  compact: { minHeight: 44, paddingHorizontal: Spacing.three, alignSelf: 'center' },
  grow: { flex: 1, paddingHorizontal: Spacing.two },
  buttonText: { fontSize: 16, fontWeight: '700' },
  field: { gap: Spacing.one },
  label: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: Radius.small, minHeight: 48, paddingHorizontal: Spacing.three, fontSize: 16 },
  multiline: { minHeight: 110, paddingTop: Spacing.three, textAlignVertical: 'top' },
  fieldFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  loading: { flex: 1, padding: Spacing.four },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
