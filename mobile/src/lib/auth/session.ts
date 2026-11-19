import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

import { config } from '@/lib/config';

// Stored as separate Keychain/Keystore items: each stays well under SecureStore's per-item size limit.
const ACCESS = 'fundora.access_token';
const REFRESH = 'fundora.refresh_token';
const EXPIRES = 'fundora.expires_at';

const tokensSchema = z.object({ access_token: z.string(), refresh_token: z.string(), expires_at: z.number() });
export type Tokens = z.infer<typeof tokensSchema>;

export async function saveTokens(tokens: Tokens) {
  await SecureStore.setItemAsync(ACCESS, tokens.access_token);
  await SecureStore.setItemAsync(REFRESH, tokens.refresh_token);
  await SecureStore.setItemAsync(EXPIRES, String(tokens.expires_at));
}

// shortcut: tokens are only deleted on the phone; the refresh token stays valid server-side until
// Supabase expires it. Add a bearer logout route if stolen-phone revocation is needed.
export async function clearTokens() {
  await Promise.all([ACCESS, REFRESH, EXPIRES].map((key) => SecureStore.deleteItemAsync(key)));
}

let refreshing: Promise<string | null> | null = null;

/** Valid access token, refreshed a minute before expiry. Null means signed out. */
export async function getAccessToken(force = false): Promise<string | null> {
  const [access, expires] = await Promise.all([
    SecureStore.getItemAsync(ACCESS),
    SecureStore.getItemAsync(EXPIRES),
  ]);
  if (!access) return null;
  if (!force && Number(expires) - 60 > Date.now() / 1000) return access;
  // One refresh at a time: refresh tokens rotate, so parallel refreshes would revoke each other.
  refreshing ??= refresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function refresh(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH);
  if (!refreshToken) return null;
  const response = await fetch(`${config.apiBaseUrl}/api/v1/session/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
    credentials: 'omit',
  }).catch(() => null);
  if (!response?.ok) {
    // A rejected refresh token ends the session; a network failure keeps it for a later retry.
    if (response?.status === 401) await clearTokens();
    return null;
  }
  const tokens = tokensSchema.safeParse(await response.json().catch(() => null));
  if (!tokens.success) return null;
  await saveTokens(tokens.data);
  return tokens.data.access_token;
}
