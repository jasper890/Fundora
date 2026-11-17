import { describe, expect, it } from "vitest";
import {
  primaryPrepareAction,
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

  it("offers submission only for a new evidence revision before claim cutoff", () => {
    const recipient = context({
      role: "RECIPIENT",
      status: "FUNDED",
      hasEvidence: true,
    });
    expect(primaryPrepareAction(recipient)?.action).toBe("SUBMIT");
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
