import { jsonOk, requireSameOrigin, jsonError } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!requireSameOrigin(request)) {
    return jsonError("ORIGIN_MISMATCH", 403, "Origin not allowed.");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return jsonOk({ authenticated: false });
}
