import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authUser: vi.fn(),
  appUser: vi.fn(),
  awards: vi.fn(),
  program: vi.fn(),
  evidence: vi.fn(),
  context: vi.fn(),
  notes: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getRequestAuthUser: mocks.authUser }));
vi.mock("@/lib/awards/program", () => ({ loadProgramForUser: mocks.program }));
vi.mock("@/lib/awards/queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/awards/queries")>("@/lib/awards/queries");
  return {
    myRoles: actual.myRoles,
    loadAppUserByAuthId: mocks.appUser,
    listVisibleAwardsForUser: mocks.awards,
    loadEvidenceHistoryForUser: mocks.evidence,
    loadAwardMobileContext: mocks.context,
    loadReviewNotesForUser: mocks.notes,
  };
});
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ sql: () => async () => [{ version: "3" }] }));

import { GET as list } from "@/app/api/v1/awards/route";
import { GET as detail } from "@/app/api/v1/awards/[id]/route";

const award = {
  id: "a1",
  program_id: "p1",
  sponsor_member: { user_id: "s1", role: "SPONSOR", active: true },
  verifier_member: { user_id: "v1", role: "VERIFIER", active: true },
  recipient_member: { user_id: "r1", role: "RECIPIENT", active: true },
  verifier_sync_required: false,
};
const req = () => new Request("https://proofpay.test/api/v1/awards");
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

describe("mobile award read routes", () => {
  beforeEach(() => {
    mocks.authUser.mockReset().mockResolvedValue({ id: "r1" });
    mocks.appUser.mockReset().mockResolvedValue({ id: "r1", is_active: true });
    mocks.awards.mockReset().mockResolvedValue([award]);
    mocks.program.mockReset().mockResolvedValue({ id: "p1", title: "Cleanup", requirements_text: "Attend", claim_deadline: "x", review_deadline: "y", payout_deadline: "z" });
    mocks.evidence.mockReset().mockResolvedValue([]);
    mocks.context.mockReset().mockResolvedValue(new Map([["a1", {
      deadlines: { claim: "2026-12-01T00:00:00.000Z", review: "2026-12-08T00:00:00.000Z", payout: "2026-12-15T00:00:00.000Z" },
      my_open_operation: true,
      changes_requested: true,
    }]]));
    mocks.notes.mockReset().mockResolvedValue([{ id: "n1", kind: "REQUEST_CHANGES", note: "Add the sign-in sheet" }]);
  });

  it("requires a session", async () => {
    mocks.authUser.mockResolvedValue(null);
    expect((await list(req())).status).toBe(401);
    expect((await detail(req(), ctx("a1"))).status).toBe(401);
  });

  it("lists only the user's visible awards with their roles and the fixed amount", async () => {
    const body = await (await list(req())).json();
    expect(mocks.awards).toHaveBeenCalledWith({ id: "r1", is_active: true });
    expect(body.amount_base_units).toBe("200000000");
    expect(body.awards[0].my_roles).toEqual(["RECIPIENT"]);
    expect(mocks.context).toHaveBeenCalledWith(["a1"], "r1");
    expect(body.awards[0]).toMatchObject({ my_open_operation: true, changes_requested: true, deadlines: { claim: "2026-12-01T00:00:00.000Z" } });
  });

  it("reports only roles the user currently holds", async () => {
    const { myRoles } = await vi.importActual<typeof import("@/lib/awards/queries")>("@/lib/awards/queries");
    const both = { ...award, verifier_member: { user_id: "r1", role: "VERIFIER", active: true } };
    expect(myRoles(both, "r1")).toEqual(["VERIFIER", "RECIPIENT"]);
    expect(myRoles({ ...both, verifier_sync_required: true }, "r1")).toEqual(["RECIPIENT"]);
    expect(myRoles({ ...both, recipient_member: { ...both.recipient_member, active: false } }, "r1")).toEqual(["VERIFIER"]);
  });

  it("returns 404 for an award outside the user's visible set", async () => {
    expect((await detail(req(), ctx("someone-elses"))).status).toBe(404);
    expect(mocks.evidence).not.toHaveBeenCalled();
    expect(mocks.notes).not.toHaveBeenCalled();
  });

  it("returns terms and evidence for a visible award", async () => {
    const response = await detail(req(), ctx("a1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.program.title).toBe("Cleanup");
    expect(body.evidence).toEqual([]);
    expect(body.award.version).toBe("3");
    expect(mocks.notes).toHaveBeenCalledWith("a1", { id: "r1", is_active: true });
    expect(body.notes[0]).toMatchObject({ kind: "REQUEST_CHANGES", note: "Add the sign-in sheet" });
  });
});
