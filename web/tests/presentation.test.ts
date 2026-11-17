import { describe, expect, it } from "vitest";
import {
  homeCopy,
  nextStep,
  statusLines,
  trackerSteps,
  userActsNow,
} from "../lib/presentation";
import type { AppUser, AwardView, MemberView } from "../lib/types";

function member(role: MemberView["role"], userId: string): MemberView {
  return {
    user_id: userId,
    role,
    active: true,
    public_wallet: `G${role}${userId}`.padEnd(56, "A"),
  };
}

function award(partial: Partial<AwardView> & { status: AwardView["status"] }): AwardView {
  return {
    id: "a1",
    program_id: "p1",
    last_confirmed_ledger: 1,
    sponsor_hold: false,
    verifier_hold: false,
    evidence_revision: 0,
    evidence_digest: "",
    verifier_sync_required: false,
    sponsor_member: member("SPONSOR", "s"),
    verifier_member: member("VERIFIER", "v"),
    recipient_member: member("RECIPIENT", "r"),
    latest_evidence: null,
    unresolved_operation: false,
    ...partial,
  };
}

const sponsor: AppUser = {
  id: "s",
  username: "sponsor",
  is_staff: false,
  is_active: true,
};
const recipient: AppUser = {
  id: "r",
  username: "recipient",
  is_staff: false,
  is_active: true,
};

describe("presentation port", () => {
  it("shows not confirmed when ledger missing", () => {
    const a = award({ status: "FUNDED", last_confirmed_ledger: null });
    expect(statusLines(a)[0]).toBe("Not confirmed on-chain");
    expect(nextStep(a, sponsor)).toContain("Review award deployment");
  });

  it("does not treat recipient as acting on wait copy", () => {
    const a = award({ status: "SUBMITTED" });
    expect(userActsNow(a, recipient)).toBe(false);
    expect(nextStep(a, recipient)).toBe("Waiting for verifier review.");
  });

  it("marks paid tracker done", () => {
    const a = award({ status: "PAID" });
    const steps = trackerSteps(a);
    expect(steps.at(-1)?.mark).toBe("done");
    expect(statusLines(a)).toContain("Not a bank receipt.");
  });

  it("returns role home copy", () => {
    expect(homeCopy("SPONSOR").page_title).toBe("Sponsor workspace");
    expect(homeCopy(null).empty_register).toContain("No awards");
  });
});
