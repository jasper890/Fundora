import { ChainError } from "./constants";

/** Mirror contract eligibility in both FakeRpc and live preparation. */
export function validateActionState(action: string, award: Record<string, unknown>, expectedVersion?: string, now = Date.now()) {
  const status = String(award.status);
  const terminal = ["PAID", "REFUNDED", "CANCELLED"].includes(status);
  if (action === "DEPLOY") {
    if (award.contract_id || status !== "CREATED") throw new ChainError("ALREADY_DEPLOYED");
    const claimDeadline = new Date(String(award.claim_deadline)).getTime();
    if (!Number.isFinite(claimDeadline) || now >= claimDeadline) throw new ChainError("DEADLINE");
    return;
  }
  if (!award.contract_id) throw new ChainError("DEPLOYMENT_UNAVAILABLE");
  if (action === "EXTEND_TTL") return;
  if (String(award.version) !== expectedVersion) throw new ChainError("STALE_VERSION");
  const allowed: Record<string, string[]> = {
    FUND: ["CREATED"], CANCEL: ["CREATED"], SUBMIT: ["FUNDED", "SUBMITTED"],
    APPROVE: ["SUBMITTED"], REJECT: ["SUBMITTED", "APPROVED"], REOPEN: ["REJECTED", "APPROVED"],
    PAY: ["APPROVED"], REFUND: ["FUNDED", "SUBMITTED", "APPROVED", "REJECTED"],
    SET_HOLD: ["FUNDED", "SUBMITTED", "APPROVED", "REJECTED"],
    REPLACE_VERIFIER: ["CREATED", "FUNDED", "SUBMITTED", "APPROVED", "REJECTED"],
  };
  if (terminal || !allowed[action]?.includes(status)) throw new ChainError("INVALID_STATE");
  if (action === "APPROVE" && (!Number(award.evidence_revision) || !award.evidence_digest || /^0+$/.test(String(award.evidence_digest)))) {
    throw new ChainError("MISSING_EVIDENCE");
  }
  if (["APPROVE", "PAY"].includes(action) && (award.sponsor_hold || award.verifier_hold)) throw new ChainError("HELD");
  const deadline = ["FUND", "SUBMIT"].includes(action) ? "claim_deadline"
    : ["APPROVE", "REJECT", "REOPEN", "REPLACE_VERIFIER"].includes(action) ? "review_deadline"
    : ["PAY", "REFUND"].includes(action) ? "payout_deadline" : null;
  if (deadline) {
    const cutoff = new Date(String(award[deadline])).getTime();
    if (!Number.isFinite(cutoff) || (action === "REFUND" ? now <= cutoff : now > cutoff)) throw new ChainError("DEADLINE");
  }
}
