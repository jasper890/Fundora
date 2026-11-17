import { describe, expect, it } from "vitest";
import { memberAssignmentChanges } from "@/lib/awards/memberAssignment";

const assigned = {
  role: "RECIPIENT" as const,
  public_wallet: "GRECIPIENT",
  active: true,
};

describe("award-referenced member assignments", () => {
  it("detects changes to role, wallet, or active state", () => {
    expect(memberAssignmentChanges(assigned, assigned)).toBe(false);
    expect(memberAssignmentChanges(assigned, { ...assigned, role: "VERIFIER" })).toBe(true);
    expect(memberAssignmentChanges(assigned, { ...assigned, public_wallet: "GOTHER" })).toBe(true);
    expect(memberAssignmentChanges(assigned, { ...assigned, active: false })).toBe(true);
  });
});
