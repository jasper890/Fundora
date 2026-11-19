import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setUnauthorizedHandler } from '@/lib/api/client';
import { loginSchema, sessionSchema, type SessionInfo } from '@/lib/api/schemas';
import { clearTokens, getAccessToken, saveTokens } from '@/lib/auth/session';
import { clearAllLocalEvidence } from '@/lib/evidence/drafts';

type SignInResult = 'ok' | 'password-change-required';

type SessionState = {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: SessionInfo | null;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SessionState['status']>('loading');
  const [user, setUser] = useState<SessionInfo | null>(null);

  const loadUser = useCallback(async () => {
    const session = await api('/api/v1/session', sessionSchema);
    if (!session.authenticated) throw new Error('signed out');
    setUser(session);
    setStatus('signed-in');
  }, []);

  /** Session ended by the server (401): back to sign-in, but keep evidence drafts for the retry. */
  const expire = useCallback(async () => {
    await clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus('signed-out');
  }, [queryClient]);

  /** Explicit sign-out also wipes drafts, viewed evidence and reminders from this phone. */
  const signOut = useCallback(async () => {
    await expire();
    clearAllLocalEvidence();
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  }, [expire]);

  useEffect(() => {
    setUnauthorizedHandler(() => void expire());
    (async () => {
      try {
        if (!(await getAccessToken())) throw new Error('no session');
        await loadUser();
      } catch {
        setStatus('signed-out');
      }
    })();
  }, [loadUser, expire]);

  const signIn = useCallback(
    async (username: string, password: string): Promise<SignInResult> => {
      const result = await api('/api/v1/session/login', loginSchema, {
        method: 'POST',
        auth: false,
        body: { username: username.trim(), password, client: 'mobile' },
      });
      // The server keeps first-login accounts gated until the password is changed on the web.
      if (result.password_change_required) return 'password-change-required';
      if (!result.access_token || !result.refresh_token || !result.expires_at) {
        throw new Error('Mobile sign-in is not enabled on this server.');
      }
      await saveTokens({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
      });
      await loadUser();
      return 'ok';
    },
    [loadUser],
  );

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionState {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
