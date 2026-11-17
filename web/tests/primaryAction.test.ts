import { describe, expect, it } from "vitest";
import {
  primaryPrepareAction,
  secondaryPrepareActions,
  type ActionContext,
} from "@/lib/wallet/primaryAction";

const now = Date.parse("2026-11-17T00:00:00Z");
const deadlines = {
  claimDeadline: new Date(now + 60_000).toISOString(),
  reviewDeadline: new Date(now + 120_000).toISOString(),
  payoutDeadline: new Date(now + 180_000).toISOString(),
};

function context(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    role: "SPONSOR",
    status: "CREATED",
    hasLedger: true,
    hasHold: false,
    verifierSyncRequired: false,
    ...deadlines,
    now,
    ...overrides,
  };
}

describe("primaryPrepareAction", () => {
  it("offers deployment before the immutable claim deadline", () => {
    expect(primaryPrepareAction(context({ hasLedger: false }))?.action).toBe(
      "DEPLOY",
    );
    expect(
      primaryPrepareAction({
        ...context({ hasLedger: false }),
        now: Date.parse(deadlines.claimDeadline),
      }),
    ).toBeNull();
  });

  it("offers funding through the exact claim deadline", () => {
    expect(primaryPrepareAction(context())?.action).toBe("FUND");
    expect(
      primaryPrepareAction({
        ...context(),
        now: Date.parse(deadlines.claimDeadline),
      })?.action,
    ).toBe("FUND");
    expect(
      primaryPrepareAction({
        ...context(),
        now: Date.parse(deadlines.claimDeadline) + 1,
      }),
    ).toBeNull();
  });

  it("blocks payment when held or after the payout deadline", () => {
    expect(
      primaryPrepareAction(context({ status: "APPROVED" }))?.action,
    ).toBe("PAY");
    expect(
      primaryPrepareAction(context({ status: "APPROVED", hasHold: true })),
    ).toBeNull();
    expect(
      primaryPrepareAction({
        ...context({ status: "APPROVED" }),
        now: Date.parse(deadlines.payoutDeadline) + 1,
      }),
    ).toBeNull();
  });

  it("blocks payment while a local evidence revision still needs chain synchronization", () => {
    expect(
      primaryPrepareAction(
        context({ status: "APPROVED", verifierSyncRequired: true }),
      ),
    ).toBeNull();
  });

  it("offers submission only for a new evidence revision before claim cutoff", () => {
    const recipient = context({
      role: "RECIPIENT",
      status: "FUNDED",
      hasEvidence: true,
    });
    expect(primaryPrepareAction(recipient)?.action).toBe("SUBMIT");
    expect(primaryPrepareAction({ ...recipient, verifierSyncRequired: true })?.action).toBe("SUBMIT");
    expect(
      primaryPrepareAction({ ...recipient, hasEvidence: false }),
    ).toBeNull();
    expect(
      primaryPrepareAction({
        ...recipient,
        status: "SUBMITTED",
        now: Date.parse(deadlines.claimDeadline) + 1,
      }),
    ).toBeNull();
  });

  it("blocks approval while held or after the review deadline", () => {
    const verifier = context({ role: "VERIFIER", status: "SUBMITTED" });
    expect(primaryPrepareAction(verifier)?.action).toBe("APPROVE");
    expect(
      primaryPrepareAction({ ...verifier, hasHold: true }),
    ).toBeNull();
    expect(
      primaryPrepareAction({
        ...verifier,
        now: Date.parse(deadlines.reviewDeadline) + 1,
      }),
    ).toBeNull();
  });

  it("offers no primary action for terminal awards or a stale verifier", () => {
    for (const status of ["PAID", "REFUNDED", "CANCELLED"] as const) {
      expect(primaryPrepareAction(context({ status }))).toBeNull();
    }
    expect(
      primaryPrepareAction(
        context({
          role: "VERIFIER",
          status: "SUBMITTED",
          verifierSyncRequired: true,
        }),
      ),
    ).toBeNull();
  });
});

