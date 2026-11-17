import { describe, expect, it } from "vitest";
import {
  canExportAward,
  canReadOperationStatus,
  hasAwardRole,
  isAwardVisible,
} from "@/lib/permissions";
import type { AppUser, AwardView } from "@/lib/types";

const award: AwardView = {
  id: "award-1",
  program_id: "program-1",
  status: "SUBMITTED",
  verifier_sync_required: false,
  last_confirmed_ledger: 10,
  sponsor_hold: false,
  verifier_hold: false,
  evidence_revision: 1,
  evidence_digest: "digest",
  sponsor_member: {
    user_id: "sponsor",
    role: "SPONSOR",
    active: true,
    public_wallet: "GSPONSOR",
  },
  verifier_member: {
    user_id: "verifier",
    role: "VERIFIER",
    active: true,
    public_wallet: "GVERIFIER",
  },
  recipient_member: {
    user_id: "recipient",
    role: "RECIPIENT",
    active: true,
    public_wallet: "GRECIPIENT",
  },
  latest_evidence: { revision: 1, digest: "digest" },
  unresolved_operation: false,
};

const admin: AppUser = {
  id: "admin",
  username: "admin",
  is_staff: true,
  is_active: true,
};

describe("award role boundaries", () => {
  it("does not grant staff automatic award, export, review, or operation access", () => {
    expect(isAwardVisible(award, admin)).toBe(false);
    expect(canExportAward(admin, award)).toBe(false);
    expect(hasAwardRole(admin, award, ["VERIFIER"])).toBe(false);
    expect(canReadOperationStatus(admin, "sponsor", award)).toBe(false);
  });

  it("allows current sponsor and verifier exports, but not recipients", () => {
    const user = (id: string): AppUser => ({
      id,
      username: id,
      is_staff: false,
      is_active: true,
    });
    expect(canExportAward(user("sponsor"), award)).toBe(true);
    expect(canExportAward(user("verifier"), award)).toBe(true);
    expect(canExportAward(user("recipient"), award)).toBe(false);
    expect(canReadOperationStatus(user("recipient"), "recipient", award)).toBe(true);
    expect(canReadOperationStatus(user("recipient"), "sponsor", award)).toBe(false);
  });

  it("removes verifier review/export/access during a pending confirmed rotation sync", () => {
    const pending = { ...award, verifier_sync_required: true };
    const verifier = { ...admin, id: "verifier", is_staff: false };
    expect(isAwardVisible(pending, verifier)).toBe(false);
    expect(canExportAward(verifier, pending)).toBe(false);
    expect(hasAwardRole(verifier, pending, ["VERIFIER"])).toBe(false);
    expect(canReadOperationStatus(verifier, "someone-else", pending)).toBe(false);
  });

  it("allows an operation actor to poll their own operation", () => {
    expect(canReadOperationStatus(admin, admin.id, award)).toBe(true);
  });
});
