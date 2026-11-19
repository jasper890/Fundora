import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';

const RELOCK_AFTER_MS = 5 * 60 * 1000;

async function canAuthenticate() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

/**
 * Covers the app while it is in the background (keeps evidence out of the app-switcher snapshot)
 * and asks for Face ID / fingerprint / passcode after five minutes away. A native Modal, so it also
 * covers screens presented as modals.
 */
export function PrivacyLock() {
  const theme = useTheme();
  const { status } = useSession();
  const [covered, setCovered] = useState(false);
  const [locked, setLocked] = useState(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') {
        setCovered(true);
        leftAt.current ??= Date.now();
        return;
      }
      const away = leftAt.current ? Date.now() - leftAt.current : 0;
      leftAt.current = null;
      // Decide on the lock before uncovering, so content never flashes.
      if (status === 'signed-in' && away > RELOCK_AFTER_MS && (await canAuthenticate())) setLocked(true);
      setCovered(false);
    });
    return () => sub.remove();
  }, [status]);

  const unlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Fundora' });
    if (result.success) setLocked(false);
  };

  const visible = status === 'signed-in' && (covered || locked);
  return (
    <Modal visible={visible} animationType="none" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={[styles.cover, { backgroundColor: theme.background }]}>
        <Text style={[styles.brand, { color: theme.accent }]}>Fundora</Text>
        {locked ? <Button title="Unlock" onPress={unlock} /> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cover: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.five, padding: Spacing.six },
  brand: { fontSize: 28, fontWeight: '700' },
});
