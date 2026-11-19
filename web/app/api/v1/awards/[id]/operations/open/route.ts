import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";

/** Resume an in-flight op for this award + actor after page reload. */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id: awardId } = await context.params;

  const user = await getRequestAuthUser(request);
  if (!user) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(user.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const db = sql();
  const rows = (await db`
    select
      id, status, action, unsigned_xdr, preview, error_code, signed_hash
    from chain_operation
    where award_id = ${awardId}
      and actor_id = ${appUser.id}
      and status in ('BUILDING', 'PREPARED', 'SIGNED', 'SUBMITTED', 'UNKNOWN')
    order by created_at desc
    limit 1
  `) as unknown as Record<string, unknown>[];

  const op = rows[0];
  if (!op) {
    return jsonOk({ operation: null });
  }

  return jsonOk({
    operation: {
      id: op.id,
      status: op.status,
      action: op.action,
      unsigned_xdr: op.unsigned_xdr || null,
      preview: op.preview ?? null,
      error_code: op.error_code || null,
      signed_hash: op.signed_hash || null,
    },
  });
}