describe("secondaryPrepareActions", () => {
  function actions(overrides: Partial<ActionContext> = {}, ownHold = false) {
    return secondaryPrepareActions({ ...context(overrides), ownHold });
  }

  it("allows only the sponsor to cancel a deployed, unfunded award at any claim time", () => {
    for (const now of [Date.parse(deadlines.claimDeadline) - 1, Date.parse(deadlines.claimDeadline), Date.parse(deadlines.claimDeadline) + 1]) {
      expect(actions({ status: "CREATED", now }).map((a) => a.action)).toContain("CANCEL");
    }
    expect(actions({ role: "VERIFIER", status: "CREATED" }).map((a) => a.action)).not.toContain("CANCEL");
    expect(actions({ status: "FUNDED" }).map((a) => a.action)).not.toContain("CANCEL");
  });

  it("allows a sponsor to refund any held, funded unpaid state only after expiry", () => {
    const expiry = Date.parse(deadlines.payoutDeadline);
    for (const status of ["FUNDED", "SUBMITTED", "APPROVED", "REJECTED"] as const) {
      expect(actions({ status, hasHold: true, now: expiry - 1 }).map((a) => a.action)).not.toContain("REFUND");
      expect(actions({ status, hasHold: true, now: expiry }).map((a) => a.action)).not.toContain("REFUND");
      expect(actions({ status, hasHold: true, now: expiry + 1 }).map((a) => a.action)).toContain("REFUND");
    }
    expect(actions({ role: "VERIFIER", status: "REJECTED", now: expiry + 1 }).map((a) => a.action)).not.toContain("REFUND");
  });

  it("allows each reviewer to manage their own hold after deadlines", () => {
    for (const role of ["SPONSOR", "VERIFIER"] as const) {
      const held = actions({ role, status: "REJECTED", now: Date.parse(deadlines.payoutDeadline) + 1 }, true);
      expect(held.find((a) => a.action === "SET_HOLD")?.label).toBe("Prepare removal of your hold");
    }
    expect(actions({ role: "RECIPIENT", status: "FUNDED" }).map((a) => a.action)).not.toContain("SET_HOLD");
  });

  it("offers reject/reopen while held, and stops at the review cutoff", () => {
    const verifier = { role: "VERIFIER" as const, status: "APPROVED" as const, hasHold: true };
    expect(actions({ ...verifier, now: Date.parse(deadlines.reviewDeadline) }).map((a) => a.action)).toEqual(["SET_HOLD", "REJECT", "REOPEN", "EXTEND_TTL"]);
    expect(actions({ ...verifier, now: Date.parse(deadlines.reviewDeadline) + 1 }).map((a) => a.action)).toEqual(["SET_HOLD", "EXTEND_TTL"]);
    expect(actions({ role: "VERIFIER", status: "SUBMITTED" }).map((a) => a.action)).toContain("REJECT");
    expect(actions({ role: "VERIFIER", status: "REJECTED" }).map((a) => a.action)).toContain("REOPEN");
    expect(actions({ role: "SPONSOR", status: "APPROVED" }).map((a) => a.action)).not.toContain("REJECT");
    expect(actions({ role: "SPONSOR", status: "REJECTED" }).map((a) => a.action)).not.toContain("REOPEN");
  });

  it("limits replacement to the sponsor before review expiry", () => {
    expect(actions({ status: "APPROVED" }).map((a) => a.action)).toContain("REPLACE_VERIFIER");
    expect(actions({ role: "VERIFIER", status: "APPROVED" }).map((a) => a.action)).not.toContain("REPLACE_VERIFIER");
    expect(actions({ status: "APPROVED", now: Date.parse(deadlines.reviewDeadline) }).map((a) => a.action)).toContain("REPLACE_VERIFIER");
    expect(actions({ now: Date.parse(deadlines.reviewDeadline) + 1 }).map((a) => a.action)).not.toContain("REPLACE_VERIFIER");
    expect(actions({ status: "CANCELLED" }).map((a) => a.action)).not.toContain("REPLACE_VERIFIER");
  });

  it("keeps only TTL on terminal awards, and none for undeployed awards or stale verifiers", () => {
    for (const status of ["PAID", "REFUNDED", "CANCELLED"] as const) {
      expect(actions({ status }).map((a) => a.action)).toEqual(["EXTEND_TTL"]);
    }
    expect(actions({ hasLedger: false })).toEqual([]);
    expect(actions({ role: null })).toEqual([]);
    expect(actions({ role: "VERIFIER", verifierSyncRequired: true, status: "SUBMITTED" })).toEqual([]);
    expect(actions({ role: "RECIPIENT", status: "PAID" }).map((a) => a.action)).toEqual(["EXTEND_TTL"]);
  });
});
