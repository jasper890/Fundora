/**
 * Port of login throttle from proofpay/forms.py
 * HMAC(username.casefold() + NUL + ip) with AUTH_THROTTLE_SECRET.
 */
import { createHmac } from "node:crypto";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOGIN_FAILURES = 5;
export const THROTTLED_MESSAGE =
  "Too many failed attempts. Try again in 15 minutes.";
export const INVALID_LOGIN_MESSAGE = "Invalid username or password.";

export function accountIpDigest(
  username: string,
  remoteAddr: string,
  secret: string,
): string {
  const message = `${username.trim().toLowerCase()}\0${remoteAddr}`;
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

export type LoginAttemptRow = {
  account_ip_digest: string;
  window_started_at: Date;
  failed_attempts: number;
  last_attempt_at: Date;
  last_succeeded: boolean;
};

export type ThrottleDecision =
  | { ok: true; attempt: LoginAttemptRow }
  | { ok: false; code: "throttled"; message: string; attempt: LoginAttemptRow };

/** Pure decision helper used by the login route after loading/locking the row. */
export function evaluateThrottle(
  attempt: LoginAttemptRow | null,
  digest: string,
  now: Date,
): ThrottleDecision {
  const cutoff = new Date(now.getTime() - LOGIN_WINDOW_MS);
  let row: LoginAttemptRow =
    attempt ??
    ({
      account_ip_digest: digest,
      window_started_at: now,
      failed_attempts: 0,
      last_attempt_at: now,
      last_succeeded: false,
    } satisfies LoginAttemptRow);

  if (row.window_started_at <= cutoff) {
    row = {
      ...row,
      window_started_at: now,
      failed_attempts: 0,
    };
  }

  if (row.failed_attempts >= MAX_LOGIN_FAILURES) {
    return { ok: false, code: "throttled", message: THROTTLED_MESSAGE, attempt: row };
  }
  return { ok: true, attempt: row };
}

export function recordFailure(
  attempt: LoginAttemptRow,
  now: Date,
): LoginAttemptRow {
  return {
    ...attempt,
    failed_attempts: attempt.failed_attempts + 1,
    last_attempt_at: now,
    last_succeeded: false,
  };
}

export function recordSuccess(
  attempt: LoginAttemptRow,
  now: Date,
): LoginAttemptRow {
  return {
    ...attempt,
    failed_attempts: 0,
    last_attempt_at: now,
    last_succeeded: true,
  };
}
