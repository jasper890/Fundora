import type { z } from 'zod';

import { getAccessToken } from '@/lib/auth/session';
import { config } from '@/lib/config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const FALLBACK: Record<number, string> = {
  401: 'Your session ended. Sign in again.',
  403: 'You do not have access to this action.',
  404: 'Not found, or you no longer have access.',
  409: 'This award changed. Refresh and try again.',
  429: 'Too many attempts. Wait a few minutes and try again.',
  503: 'The service is busy right now. Nothing was changed. Try again in a minute.',
};

// Server codes that arrive without a message (chain preparation/submission); the rest fall back by HTTP status.
const CODES: Record<string, string> = {
  DEPLOYMENT_UNAVAILABLE: 'This award is not deployed on Testnet yet.',
  STALE_VERSION: 'This award changed. Refresh and try again.',
  STALE_EVIDENCE: 'The evidence changed since this was prepared. Refresh and try again.',
  STALE_REVIEW: 'The review changed since this was prepared. Refresh and try again.',
  MISSING_EVIDENCE: 'Upload evidence before submitting.',
  REVIEW_REQUIRED: 'Write your approval note again, then sign.',
  PREPARATION_FAILED: 'Could not prepare the transaction. Check that your wallet has Testnet XLM on the Account tab.',
  SOURCE_CHECK_REQUIRED: 'Confirm you checked the original source first.',
  DEADLINE: 'The deadline for this action has passed.',
  HELD: 'A hold blocks this action. Clear it on the website first.',
  INVALID_STATE: 'This action is not allowed in the award’s current status.',
  ACTION_DENIED: 'Your role or linked wallet cannot sign this action.',
  FORBIDDEN: 'Your role or linked wallet cannot sign this action.',
  UNRESOLVED_OPERATION: 'Another transaction on this award is still open.',
  PREPARATION_EXPIRED: 'This transaction expired. Cancel it and start again.',
  TRANSACTION_MISMATCH: 'The signed transaction did not match what was prepared. Nothing was sent.',
  INVALID_SIGNATURE: 'The signature was not accepted. Nothing was sent.',
  MODE_MISMATCH: 'This server runs in local test mode and does not accept real Testnet signatures. Nothing was sent.',
  RPC_UNAVAILABLE: 'Stellar Testnet is not reachable right now. Try again in a minute.',
  AWARD_STATE_OUT_OF_SYNC: 'Fundora and Testnet disagree about this award. Try again shortly.',
  VERIFIER_SYNC_REQUIRED: 'The verifier changed. The sponsor must finish that change on the website first.',
};

let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function send(path: string, init: RequestInit & { headers?: Record<string, string> }, token: string | null) {
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    // Cookie-less on purpose: the server honours a bearer token only when no cookie is sent.
    credentials: 'omit',
    headers: {
      ...init.headers,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/** JSON call to /api/v1 with the stored session; both server error shapes become ApiError. */
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  init: { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> } = {},
): Promise<T> {
  const request = {
    method: init.method ?? 'GET',
    headers: init.headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  };
  const useAuth = init.auth !== false;
  let response: Response;
  try {
    response = await send(path, request, useAuth ? await getAccessToken() : null);
    if (response.status === 401 && useAuth) {
      const fresh = await getAccessToken(true);
      if (fresh) response = await send(path, request, fresh);
    }
  } catch {
    throw new ApiError(0, 'NETWORK', 'No connection. Check your network and try again.');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && useAuth) onUnauthorized();
    throw toApiError(response.status, payload);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(response.status, 'BAD_RESPONSE', 'Unexpected server response. Update the app or try again.');
  }
  return parsed.data;
}

export function toApiError(status: number, payload: unknown): ApiError {
  const error = (payload as { error?: unknown } | null)?.error;
  const code = typeof error === 'string' ? error : ((error as { code?: string } | undefined)?.code ?? 'ERROR');
  const message =
    (typeof error === 'object' && (error as { message?: string } | null)?.message) ||
    CODES[code] ||
    FALLBACK[status] ||
    'Something went wrong. Try again.';
  return new ApiError(status, code, message);
}
