import { describe, expect, it } from "vitest";
import { validateActionState } from "../lib/chain/state";

const award = { status: "FUNDED", version: 1, contract_id: "contract", sponsor_hold: false, verifier_hold: false,
  evidence_revision: 1, evidence_digest: "a".repeat(64),
  claim_deadline: new Date(Date.now() + 60_000), review_deadline: new Date(Date.now() + 120_000), payout_deadline: new Date(Date.now() + 180_000) };
describe("contract-equivalent preparation gates", () => {
  it("denies funding twice, unapproved payment, early refund and funded cancellation", () => {
    for (const action of ["FUND", "PAY", "REFUND", "CANCEL"]) {
      expect(() => validateActionState(action, award, "1")).toThrow();
    }
  });
  it("denies stale versions and held approval/payment", () => {
    expect(() => validateActionState("SUBMIT", award, "0")).toThrow("STALE_VERSION");
    expect(() => validateActionState("APPROVE", { ...award, status: "SUBMITTED", verifier_hold: true }, "1")).toThrow("HELD");
    expect(() => validateActionState("PAY", { ...award, status: "APPROVED", sponsor_hold: true }, "1")).toThrow("HELD");
  });
  it("requires current evidence before approval", () => {
    expect(() => validateActionState("APPROVE", { ...award, status: "SUBMITTED", evidence_revision: 0, evidence_digest: "" }, "1")).toThrow("MISSING_EVIDENCE");
  });
  it("allows an expired held refund and rejects claims after their deadline", () => {
    expect(() => validateActionState("REFUND", { ...award, payout_deadline: new Date(0), sponsor_hold: true }, "1")).not.toThrow();
    expect(() => validateActionState("SUBMIT", { ...award, claim_deadline: new Date(0) }, "1")).toThrow("DEADLINE");
  });
  it("permits rejection of an approved claim and TTL without a business version", () => {
    expect(() => validateActionState("REJECT", { ...award, status: "APPROVED" }, "1")).not.toThrow();
    expect(() => validateActionState("EXTEND_TTL", award)).not.toThrow();
  });
});
