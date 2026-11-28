import "server-only";
import { redirect } from "next/navigation";
import { loadAppUserByAuthId } from "./awards/queries";
import { createSupabaseServerClient } from "./supabase/server";
import type { AppUser } from "./types";

export async function getSessionUser(
  options: { allowMustChangePassword?: boolean } = {},
): Promise<AppUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return loadAppUserByAuthId(user.id, options);
  } catch {
    return null;
  }
}

export async function requireSessionUser(
  options: { allowMustChangePassword?: boolean } = {},
): Promise<AppUser> {
  const user = await getSessionUser({ allowMustChangePassword: true });
  if (!user || !user.is_active) redirect("/enter");
  if (user.must_change_password && !options.allowMustChangePassword) {
    redirect("/password-change");
  }
  return user;
}
