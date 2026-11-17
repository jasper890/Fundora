import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id } = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  const rows = (await db`
    select id, status, error_code, confirmed_ledger, preview, action, award_id
    from chain_operation
    where id = ${id}
      and actor_id = ${appUser.id}
    limit 1
  `) as unknown as Record<string, unknown>[];
  const op = rows[0];
  if (!op) return jsonError("NOT_FOUND", 404);

  return jsonOk({
    id: op.id,
    status: op.status,
    error_code: op.error_code || null,
    confirmed_ledger: op.confirmed_ledger ?? null,
    action: op.action,
    award_id: op.award_id,
    preview: op.preview,
  });
}
