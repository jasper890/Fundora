import { z } from "zod";
import { ChainError, ROLES } from "@/lib/chain/constants";
import { validateIntent } from "@/lib/chain/intent";
import { FakeRpc } from "@/lib/chain/rpc";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { PermissionDeniedError, requireAwardRole } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import type { AwardStatus, MemberView, Role } from "@/lib/types";

const Body = z
  .object({
    expected_version: z.string().optional(),
    params: z.record(z.string(), z.unknown()),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  if (!requireSameOrigin(request)) {
    return jsonError("ORIGIN_MISMATCH", 403);
  }

  const { id, action } = await context.params;
  const actionName = action.toUpperCase();
  if (!(actionName in ROLES) && actionName !== "PAYOUT") {
    return jsonError("INVALID_ACTION", 400);
  }
  const resolvedAction = actionName === "PAYOUT" ? "PAY" : actionName;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(authUser.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const idempotency = request.headers.get("Idempotency-Key");
  if (!idempotency) return jsonError("INVALID_IDEMPOTENCY_KEY", 400);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_PARAMETERS", 400);

  try {
    validateIntent(resolvedAction, parsed.data);
  } catch (error) {
    if (error instanceof ChainError) {
      return jsonError(error.code, error.status);
    }
    throw error;
  }

  const db = sql();
  try {
    const rows = (await db`
      select
        a.*,
        sm.id as sponsor_member_pk, sm.user_id as sponsor_user_id, sm.role as sponsor_role,
        sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.id as verifier_member_pk, vm.user_id as verifier_user_id, vm.role as verifier_role,
        vm.active as verifier_active, vm.public_wallet as verifier_wallet,
        rm.id as recipient_member_pk, rm.user_id as recipient_user_id, rm.role as recipient_role,
        rm.active as recipient_active, rm.public_wallet as recipient_wallet
      from award a
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id}
      limit 1
    `) as unknown as Record<string, unknown>[];
    const row = rows[0];
    if (!row) return jsonError("NOT_FOUND", 404);

    const member = (
      userId: string,
      role: Role,
      active: boolean,
      wallet: string,
    ): MemberView => ({ user_id: userId, role, active, public_wallet: wallet });

    const awardAccess = {
      sponsor_member: member(
        String(row.sponsor_user_id),
        "SPONSOR",
        Boolean(row.sponsor_active),
        String(row.sponsor_wallet),
      ),
      verifier_member: member(
        String(row.verifier_user_id),
        "VERIFIER",
        Boolean(row.verifier_active),
        String(row.verifier_wallet),
      ),
      recipient_member: member(
        String(row.recipient_user_id),
        "RECIPIENT",
        Boolean(row.recipient_active),
        String(row.recipient_wallet),
      ),
      verifier_sync_required: Boolean(row.verifier_sync_required),
    };

    const actor = requireAwardRole(
      appUser,
      awardAccess,
      ROLES[resolvedAction] as Role[],
    );

    const snapshot = {
      status: (row.status as AwardStatus) || "CREATED",
      version: Number(row.version ?? 0),
      evidence_revision: Number(row.evidence_revision ?? 0),
      evidence_digest: (row.evidence_digest as string) || null,
      verifier: String(row.verifier_wallet),
      sponsor_hold: Boolean(row.sponsor_hold),
      verifier_hold: Boolean(row.verifier_hold),
    };

    // Local development path: FakeRpc until live stellar-sdk prepare is wired.
    const rpc = new FakeRpc(snapshot);
    const envelope = await rpc.prepare({
      action: resolvedAction,
      signer: actor.public_wallet,
      contractId: (row.contract_id as string | null) ?? null,
      snapshot,
    });

    const expires = new Date(envelope.maxTime * 1000);
    const inserted = (await db`
      insert into chain_operation (
        award_id, actor_id, signer, action, idempotency_key, intent, status,
        unsigned_xdr, unsigned_hash, preview, expected_snapshot, expires_at
      ) values (
        ${id},
        ${appUser.id},
        ${actor.public_wallet},
        ${resolvedAction},
        ${idempotency},
        ${db.json({ award: id, action: resolvedAction, payload: parsed.data })},
        'PREPARED',
        ${envelope.toXdr()},
        ${envelope.hashHex()},
        ${db.json({
          action: resolvedAction,
          network: "TESTNET",
          network_passphrase: "Test SDF Network ; September 2015",
          signer: actor.public_wallet,
          recipient: String(row.recipient_wallet),
          asset: "Testnet XLM",
          amount_base_units: String(row.base_units ?? 200000000),
          maximum_fee_base_units: String(envelope.fee),
          expected_version: parsed.data.expected_version ?? null,
          note: "FakeRpc preview — live XDR port continues in Phase 6",
        })},
        ${db.json(snapshot)},
        ${expires}
      )
      returning id, preview, status
    `) as unknown as { id: string; preview: Record<string, unknown>; status: string }[];

    return jsonOk({
      id: inserted[0].id,
      status: inserted[0].status,
      preview: inserted[0].preview,
      unsigned_xdr: envelope.toXdr(),
      unsigned_hash: envelope.hashHex(),
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return jsonError("FORBIDDEN", 403);
    }
    if (error instanceof ChainError) {
      return jsonError(error.code, error.status);
    }
    console.error(error);
    return jsonError("RPC_UNAVAILABLE", 503);
  }
}
