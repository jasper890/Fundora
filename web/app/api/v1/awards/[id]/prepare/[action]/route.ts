import { z } from "zod";
import { ChainError, NETWORK_PASSPHRASE, ROLES } from "@/lib/chain/constants";
import { validateIntent } from "@/lib/chain/intent";
import { createRpc, useFakeRpc } from "@/lib/chain/gateway";
import { LiveRpc } from "@/lib/chain/live";
import { constructorManifest } from "@/lib/chain/manifest";
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
        p.requirements_text, p.requirements_version,
        p.claim_deadline, p.review_deadline, p.payout_deadline,
        sm.user_id as sponsor_user_id, sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.user_id as verifier_user_id, vm.active as verifier_active, vm.public_wallet as verifier_wallet,
        rm.user_id as recipient_user_id, rm.active as recipient_active, rm.public_wallet as recipient_wallet
      from award a
      join program p on p.id = a.program_id
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

    // Django parity: expire unsigned preparations for this signer before reserving again.
    await db`
      update chain_operation
      set status = 'ABANDONED',
          error_code = 'UNSIGNED_EXPIRED',
          last_checked_at = now()
      where signer = ${actor.public_wallet}
        and status in ('BUILDING', 'PREPARED')
        and (signed_hash is null or signed_hash = '')
        and (signed_xdr is null or signed_xdr = '')
        and expires_at <= now()
    `;

    const blocking = (await db`
      select id, status, action
      from chain_operation
      where signer = ${actor.public_wallet}
        and status in ('BUILDING', 'PREPARED', 'SIGNED', 'SUBMITTED', 'UNKNOWN')
        and reserves_source = true
      limit 1
    `) as unknown as { id: string; status: string; action: string }[];
    if (blocking[0]) {
      return jsonError(
        "UNRESOLVED_OPERATION",
        409,
        `Finish or cancel the open ${blocking[0].action} (${blocking[0].status}) before preparing another action.`,
      );
    }

    const snapshot = {
      status: (row.status as AwardStatus) || "CREATED",
      version: Number(row.version ?? 0),
      evidence_revision: Number(row.evidence_revision ?? 0),
      evidence_digest: (row.evidence_digest as string) || null,
      verifier: String(row.verifier_wallet),
      sponsor_hold: Boolean(row.sponsor_hold),
      verifier_hold: Boolean(row.verifier_hold),
    };

    const fake = useFakeRpc();
    let envelope;
    let mode: "fakerpc" | "live" = "fakerpc";
    let manifest: Record<string, unknown> | null = null;

    if (fake) {
      const rpc = createRpc(snapshot);
      envelope = await rpc.prepare({
        action: resolvedAction,
        signer: actor.public_wallet,
        contractId: (row.contract_id as string | null) ?? null,
        snapshot,
      });
    } else {
      mode = "live";
      const live = new LiveRpc();
      if (resolvedAction === "DEPLOY") {
        if (row.contract_id) return jsonError("ALREADY_DEPLOYED", 409);
        manifest = constructorManifest({
          existing: (row.deployment_manifest as Record<string, unknown>) || null,
          sponsorWallet: String(row.sponsor_wallet),
          verifierWallet: String(row.verifier_wallet),
          recipientWallet: String(row.recipient_wallet),
          requirementsText: String(row.requirements_text),
          requirementsVersion: Number(row.requirements_version),
          claimDeadline: new Date(String(row.claim_deadline)),
          reviewDeadline: new Date(String(row.review_deadline)),
          payoutDeadline: new Date(String(row.payout_deadline)),
        });
        await db`
          update award
          set deployment_manifest = ${db.json(manifest)}
          where id = ${id}
        `;
      }

      let evidence: { revision: number; digest: string } | null = null;
      if (resolvedAction === "SUBMIT") {
        const evidenceId = String(
          (parsed.data.params as { evidence_id?: string }).evidence_id ?? "",
        );
        const ev = (await db`
          select revision, digest from evidence_version
          where id = ${evidenceId} and award_id = ${id}
          limit 1
        `) as unknown as { revision: number; digest: string }[];
        if (!ev[0]) return jsonError("INVALID_PARAMETERS", 400);
        evidence = { revision: Number(ev[0].revision), digest: String(ev[0].digest) };
      }

      envelope = await live.prepareLive({
        action: resolvedAction,
        signer: actor.public_wallet,
        contractId: (row.contract_id as string | null) ?? null,
        snapshot,
        manifest,
        evidence,
        expectedVersion: parsed.data.expected_version ?? null,
        hold:
          typeof (parsed.data.params as { held?: boolean }).held === "boolean"
            ? Boolean((parsed.data.params as { held?: boolean }).held)
            : null,
      });
    }

    const expires = new Date(envelope.maxTime * 1000);
    const preview = {
      action: resolvedAction,
      network: "TESTNET",
      network_passphrase: NETWORK_PASSPHRASE,
      signer: actor.public_wallet,
      recipient: String(row.recipient_wallet),
      asset: "Testnet XLM",
      amount_base_units: String(row.base_units ?? 200000000),
      maximum_fee_base_units: String(envelope.fee),
      expected_version: parsed.data.expected_version ?? null,
      mode,
      note:
        mode === "live"
          ? "Live Testnet preview — Freighter must sign this exact envelope."
          : "FakeRpc preview — set STELLAR_USE_FAKE_RPC=0 and STELLAR_WASM_HASH for live XDR.",
    };

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
        ${db.json(preview)},
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
    const pgCode = (error as { code?: string }).code;
    if (pgCode === "23505") {
      return jsonError(
        "UNRESOLVED_OPERATION",
        409,
        "An open chain operation already reserves this signer. Cancel unsigned or wait for confirmation.",
      );
    }
    console.error(error);
    return jsonError("RPC_UNAVAILABLE", 503);
  }
}
