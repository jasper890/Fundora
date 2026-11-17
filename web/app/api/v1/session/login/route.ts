import { z } from "zod";
import {
  accountIpDigest,
  evaluateThrottle,
  INVALID_LOGIN_MESSAGE,
  recordFailure,
  recordSuccess,
  THROTTLED_MESSAGE,
} from "@/lib/auth/throttle";
import { clientIp, jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sql } from "@/lib/db";

const Body = z
  .object({
    username: z.string().min(1).max(150),
    password: z.string().min(1).max(128),
  })
  .strict();

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return jsonError("ORIGIN_MISMATCH", 403, "Origin not allowed.");
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("INVALID_BODY", 400, INVALID_LOGIN_MESSAGE);
  }

  const secret = process.env.AUTH_THROTTLE_SECRET;
  if (!secret) {
    return jsonError("SERVER_MISCONFIGURED", 500, "Server misconfigured.");
  }

  const now = new Date();
  const digest = accountIpDigest(
    parsed.data.username,
    clientIp(request),
    secret,
  );
  const db = sql();

  const rows = (await db`
    select * from login_attempt where account_ip_digest = ${digest}
  `) as unknown as {
    account_ip_digest: string;
    window_started_at: Date;
    failed_attempts: number;
    last_attempt_at: Date;
    last_succeeded: boolean;
  }[];

  const decision = evaluateThrottle(rows[0] ?? null, digest, now);
  if (!decision.ok) {
    return jsonError("RATE_LIMITED", 429, THROTTLED_MESSAGE);
  }

  const profile = (await db`
    select id, username, is_active from app_user
    where lower(username) = ${parsed.data.username.trim().toLowerCase()}
    limit 1
  `) as unknown as { id: string; username: string; is_active: boolean }[];

  const user = profile[0];
  const email = user
    ? `${user.username}@users.proofpay.local`
    : `${parsed.data.username.trim().toLowerCase()}@users.proofpay.local`;

  async function persistAttempt(
    attempt: typeof decision.attempt,
  ): Promise<void> {
    await db`
      insert into login_attempt (
        account_ip_digest, window_started_at, failed_attempts, last_attempt_at, last_succeeded
      ) values (
        ${attempt.account_ip_digest},
        ${attempt.window_started_at},
        ${attempt.failed_attempts},
        ${attempt.last_attempt_at},
        ${attempt.last_succeeded}
      )
      on conflict (account_ip_digest) do update set
        window_started_at = excluded.window_started_at,
        failed_attempts = excluded.failed_attempts,
        last_attempt_at = excluded.last_attempt_at,
        last_succeeded = excluded.last_succeeded
    `;
  }

  if (!user || !user.is_active) {
    await persistAttempt(recordFailure(decision.attempt, now));
    return jsonError("INVALID_LOGIN", 400, INVALID_LOGIN_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    await persistAttempt(recordFailure(decision.attempt, now));
    return jsonError("INVALID_LOGIN", 400, INVALID_LOGIN_MESSAGE);
  }

  await persistAttempt(recordSuccess(decision.attempt, now));
  return jsonOk({ authenticated: true, username: user.username });
}
