import { z } from "zod";
import { ChainError, NETWORK_PASSPHRASE, ROLES } from "@/lib/chain/constants";
import { classifyPreparationReplay, type PreparationRequest } from "@/lib/chain/preparation";
import { validateActionState } from "@/lib/chain/state";
import { validateIntent } from "@/lib/chain/intent";
import { createRpc, isFakeRpc } from "@/lib/chain/gateway";
import { LiveRpc } from "@/lib/chain/live";
import { constructorManifest } from "@/lib/chain/manifest";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { PermissionDeniedError, requireAwardRole } from "@/lib/permissions";
import { getRequestAuthUser } from "@/lib/supabase/server";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import type { AppUser, AwardStatus, MemberView, Role } from "@/lib/types";
import type { AwardSnapshot, PreparedEnvelope } from "@/lib/chain/rpc";

const Body = z
  .object({
    expected_version: z.string().optional(),
    params: z.record(z.string(), z.unknown()),
  })
  .strict();

type AwardRow = Record<string, unknown>;
type OperationRow = Record<string, unknown> & { status: string };
type Db = ReturnType<typeof sql>;
type Binding = {
  evidence: { id: string; revision: number; digest: string; author_id: string } | null;
  reviewId: string | null;
  newVerifierWallet: string | null;
  manifest: Record<string, unknown> | null;
};

