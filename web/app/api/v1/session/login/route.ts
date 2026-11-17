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
  const reservation = await db.begin(async (tx) => {
    await tx`
      insert into login_attempt (
        account_ip_digest, window_started_at, failed_attempts, last_attempt_at, last_succeeded
      ) values (${digest}, ${now}, 0, ${now}, false)
      on conflict (account_ip_digest) do nothing
    `;
    const rows = (await tx`
      select * from login_attempt where account_ip_digest = ${digest} for update
    `) as unknown as {
      account_ip_digest: string;
      window_started_at: Date;
      failed_attempts: number;
      last_attempt_at: Date;
      last_succeeded: boolean;
    }[];
    const decision = evaluateThrottle(rows[0] ?? null, digest, now);
    if (!decision.ok) return { ok: false as const };
    const reserved = recordFailure(decision.attempt, now);
    await tx`
      update login_attempt set
        window_started_at = ${reserved.window_started_at},
        failed_attempts = ${reserved.failed_attempts},
        last_attempt_at = ${reserved.last_attempt_at},
        last_succeeded = false
      where account_ip_digest = ${digest}
    `;
    return { ok: true as const, attempt: reserved };
  });
  if (!reservation.ok) {
    return jsonError("RATE_LIMITED", 429, THROTTLED_MESSAGE);
  }

  const profile = (await db`
    select id, username, is_active, must_change_password from app_user
    where lower(username) = ${parsed.data.username.trim().toLowerCase()}
    limit 1
  `) as unknown as {
    id: string;
    username: string;
    is_active: boolean;
    must_change_password: boolean;
  }[];

  const user = profile[0];
  const email = user
    ? `${user.username}@users.proofpay.local`
    : `${parsed.data.username.trim().toLowerCase()}@users.proofpay.local`;

  if (!user || !user.is_active) {
    return jsonError("INVALID_LOGIN", 400, INVALID_LOGIN_MESSAGE);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return jsonError("INVALID_LOGIN", 400, INVALID_LOGIN_MESSAGE);
  }

  const success = recordSuccess(reservation.attempt, new Date());
  await db`
    update login_attempt set
      window_started_at = ${success.window_started_at},
      failed_attempts = 0,
      last_attempt_at = ${success.last_attempt_at},
      last_succeeded = true
    where account_ip_digest = ${digest}
  `;
  return jsonOk({
    authenticated: true,
    username: user.username,
    password_change_required: user.must_change_password,
  });
}
