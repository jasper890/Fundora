import { createHash } from "node:crypto";
import { z } from "zod";
import { ChainError, ROLES } from "@/lib/chain/constants";
import { applyConfirmedAction } from "@/lib/chain/apply";
import { isFakeRpc } from "@/lib/chain/gateway";
import { LiveRpc } from "@/lib/chain/live";
import { validateSignedEnvelope } from "@/lib/chain/validate";
import { validateActionState } from "@/lib/chain/state";
import { sql } from "@/lib/db";
import { jsonError, jsonOk, requireSameOrigin } from "@/lib/http";
import { loadAppUserByAuthId } from "@/lib/awards/queries";
import { getRequestAuthUser } from "@/lib/supabase/server";

const Body = z.object({ signed_xdr: z.string().min(1).max(200_000) }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!requireSameOrigin(request)) return jsonError("ORIGIN_MISMATCH", 403);
  const { id } = await context.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("INVALID_BODY", 400);
  const user = await getRequestAuthUser(request);
  const actor = user && await loadAppUserByAuthId(user.id);
  if (!actor?.is_active) return jsonError("UNAUTHENTICATED", 401);
  const fake = isFakeRpc();
  const db = sql();
  try {
    const claim = await db.begin(async (tx) => {
      const [op] = await tx`select * from chain_operation where id = ${id} and actor_id = ${actor.id} for update`;
      if (!op) throw new ChainError("NOT_FOUND", 404);
      const signed = parsed.data.signed_xdr;
      const preview = op.preview as { mode?: string };
      if ((preview.mode === "fakerpc") !== fake) throw new ChainError("MODE_MISMATCH", 409);
      const hash = fake ? createHash("sha256").update(signed).digest("hex") : validateSignedEnvelope({ unsigned_xdr: op.unsigned_xdr, unsigned_hash: op.unsigned_hash, signer: op.signer }, signed);
      if (fake && signed !== `SIGNED-${op.unsigned_xdr}`) throw new ChainError("TRANSACTION_MISMATCH", 422);
      if (op.signed_xdr) {
        if (op.signed_xdr !== signed) throw new ChainError("TRANSACTION_MISMATCH", 409);
        return { send: false, status: String(op.status), hash: String(op.signed_hash) };
      }
      if (op.status !== "PREPARED") throw new ChainError("INVALID_STATE");
      if (new Date(op.expires_at).getTime() < Date.now()) throw new ChainError("STALE_VERSION");
      const [award] = await tx`
        select a.*, p.claim_deadline, p.review_deadline, p.payout_deadline from award a
        join program p on p.id = a.program_id where a.id = ${op.award_id} for update of a`;
      if (!award) throw new ChainError("NOT_FOUND", 404);
      const members = await tx`
        select role from program_member where user_id = ${actor.id} and active = true
        and public_wallet = ${op.signer} and id in (${award.sponsor_member_id}, ${award.verifier_member_id}, ${award.recipient_member_id})`;
      const role = members[0]?.role as string | undefined;
      if (!role || !ROLES[op.action]?.includes(role as never)) throw new ChainError("ACTION_DENIED", 403);
      const intent = op.intent as {
        payload?: { expected_version?: string; params?: { evidence_id?: string; new_verifier_member_id?: string } };
        evidence?: { id: string; revision: number; digest: string; author_id?: string };
        review_id?: string;
        new_verifier_wallet?: string;
      };
      validateActionState(op.action, award, intent.payload?.expected_version);
      if (op.action === "PAY" && award.verifier_sync_required) throw new ChainError("STALE_EVIDENCE");
      if (op.action === "SUBMIT") {
        const bound = intent.evidence;
        if (!bound || bound.id !== intent.payload?.params?.evidence_id) throw new ChainError("STALE_EVIDENCE");
        const [evidence] = await tx`select id, revision, digest, author_id from evidence_version
          where id = ${bound.id} and award_id = ${op.award_id} and purged_at is null`;
        const snapshot = op.expected_snapshot as { evidence_revision?: number };
        if (!evidence || evidence.author_id !== actor.id || Number(evidence.revision) !== Number(bound.revision) ||
          evidence.digest !== bound.digest || Number(bound.revision) !== Number(snapshot.evidence_revision) + 1 ||
          Number(award.evidence_revision) !== Number(bound.revision) || award.evidence_digest !== bound.digest ||
          (bound.author_id != null && bound.author_id !== evidence.author_id)) {
          throw new ChainError("STALE_EVIDENCE");
        }
      }
      if (["APPROVE", "REJECT", "REOPEN"].includes(op.action)) {
        if (!op.review_id || intent.review_id !== op.review_id || award.verifier_sync_required) throw new ChainError("STALE_REVIEW");
        const [review] = await tx`select r.*, e.revision, e.digest from review_action r
          join evidence_version e on e.id = r.evidence_id
          where r.id = ${op.review_id} and r.award_id = ${op.award_id} and r.verifier_id = ${actor.id}
            and e.purged_at is null for update of r`;
        const bound = intent.evidence;
        if (!review || !bound || review.status !== "PENDING" || review.action !== op.action ||
          String(review.expected_version) !== intent.payload?.expected_version || !String(review.rationale ?? "").trim() ||
          review.evidence_id !== bound.id || Number(review.revision) !== Number(bound.revision) || review.digest !== bound.digest ||
          Number(award.evidence_revision) !== Number(bound.revision) || award.evidence_digest !== bound.digest ||
          (op.action === "APPROVE" && (!review.source_confirmed || !String(review.source_check_method ?? "").trim()))) {
          throw new ChainError("STALE_REVIEW");
        }
      }
      if (op.action === "REPLACE_VERIFIER") {
        const replacementId = intent.payload?.params?.new_verifier_member_id;
        if (!replacementId || !intent.new_verifier_wallet) throw new ChainError("STALE_VERIFIER");
        const [replacement] = await tx`select m.id from program_member m
          join app_user u on u.id = m.user_id
          where m.id = ${replacementId} and m.program_id = ${award.program_id} and m.role = 'VERIFIER'
            and m.active = true and u.is_active = true and m.public_wallet = ${intent.new_verifier_wallet}
            and m.id not in (${award.sponsor_member_id}, ${award.recipient_member_id}, ${award.verifier_member_id})`;
        if (!replacement) throw new ChainError("STALE_VERIFIER");
      }
      if (!fake && process.env.STELLAR_ALLOW_SUBMISSION !== "1") throw new ChainError("SUBMISSION_DISABLED", 403);
      // Persist the real hash before RPC; concurrent retries cannot send again.
      await tx`update chain_operation set signed_xdr = ${signed}, signed_hash = ${hash}, status = 'SIGNED' where id = ${id}`;
      if (fake) {
        const ledger = Math.floor(Date.now() / 1000);
        await applyConfirmedAction(tx, { awardId: String(op.award_id), action: op.action, ledger,
          intent: op.intent as Record<string, unknown>, actorRole: role });
        if (op.review_id) await tx`update review_action set status = 'CONFIRMED' where id = ${op.review_id}`;
        await tx`update chain_operation set status = 'CONFIRMED_SUCCESS', confirmed_ledger = ${ledger}, last_checked_at = now() where id = ${id}`;
        await tx`insert into chain_observation (operation_id, status, code, ledger) values (${id}, 'CONFIRMED_SUCCESS', '', ${ledger})`;
        return { send: false, status: "CONFIRMED_SUCCESS", hash };
      }
      return { send: true, status: "SIGNED", hash };
    });
    if (!claim.send) return jsonOk({ id, status: claim.status, hash: claim.hash, mode: fake ? "fakerpc" : "live" }, claim.status === "CONFIRMED_SUCCESS" ? 200 : 202);
    let status = "SUBMITTED";
    try {
      const sent = await new LiveRpc().submit(parsed.data.signed_xdr);
      if (sent.hash !== claim.hash) throw new Error("Transaction hash mismatch");
    } catch {
      status = "UNKNOWN";
    }
    await db.begin(async (tx) => {
      const updated = await tx`update chain_operation set status = ${status}, last_checked_at = now(),
        error_code = ${status === "UNKNOWN" ? "SUBMISSION_UNCONFIRMED" : ""}
        where id = ${id} and status = 'SIGNED' returning id`;
      if (updated.length) await tx`insert into chain_observation (operation_id, status, code)
        values (${id}, ${status}, ${status === "UNKNOWN" ? "SUBMISSION_UNCONFIRMED" : ""})`;
    });
    return jsonOk({ id, status, hash: claim.hash, mode: "live", message: "Refresh status to confirm the outcome. Do not prepare a replacement." }, 202);
  } catch (error) {
    if (error instanceof ChainError) return jsonError(error.code, error.status);
    return jsonError("SUBMISSION_UNAVAILABLE", 503);
  }
}
