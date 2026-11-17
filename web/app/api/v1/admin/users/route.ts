import { z } from "zod";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { loadAppUserByAuthId } from "@/lib/awards/queries";

const Body = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/),
  temporary_password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
}).strict();

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const staff = user && await loadAppUserByAuthId(user.id);
  if (!staff?.is_active) return jsonError("UNAUTHENTICATED", 401);
  if (!staff.is_staff) return jsonError("FORBIDDEN", 403);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("INVALID_BODY", 400, "Use a valid username and a temporary password of at least 12 characters with upper/lowercase letters and a number.");
  const admin = createSupabaseAdmin();
  const created = await admin.auth.admin.createUser({
    email: `${body.data.username}@users.proofpay.local`, password: body.data.temporary_password,
    email_confirm: true, user_metadata: { username: body.data.username },
  });
  if (created.error || !created.data.user) return jsonError("ACCOUNT_NOT_CREATED", 409, "The username is unavailable or account creation was rejected.");
  const id = created.data.user.id;
  try {
    const db = sql();
    await db`insert into app_user (id, username, is_staff, is_active, must_change_password)
      values (${id}, ${body.data.username}, false, true, true)`;
  } catch (error) {
    const cleanup = await admin.auth.admin.deleteUser(id).catch(() => ({ error: true }));
    if (cleanup.error) return jsonError("PROVISIONING_INCOMPLETE", 503, "Account setup did not finish. An administrator must reconcile the account before retrying.");
    return jsonError((error as { code?: string }).code === "23505" ? "USERNAME_UNAVAILABLE" : "ACCOUNT_NOT_CREATED", (error as { code?: string }).code === "23505" ? 409 : 503);
  }
  return jsonOk({ id, username: body.data.username, must_change_password: true }, 201);
}
