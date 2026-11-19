import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { bearerToken } from "@/lib/http";

/** Cookie-less Supabase client for native-app login and bearer-token checks. */
export function createSupabaseTokenClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase public env vars are not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Auth user from a mobile bearer token, else from the browser session cookie. */
export async function getRequestAuthUser(request: Request): Promise<User | null> {
  const token = bearerToken(request);
  const { data } = token
    ? await createSupabaseTokenClient().auth.getUser(token)
    : await (await createSupabaseServerClient()).auth.getUser();
  return data.user ?? null;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase public env vars are not configured");
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — proxy will refresh.
        }
      },
    },
  });
}
