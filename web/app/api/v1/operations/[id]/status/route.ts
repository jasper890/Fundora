import { reconcileOperation } from "@/lib/chain/reconcile";
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
    select id, actor_id, award_id
    from chain_operation
    where id = ${id}
    limit 1
  `) as unknown as { id: string; actor_id: string; award_id: string }[];
  const op = rows[0];
  if (!op) return jsonError("NOT_FOUND", 404);
  if (op.actor_id !== appUser.id && !appUser.is_staff) {
    // Sponsor/verifier may poll after confirming membership on the award.
    const access = (await db`
      select 1
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      where a.id = ${op.award_id}
        and (
          (sm.user_id = ${appUser.id} and sm.active)
          or (vm.user_id = ${appUser.id} and vm.active and a.verifier_sync_required = false)
        )
      limit 1
    `) as unknown as unknown[];
    if (!access[0]) return jsonError("FORBIDDEN", 403);
  }

  await reconcileOperation(id);

  const fresh = (await db`
    select id, status, error_code, confirmed_ledger, preview, action, award_id
    from chain_operation
    where id = ${id}
    limit 1
  `) as unknown as Record<string, unknown>[];
  const current = fresh[0];
  if (!current) return jsonError("NOT_FOUND", 404);

  return jsonOk({
    id: current.id,
    status: current.status,
    error_code: current.error_code || null,
    confirmed_ledger: current.confirmed_ledger ?? null,
    action: current.action,
    award_id: current.award_id,
    preview: current.preview,
  });
}
