import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/http";
import { createSupabaseTokenClient } from "@/lib/supabase/server";

const Body = z.object({ refresh_token: z.string().min(1).max(512) }).strict();

/**
 * Native-app token rotation, so the app needs no Supabase URL or key of its own.
 * Native requests carry neither Origin nor cookies; anything else is a browser and is refused.
 */
export async function POST(request: Request) {
  if (process.env.MOBILE_BEARER_AUTH !== "1") return jsonError("NOT_FOUND", 404);
  if (request.headers.has("origin") || request.headers.has("cookie")) {
    return jsonError("ORIGIN_MISMATCH", 403, "Origin not allowed.");
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400, "Invalid refresh request.");

  const { data, error } = await createSupabaseTokenClient().auth.refreshSession({
    refresh_token: parsed.data.refresh_token,
  });
  if (error || !data.session) return jsonError("SESSION_EXPIRED", 401, "Your session ended. Sign in again.");
  return jsonOk({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });
}
