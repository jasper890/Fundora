import { z } from "zod";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Body = z
  .object({
    current_password: z.string().min(1).max(128),
    new_password: z.string().min(8).max(128),
    confirm_password: z.string().min(8).max(128),
  })
  .strict();

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.new_password !== parsed.data.confirm_password) {
    return jsonError("INVALID_BODY", 400, "Check the password fields and try again.");
  }
  if (parsed.data.current_password === parsed.data.new_password) {
    return jsonError("PASSWORD_UNCHANGED", 400, "Choose a different password.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const profile = await loadAppUserByAuthId(user.id, { allowMustChangePassword: true });
  if (!profile) return jsonError("UNAUTHENTICATED", 401);
  if (!user.email) {
    return jsonError("PASSWORD_REJECTED", 400, "The current password is incorrect or the new password was rejected.");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (verifyError) {
    return jsonError("PASSWORD_REJECTED", 400, "The current password is incorrect or the new password was rejected.");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) {
    return jsonError("PASSWORD_REJECTED", 400, "The current password is incorrect or the new password was rejected.");
  }

  try {
    const db = sql();
    await db`update app_user set must_change_password = false where id = ${user.id}`;
  } catch {
    // Keep the account gated if profile persistence fails; retry with the new current password.
    return jsonError("PROFILE_UPDATE_FAILED", 503, "Password changed, but account setup is still pending. Sign in again and retry.");
  }

  return jsonOk({ password_changed: true });
}
