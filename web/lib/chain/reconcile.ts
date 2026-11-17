import "server-only";
import { sql } from "@/lib/db";
import { isFakeRpc } from "./gateway";
import { LiveRpc } from "./live";
import type { AwardSnapshot } from "./rpc";

/** Poll outside locks; claim a terminal result exactly once inside a short transaction. */
export async function reconcileOperation(operationId: string) {
  const db = sql();
  const [op] = await db`select * from chain_operation where id = ${operationId} limit 1`;
  if (!op || !["SIGNED", "SUBMITTED", "UNKNOWN"].includes(op.status) || !op.signed_hash || isFakeRpc()) return op ?? null;
  const unknown = () => db.begin(async (tx) => {
    await tx`update chain_operation set status = 'UNKNOWN', error_code = 'OUTCOME_UNKNOWN', last_checked_at = now()
      where id = ${operationId} and status in ('SIGNED', 'SUBMITTED', 'UNKNOWN')`;
    const [current] = await tx`select * from chain_operation where id = ${operationId}`;
    return current ?? null;
  });
  const live = new LiveRpc();
  let outcome: Awaited<ReturnType<LiveRpc["getTransaction"]>>;
  try {
    outcome = await live.getTransaction(String(op.signed_hash));
  } catch {
    outcome = { status: "PENDING" };
  }
  if (outcome.status === "PENDING" || outcome.status === "NOT_FOUND") {
    return unknown();
  }
  // A confirmed transaction is insufficient without its independently read post-state.
  let snapshot: AwardSnapshot | undefined;
  let contractId: string | null = null;
  if (outcome.status === "SUCCESS") {
    const [award] = await db`select contract_id, deployment_manifest from award where id = ${op.award_id}`;
    contractId = op.action === "DEPLOY" ? outcome.contractId ?? null : award?.contract_id ?? null;
    if (!contractId || !outcome.ledger) return unknown();
    try { snapshot = await live.readAward(contractId, award?.deployment_manifest); } catch { return unknown(); }
  }
  return db.begin(async (tx) => {
    const [current] = await tx`select * from chain_operation where id = ${operationId} for update`;
    if (!current || !["SIGNED", "SUBMITTED", "UNKNOWN"].includes(current.status)) return current;
    const status = outcome.status === "SUCCESS" ? "CONFIRMED_SUCCESS" : "CONFIRMED_FAILED";
    if (snapshot) {
      const [award] = await tx`select * from award where id = ${op.award_id} for update`;
      if (!award) return current;
      // Polls finish out of order; an older read must never roll back confirmed business state.
      if (snapshot.version >= Number(award.version)) {
        // These fields also track local uploads; a late poll must preserve an unsigned revision.
        const preserveLocalEvidence = Number(award.evidence_revision) > snapshot.evidence_revision ||
          (Number(award.evidence_revision) > 0 && Number(award.evidence_revision) === snapshot.evidence_revision &&
            award.evidence_digest !== (snapshot.evidence_digest ?? ""));
        const evidenceRevision = preserveLocalEvidence ? Number(award.evidence_revision) : snapshot.evidence_revision;
        const evidenceDigest = preserveLocalEvidence ? String(award.evidence_digest) : snapshot.evidence_digest ?? "";
        const evidenceNeedsSync = evidenceRevision !== snapshot.evidence_revision || evidenceDigest !== (snapshot.evidence_digest ?? "");
        const verifier = await tx`select id from program_member where program_id = ${award.program_id}
          and public_wallet = ${snapshot.verifier} and role = 'VERIFIER' and active = true`;
        if (!verifier[0]) {
          await tx`update chain_operation set status = 'UNKNOWN', error_code = 'VERIFIER_SYNC_REQUIRED', last_checked_at = now() where id = ${operationId}`;
          await tx`update award set verifier_sync_required = true where id = ${op.award_id}`;
          return { ...current, status: "UNKNOWN" };
        }
        await tx`update award set contract_id = ${contractId}, network_id = 'TESTNET', status = ${snapshot.status},
          version = ${snapshot.version}, sponsor_hold = ${snapshot.sponsor_hold}, verifier_hold = ${snapshot.verifier_hold},
          evidence_revision = ${evidenceRevision}, evidence_digest = ${evidenceDigest},
          verifier_member_id = ${verifier[0].id}, verifier_sync_required = ${evidenceNeedsSync},
          last_confirmed_ledger = greatest(last_confirmed_ledger, ${outcome.ledger ?? null}),
          settled_at = case when ${snapshot.status} in ('PAID', 'REFUNDED', 'CANCELLED') then coalesce(settled_at, now()) else settled_at end
          where id = ${op.award_id}`;
      }
    }
    await tx`update chain_operation set status = ${status}, confirmed_ledger = ${outcome.ledger ?? null}, last_checked_at = now(), error_code = '' where id = ${operationId}`;
    // Match Django: linked review rows settle with the terminal operation outcome.
    if (current.review_id) {
      const reviewStatus = status === "CONFIRMED_SUCCESS" ? "CONFIRMED" : "FAILED";
      await tx`update review_action set status = ${reviewStatus} where id = ${current.review_id} and status = 'PENDING'`;
    }
    await tx`insert into chain_observation (operation_id, status, code, ledger) values (${operationId}, ${status}, '', ${outcome.ledger ?? null})`;
    return { ...current, status, confirmed_ledger: outcome.ledger };
  });
}
