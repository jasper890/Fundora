import { reconcileOperation } from "@/lib/chain/reconcile";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { canReadOperationStatus } from "@/lib/permissions";
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
  if (op.actor_id !== appUser.id) {
    const rows = (await db`
      select
        a.verifier_sync_required,
        sm.user_id as sponsor_user_id, sm.role as sponsor_role,
        sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.user_id as verifier_user_id, vm.role as verifier_role,
        vm.active as verifier_active, vm.public_wallet as verifier_wallet
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      where a.id = ${op.award_id}
      limit 1
    `) as unknown as {
      verifier_sync_required: boolean;
      sponsor_user_id: string; sponsor_role: "SPONSOR" | "VERIFIER" | "RECIPIENT";
      sponsor_active: boolean; sponsor_wallet: string;
      verifier_user_id: string; verifier_role: "SPONSOR" | "VERIFIER" | "RECIPIENT";
      verifier_active: boolean; verifier_wallet: string;
    }[];
    const row = rows[0];
    const allowed = row && canReadOperationStatus(appUser, op.actor_id, {
      verifier_sync_required: row.verifier_sync_required,
      sponsor_member: {
        user_id: row.sponsor_user_id,
        role: row.sponsor_role,
        active: row.sponsor_active,
        public_wallet: row.sponsor_wallet,
      },
      verifier_member: {
        user_id: row.verifier_user_id,
        role: row.verifier_role,
        active: row.verifier_active,
        public_wallet: row.verifier_wallet,
      },
      recipient_member: {
        user_id: "",
        role: "RECIPIENT",
        active: false,
        public_wallet: "",
      },
    });
    if (!allowed) return jsonError("NOT_FOUND", 404);
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
