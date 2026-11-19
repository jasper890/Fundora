import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Field, Notice, Screen } from '@/components/ui';
import { Spacing, useTheme } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { config } from '@/lib/config';

export default function SignInScreen() {
  const theme = useTheme();
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNeedsSetup(false);
    try {
      if ((await signIn(username, password)) === 'password-change-required') setNeedsSetup(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <Screen>
      <View style={styles.brand}>
        <Image
          source={require('@/assets/images/mark.png')}
          style={styles.mark}
          contentFit="contain"
          accessibilityLabel="Fundora"
        />
        <View>
          <Text style={[styles.name, { color: theme.text }]}>Fundora</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>Open. Verify. Transact.</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Sign in
      </Text>
      <Body muted>Use the Fundora account your program administrator gave you.</Body>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {needsSetup ? (
        <>
          <Notice tone="warning">
            Your account needs a new password before first use. Finish setup on the Fundora website, then sign in here.
          </Notice>
          <Button
            title="Finish setup on the web"
            variant="secondary"
            onPress={() => WebBrowser.openBrowserAsync(`${config.webBaseUrl}/login`)}
          />
        </>
      ) : null}
      <Field
        label="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => username.trim() && password && !busy && submit()}
      />
      <Button title="Sign in" onPress={submit} loading={busy} disabled={!username.trim() || !password} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.five },
  mark: { width: 56, height: 46 },
  name: { fontSize: 22, fontWeight: '700' },
  tagline: { fontSize: 14 },
  title: { fontSize: 28, fontWeight: '700', marginTop: Spacing.four },
});