function bool(value: unknown): boolean {
  return value === true;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalManifest(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function member(userId: unknown, role: Role, active: unknown, wallet: unknown): MemberView {
  return {
    user_id: text(userId),
    role,
    active: bool(active),
    public_wallet: text(wallet),
  };
}

function awardAccess(row: AwardRow) {
  return {
    sponsor_member: member(row.sponsor_user_id, "SPONSOR", row.sponsor_active, row.sponsor_wallet),
    verifier_member: member(row.verifier_user_id, "VERIFIER", row.verifier_active, row.verifier_wallet),
    recipient_member: member(row.recipient_user_id, "RECIPIENT", row.recipient_active, row.recipient_wallet),
    verifier_sync_required: bool(row.verifier_sync_required),
  };
}

function snapshotFromAward(row: AwardRow): AwardSnapshot {
  return {
    status: (text(row.status) || "CREATED") as AwardStatus,
    version: Number(row.version ?? 0),
    evidence_revision: 0,
    evidence_digest: null,
    verifier: text(row.verifier_wallet),
    sponsor_hold: bool(row.sponsor_hold),
    verifier_hold: bool(row.verifier_hold),
  };
}

async function fakeSnapshot(db: Db, row: AwardRow): Promise<AwardSnapshot> {
  const snapshot = snapshotFromAward(row);
  const rows = (await db`
    select co.intent, ev.revision, ev.digest
    from chain_operation co
    left join evidence_version ev on ev.id::text = coalesce(
      co.intent->'evidence'->>'id',
      co.intent->'payload'->'params'->>'evidence_id'
    ) and ev.award_id = co.award_id
    where co.award_id = ${String(row.id)}
      and co.action = 'SUBMIT'
      and co.status = 'CONFIRMED_SUCCESS'
    order by coalesce(co.confirmed_ledger, 0) desc, co.created_at desc
    limit 1
  `) as unknown as { intent: unknown; revision: number | null; digest: string | null }[];
  const latest = rows[0];
  const intent = latest?.intent && typeof latest.intent === "object"
    ? latest.intent as Record<string, unknown>
    : null;
  const evidence = intent?.evidence && typeof intent.evidence === "object"
    ? intent.evidence as Record<string, unknown>
    : null;
  if (latest) {
    snapshot.evidence_revision = Number(evidence?.revision ?? latest.revision ?? 0);
    snapshot.evidence_digest = text(evidence?.digest ?? latest.digest) || null;
  }
  return snapshot;
}

function validateProjection(row: AwardRow, snapshot: AwardSnapshot): void {
  if (
    Number(row.version ?? 0) !== snapshot.version ||
    text(row.status) !== snapshot.status ||
    bool(row.sponsor_hold) !== snapshot.sponsor_hold ||
    bool(row.verifier_hold) !== snapshot.verifier_hold
  ) {
    throw new ChainError("AWARD_STATE_OUT_OF_SYNC", 409);
  }
  if (text(row.verifier_wallet) !== snapshot.verifier) {
    throw new ChainError("VERIFIER_SYNC_REQUIRED", 409);
  }
}

function validateLocalCommitment(action: string, row: AwardRow): void {
  if (action === "PAY" && bool(row.verifier_sync_required)) {
    throw new ChainError("STALE_EVIDENCE", 409);
  }
}

function replayResult(operation: OperationRow, request: PreparationRequest): Response {
  const replay = classifyPreparationReplay(operation, request);
  if (replay.kind === "conflict") return jsonError("IDEMPOTENCY_CONFLICT", 409);
  if (replay.kind === "building") {
    return jsonError("PREPARATION_IN_PROGRESS", 409, "This idempotent preparation is still being built.");
  }
  if (replay.kind === "expired") {
    return jsonError("IDEMPOTENCY_KEY_EXPIRED", 409, "This preparation expired. Start a new request with a new idempotency key.");
  }
  if (replay.kind === "prepared") {
    return jsonOk({
      id: text(operation.id),
      status: operation.status,
      preview: operation.preview,
      unsigned_xdr: text(operation.unsigned_xdr),
      unsigned_hash: text(operation.unsigned_hash),
    });
  }
  return jsonError("IDEMPOTENCY_KEY_USED", 409, `This request already has operation ${text(operation.id)} (${operation.status}).`);
}

async function handleExisting(
  db: Db,
  operation: OperationRow,
  request: PreparationRequest,
): Promise<Response> {
  const response = replayResult(operation, request);
  const decision = classifyPreparationReplay(operation, request);
  if (decision.kind === "expired") {
    await db`
      update chain_operation set status = 'ABANDONED', reserves_source = false,
        error_code = 'UNSIGNED_EXPIRED', last_checked_at = now()
      where id = ${text(operation.id)} and status in ('BUILDING', 'PREPARED')
        and (signed_hash is null or signed_hash = '')
        and (signed_xdr is null or signed_xdr = '')
    `;
  }
  return response;
}

async function bindAction(
  tx: Db,
  id: string,
  row: AwardRow,
  action: string,
  payload: z.infer<typeof Body>,
  actor: MemberView,
  snapshot: AwardSnapshot,
  candidateManifest: Record<string, unknown> | null,
): Promise<Binding> {
  let evidence: Binding["evidence"] = null;
  let reviewId: string | null = null;
  let newVerifierWallet: string | null = null;
  let manifest: Record<string, unknown> | null = null;

  if (action === "DEPLOY") {
    manifest = constructorManifest({
      existing: optionalManifest(row.deployment_manifest) ?? candidateManifest,
      sponsorWallet: text(row.sponsor_wallet),
      verifierWallet: text(row.verifier_wallet),
      recipientWallet: text(row.recipient_wallet),
      requirementsText: text(row.requirements_text),
      requirementsVersion: Number(row.requirements_version),
      claimDeadline: new Date(String(row.claim_deadline)),
      reviewDeadline: new Date(String(row.review_deadline)),
      payoutDeadline: new Date(String(row.payout_deadline)),
    });
    await tx`update award set deployment_manifest = ${tx.json(manifest)} where id = ${id}`;
  }

  if (action === "SUBMIT") {
    const evidenceId = text((payload.params as { evidence_id?: unknown }).evidence_id);
    const rows = (await tx`
      select id, revision, digest, author_id
      from evidence_version
      where award_id = ${id} and purged_at is null
      order by revision desc limit 1
    `) as unknown as { id: string; revision: number; digest: string; author_id: string }[];
    const latest = rows[0];
    const localRevision = Number(row.evidence_revision ?? 0);
    const localDigest = text(row.evidence_digest).toLowerCase();
    if (
      !latest || latest.id !== evidenceId ||
      Number(latest.revision) !== localRevision ||
      latest.author_id !== String(row.recipient_user_id) ||
      String(latest.digest).toLowerCase() !== localDigest ||
      Number(latest.revision) !== snapshot.evidence_revision + 1 ||
      !/^[0-9a-f]{64}$/.test(String(latest.digest).toLowerCase()) ||
      /^0+$/.test(String(latest.digest))
    ) {
      throw new ChainError("STALE_EVIDENCE", 409);
    }
    evidence = {
      id: latest.id, revision: Number(latest.revision),
      digest: String(latest.digest).toLowerCase(), author_id: latest.author_id,
    };
  }

  if (["APPROVE", "REJECT", "REOPEN"].includes(action)) {
    if (!snapshot.evidence_revision || !snapshot.evidence_digest) throw new ChainError("MISSING_EVIDENCE", 409);
    const evidenceRows = (await tx`
      select id, author_id
      from evidence_version
      where award_id = ${id} and revision = ${snapshot.evidence_revision}
        and lower(digest) = ${snapshot.evidence_digest.toLowerCase()}
        and purged_at is null
      limit 1
    `) as unknown as { id: string; author_id: string }[];
    if (!evidenceRows[0] || evidenceRows[0].author_id !== String(row.recipient_user_id)) {
      throw new ChainError("STALE_EVIDENCE", 409);
    }
    const reviewRows = (await tx`
      select ra.id, ra.source_confirmed, ra.source_check_method
      from review_action ra
      where ra.award_id = ${id} and ra.verifier_id = ${actor.user_id}
        and ra.action = ${action} and ra.expected_version = ${BigInt(payload.expected_version ?? "0")}
        and ra.evidence_id = ${evidenceRows[0].id} and ra.status = 'PENDING'
        and not exists (select 1 from chain_operation co where co.review_id = ra.id)
      order by ra.created_at desc, ra.id desc
      limit 1 for update of ra
    `) as unknown as { id: string; source_confirmed: boolean; source_check_method: string }[];
    const review = reviewRows[0];
    if (!review) throw new ChainError("REVIEW_REQUIRED", 409);
    if (action === "APPROVE" && (!review.source_confirmed || !review.source_check_method.trim())) {
      throw new ChainError("SOURCE_CHECK_REQUIRED", 409);
    }
    reviewId = review.id;
    evidence = {
      id: evidenceRows[0].id,
      revision: snapshot.evidence_revision,
      digest: snapshot.evidence_digest.toLowerCase(),
      author_id: evidenceRows[0].author_id,
    };
  }

  if (action === "REPLACE_VERIFIER") {
    const verifierId = text((payload.params as { new_verifier_member_id?: unknown }).new_verifier_member_id);
    const rows = (await tx`
      select pm.id, pm.public_wallet
      from program_member pm
      join app_user u on u.id = pm.user_id
      where pm.id = ${verifierId} and pm.program_id = ${String(row.program_id)}
        and pm.role = 'VERIFIER' and pm.active = true and u.is_active = true
      limit 1 for update
    `) as unknown as { id: string; public_wallet: string }[];
    const replacement = rows[0];
    if (
      !replacement || replacement.id === String(row.verifier_member_id) ||
      replacement.public_wallet === text(row.sponsor_wallet) ||
      replacement.public_wallet === text(row.recipient_wallet) ||
      replacement.public_wallet === snapshot.verifier
    ) {
      throw new ChainError("INVALID_VERIFIER", 409);
    }
    newVerifierWallet = replacement.public_wallet;
  }

  return { evidence, reviewId, newVerifierWallet, manifest };
}

function actionSnapshot(row: AwardRow, snapshot: AwardSnapshot): Record<string, unknown> {
  return {
    ...snapshot,
    contract_id: row.contract_id,
    claim_deadline: row.claim_deadline,
    review_deadline: row.review_deadline,
    payout_deadline: row.payout_deadline,
  };
}

function operationRequest(award: string, action: string, payload: z.infer<typeof Body>) {
  return { award, action, payload };
}

function getActor(row: AwardRow, appUser: AppUser, action: string): MemberView {
  return requireAwardRole(appUser, awardAccess(row), ROLES[action] as Role[]);
}

function rpcFailure(error: unknown): boolean {
  if (error instanceof ChainError) return ["RPC_UNAVAILABLE", "STATE_UNAVAILABLE"].includes(error.code);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return /fetch failed|econnrefused|network|timeout|503/.test(message);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);

  const { id, action } = await context.params;
  const actionName = action.toUpperCase();
  const resolvedAction = actionName === "PAYOUT" ? "PAY" : actionName;
  if (!Object.hasOwn(ROLES, resolvedAction)) return jsonError("INVALID_ACTION", 400);

  const authUser = await getRequestAuthUser(request);
  if (!authUser) return jsonError("UNAUTHENTICATED", 401);
  const appUser = await loadAppUserByAuthId(authUser.id);
  if (!appUser) return jsonError("UNAUTHENTICATED", 401);

  const idempotency = request.headers.get("Idempotency-Key");
  if (!idempotency || !z.string().uuid().safeParse(idempotency).success) {
    return jsonError("INVALID_IDEMPOTENCY_KEY", 400);
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_PARAMETERS", 400);
  try {
    validateIntent(resolvedAction, parsed.data);
  } catch (error) {
    if (error instanceof ChainError) return jsonError(error.code, error.status);
    throw error;
  }

  const db = sql();
  const requested = operationRequest(id, resolvedAction, parsed.data);
  try {
    const rows = (await db`
      select a.*, p.requirements_text, p.requirements_version,
        p.claim_deadline, p.review_deadline, p.payout_deadline,
        sm.id as sponsor_member_id, sm.user_id as sponsor_user_id, sm.role as sponsor_role,
        sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
        vm.id as verifier_member_id, vm.user_id as verifier_user_id, vm.role as verifier_role,
        vm.active as verifier_active, vm.public_wallet as verifier_wallet,
        rm.id as recipient_member_id, rm.user_id as recipient_user_id, rm.role as recipient_role,
        rm.active as recipient_active, rm.public_wallet as recipient_wallet
      from award a
      join program p on p.id = a.program_id
      join program_member sm on sm.id = a.sponsor_member_id
      join program_member vm on vm.id = a.verifier_member_id
      join program_member rm on rm.id = a.recipient_member_id
      where a.id = ${id} limit 1
    `) as unknown as AwardRow[];
    const row = rows[0];
    if (!row) return jsonError("NOT_FOUND", 404);
    const initialActor = getActor(row, appUser, resolvedAction);
    validateLocalCommitment(resolvedAction, row);

    const existingRows = (await db`
      select * from chain_operation where actor_id = ${appUser.id}
        and idempotency_key = ${idempotency} limit 1
    `) as unknown as OperationRow[];
    if (existingRows[0]) return await handleExisting(db, existingRows[0], requested);

    const fake = isFakeRpc();
    const deploySnapshot = snapshotFromAward(row);
    let snapshot = deploySnapshot;
    if (resolvedAction !== "DEPLOY") {
      if (fake) {
        snapshot = await fakeSnapshot(db, row);
        snapshot = await createRpc(snapshot).readAward((row.contract_id as string | null) ?? null);
      } else {
        snapshot = await new LiveRpc().readAward(
          (row.contract_id as string | null) ?? null,
          optionalManifest(row.deployment_manifest),
        );
      }
      validateProjection(row, snapshot);
    }
    validateActionState(
      resolvedAction,
      actionSnapshot(row, snapshot),
      parsed.data.expected_version,
      snapshot.timestamp == null ? Date.now() : snapshot.timestamp * 1000,
    );

    const candidateManifest = resolvedAction === "DEPLOY"
      ? constructorManifest({
          existing: optionalManifest(row.deployment_manifest),
          sponsorWallet: text(row.sponsor_wallet),
          verifierWallet: text(row.verifier_wallet),
          recipientWallet: text(row.recipient_wallet),
          requirementsText: text(row.requirements_text),
          requirementsVersion: Number(row.requirements_version),
          claimDeadline: new Date(String(row.claim_deadline)),
          reviewDeadline: new Date(String(row.review_deadline)),
          payoutDeadline: new Date(String(row.payout_deadline)),
        })
      : null;

    await db`
      update chain_operation set status = 'ABANDONED', reserves_source = false,
        error_code = 'UNSIGNED_EXPIRED', last_checked_at = now()
      where status in ('BUILDING', 'PREPARED') and reserves_source = true
        and (signed_hash is null or signed_hash = '')
        and (signed_xdr is null or signed_xdr = '')
        and expires_at <= now()
        and (award_id = ${id} or signer = ${initialActor.public_wallet})
    `;

    const reservation = await db.begin(async (rawTx) => {
      const tx = rawTx as unknown as Db;
      await tx`
        select a.id from award a
        join program_member sm on sm.id = a.sponsor_member_id
        join program_member vm on vm.id = a.verifier_member_id
        join program_member rm on rm.id = a.recipient_member_id
        where a.id = ${id}
        for update of a, sm, vm, rm
      `;
      const lockedRows = (await tx`
        select a.*, p.requirements_text, p.requirements_version,
          p.claim_deadline, p.review_deadline, p.payout_deadline,
          sm.id as sponsor_member_id, sm.user_id as sponsor_user_id, sm.role as sponsor_role,
          sm.active as sponsor_active, sm.public_wallet as sponsor_wallet,
          vm.id as verifier_member_id, vm.user_id as verifier_user_id, vm.role as verifier_role,
          vm.active as verifier_active, vm.public_wallet as verifier_wallet,
          rm.id as recipient_member_id, rm.user_id as recipient_user_id, rm.role as recipient_role,
          rm.active as recipient_active, rm.public_wallet as recipient_wallet
        from award a
        join program p on p.id = a.program_id
        join program_member sm on sm.id = a.sponsor_member_id
        join program_member vm on vm.id = a.verifier_member_id
        join program_member rm on rm.id = a.recipient_member_id
        where a.id = ${id} limit 1
      `) as unknown as AwardRow[];
      const current = lockedRows[0];
      if (!current) throw new ChainError("NOT_FOUND", 404);
      const currentActor = getActor(current, appUser, resolvedAction);
      validateLocalCommitment(resolvedAction, current);

      const duplicateRows = (await tx`
        select * from chain_operation where actor_id = ${appUser.id}
          and idempotency_key = ${idempotency} limit 1
      `) as unknown as OperationRow[];
      if (duplicateRows[0]) return { duplicate: duplicateRows[0] as OperationRow };
      const sourceBlocker = (await tx`
        select id, status, action from chain_operation
        where signer = ${currentActor.public_wallet}
          and status in ('BUILDING', 'PREPARED', 'SIGNED', 'SUBMITTED', 'UNKNOWN')
          and reserves_source = true
        limit 1
      `) as unknown as { id: string; status: string; action: string }[];
      if (sourceBlocker[0]) throw new ChainError("UNRESOLVED_OPERATION", 409);
      const awardBlocker = (await tx`
        select id, status, action from chain_operation
        where award_id = ${id}
          and status in ('BUILDING', 'PREPARED', 'SIGNED', 'SUBMITTED', 'UNKNOWN')
          and reserves_source = true
        limit 1
      `) as unknown as { id: string; status: string; action: string }[];
      if (awardBlocker[0]) throw new ChainError("UNRESOLVED_OPERATION", 409);

      if (resolvedAction !== "DEPLOY") validateProjection(current, snapshot);
      validateActionState(
        resolvedAction,
        actionSnapshot(current, snapshot),
        parsed.data.expected_version,
        snapshot.timestamp == null ? Date.now() : snapshot.timestamp * 1000,
      );
      const binding = await bindAction(
        tx, id, current, resolvedAction, parsed.data, currentActor, snapshot, candidateManifest,
      );
      const intent = {
        award: id,
        action: resolvedAction,
        payload: parsed.data,
        request: requested,
        actor_role: currentActor.role,
        evidence: binding.evidence,
        review_id: binding.reviewId,
        new_verifier_wallet: binding.newVerifierWallet,
        manifest: binding.manifest,
      };
      const operations = (await tx`
        insert into chain_operation (
          award_id, actor_id, signer, action, idempotency_key, intent, status,
          review_id, expected_snapshot, expires_at
        ) values (
          ${id}, ${appUser.id}, ${currentActor.public_wallet}, ${resolvedAction}, ${idempotency},
          ${db.json(intent)}, 'BUILDING', ${binding.reviewId}, ${db.json(snapshot)},
          now() + interval '5 minutes'
        ) returning id
      `) as unknown as { id: string }[];
      return { id: operations[0].id, actor: currentActor, row: current, binding, intent };
    });

    if ("duplicate" in reservation && reservation.duplicate) {
      return await handleExisting(db, reservation.duplicate, requested);
    }

    const { id: operationId, binding, actor: reservedActor, row: reservedRow } = reservation;
    let envelope: PreparedEnvelope;
    let mode: "fakerpc" | "live" = "fakerpc";
    try {
      if (fake) {
        envelope = await createRpc(snapshot).prepare({
          action: resolvedAction,
          signer: reservedActor.public_wallet,
          contractId: (reservedRow.contract_id as string | null) ?? null,
          snapshot,
        });
      } else {
        mode = "live";
        envelope = await new LiveRpc().prepareLive({
          action: resolvedAction,
          signer: reservedActor.public_wallet,
          contractId: (reservedRow.contract_id as string | null) ?? null,
          snapshot,
          manifest: binding.manifest,
          evidence: binding.evidence,
          expectedVersion: parsed.data.expected_version ?? null,
          hold: typeof (parsed.data.params as { held?: unknown }).held === "boolean"
            ? Boolean((parsed.data.params as { held?: unknown }).held)
            : null,
          newVerifierWallet: binding.newVerifierWallet,
        });
      }
    } catch (error) {
      await db`
        update chain_operation set status = 'ABANDONED', reserves_source = false,
          error_code = ${error instanceof ChainError ? error.code : "PREPARATION_FAILED"},
          last_checked_at = now()
        where id = ${operationId} and status = 'BUILDING'
      `;
      throw error;
    }

    const expires = new Date(envelope.maxTime * 1000);
    if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) {
      await db`
        update chain_operation set status = 'ABANDONED', reserves_source = false,
          error_code = 'PREPARATION_EXPIRED', last_checked_at = now()
        where id = ${operationId} and status = 'BUILDING'
      `;
      throw new ChainError("PREPARATION_EXPIRED", 409);
    }
    const preview = {
      action: resolvedAction,
      network: "TESTNET",
      network_passphrase: NETWORK_PASSPHRASE,
      signer: reservedActor.public_wallet,
      recipient: text(reservedRow.recipient_wallet),
      new_verifier_wallet: binding.newVerifierWallet,
      evidence_revision: binding.evidence?.revision ?? snapshot.evidence_revision,
      evidence_digest: binding.evidence?.digest ?? snapshot.evidence_digest,
      asset: "Testnet XLM",
      amount_base_units: String(reservedRow.base_units ?? 200000000),
      maximum_fee_base_units: String(envelope.fee),
      expected_version: parsed.data.expected_version ?? null,
      mode,
      note: mode === "live"
        ? "Live Testnet preview — Freighter must sign this exact envelope."
        : "FakeRpc preview — no network transaction was prepared.",
    };
    const preparedRows = (await db`
      update chain_operation set status = 'PREPARED',
        unsigned_xdr = ${envelope.toXdr()}, unsigned_hash = ${envelope.hashHex()},
        preview = ${db.json(preview)}, expected_snapshot = ${db.json(snapshot)}, expires_at = ${expires}
      where id = ${operationId} and status = 'BUILDING'
      returning id, status
    `) as unknown as { id: string; status: string }[];
    if (!preparedRows[0]) throw new ChainError("PREPARATION_EXPIRED", 409);

    return jsonOk({
      id: preparedRows[0].id,
      status: preparedRows[0].status,
      preview,
      unsigned_xdr: envelope.toXdr(),
      unsigned_hash: envelope.hashHex(),
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) return jsonError("FORBIDDEN", 403);
    if (error instanceof ChainError) return jsonError(error.code, error.status);
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === "23505") {
      const existing = (await db`
        select * from chain_operation where actor_id = ${appUser.id}
          and idempotency_key = ${idempotency} limit 1
      `) as unknown as OperationRow[];
      const found = existing[0];
      if (found) return await handleExisting(db, found, requested);
      return jsonError("UNRESOLVED_OPERATION", 409);
    }
    const code = rpcFailure(error) ? "RPC_UNAVAILABLE" : "PREPARATION_FAILED";
    console.error("prepare failed", { action: resolvedAction, code });
    return jsonError(code, code === "RPC_UNAVAILABLE" ? 503 : 400,
      code === "RPC_UNAVAILABLE" ? "The configured Testnet RPC could not prepare the transaction." : "The transaction could not be prepared.");
  }
}
