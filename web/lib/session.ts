import "server-only";
import { redirect } from "next/navigation";
import { loadAppUserByAuthId } from "./awards/queries";
import { createSupabaseServerClient } from "./supabase/server";
import type { AppUser } from "./types";

export async function getSessionUser(): Promise<AppUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return loadAppUserByAuthId(user.id);
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<AppUser> {
  const user = await getSessionUser();
  if (!user || !user.is_active) redirect("/");
  return user;
}
