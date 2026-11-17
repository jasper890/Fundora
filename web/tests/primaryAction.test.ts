import { describe, expect, it } from "vitest";
import { primaryPrepareAction } from "@/lib/wallet/primaryAction";

describe("primaryPrepareAction", () => {
  it("offers DEPLOY for sponsor without ledger", () => {
    expect(
      primaryPrepareAction({
        role: "SPONSOR",
        status: "CREATED",
        hasLedger: false,
      }),
    ).toEqual({ action: "DEPLOY", label: "Review award deployment" });
  });

  it("offers FUND not PAY after deploy for CREATED", () => {
    expect(
      primaryPrepareAction({
        role: "SPONSOR",
        status: "CREATED",
        hasLedger: true,
      })?.action,
    ).toBe("FUND");
  });

  it("offers PAY only when APPROVED", () => {
    expect(
      primaryPrepareAction({
        role: "SPONSOR",
        status: "FUNDED",
        hasLedger: true,
      }),
    ).toBeNull();
    expect(
      primaryPrepareAction({
        role: "SPONSOR",
        status: "APPROVED",
        hasLedger: true,
      })?.action,
    ).toBe("PAY");
  });

  it("offers SUBMIT for recipient when evidence exists", () => {
    expect(
      primaryPrepareAction({
        role: "RECIPIENT",
        status: "FUNDED",
        hasLedger: true,
        hasEvidence: false,
      }),
    ).toBeNull();
    expect(
      primaryPrepareAction({
        role: "RECIPIENT",
        status: "FUNDED",
        hasLedger: true,
        hasEvidence: true,
      })?.action,
    ).toBe("SUBMIT");
  });

  it("offers APPROVE for verifier only when SUBMITTED", () => {
    expect(
      primaryPrepareAction({
        role: "VERIFIER",
        status: "FUNDED",
        hasLedger: true,
      }),
    ).toBeNull();
    expect(
      primaryPrepareAction({
        role: "VERIFIER",
        status: "SUBMITTED",
        hasLedger: true,
      })?.action,
    ).toBe("APPROVE");
  });
});
