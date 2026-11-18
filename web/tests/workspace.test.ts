import { describe, expect, it } from "vitest";
import * as presentation from "../lib/presentation";
import type { AppUser, AwardView, MemberView } from "../lib/types";

type SponsorView = "needs-action" | "awaiting-review" | "all-awards";
type WorkspaceHelpers = {
  selectSponsorWorkspaceAwards(awards: AwardView[], user: AppUser, view: SponsorView): AwardView[];
  sponsorWorkspaceCounts(awards: AwardView[], user: AppUser): Record<SponsorView, number>;
  confirmedFundingSummary(counts: Record<string, number>): {
    fundedAwards: number;
    confirmedBaseUnits: number;
    reservedBaseUnits: number;
  };
  formatTestnetXlm(baseUnits: number): string;
  confirmedAwardStatusCounts(awards: AwardView[]): Partial<Record<AwardView["status"], number>>;
};

const workspace = presentation as unknown as Partial<WorkspaceHelpers>;

function member(role: MemberView["role"], userId: string): MemberView {
  return {
    user_id: userId,
    role,
    active: true,
    public_wallet: ["G", role, userId].join("").padEnd(56, "A"),
  };
}

function award(id: string, status: AwardView["status"], partial: Partial<AwardView> = {}): AwardView {
  return {
    id,
    program_id: "p1",
    status,
    last_confirmed_ledger: 10,
    sponsor_hold: false,
    verifier_hold: false,
    evidence_revision: 1,
    evidence_digest: "digest",
    verifier_sync_required: false,
    sponsor_member: member("SPONSOR", "sponsor"),
    verifier_member: member("VERIFIER", "verifier"),
    recipient_member: member("RECIPIENT", "recipient-" + id),
    latest_evidence: { revision: 1, digest: "digest" },
    unresolved_operation: false,
    ...partial,
  };
}

const sponsor: AppUser = {
  id: "sponsor",
  username: "sponsor",
  is_staff: false,
  is_active: true,
};

describe("sponsor workspace presentation", () => {
  it("places actionable and unresolved awards in Needs action", () => {
    expect(typeof workspace.selectSponsorWorkspaceAwards).toBe("function");
    const select = workspace.selectSponsorWorkspaceAwards!;
    const awards = [
      award("waiting", "SUBMITTED"),
      award("paid", "PAID"),
      award("unknown", "APPROVED", { unresolved_operation: true }),
      award("approved", "APPROVED"),
    ];

    expect(select(awards, sponsor, "needs-action").map((item) => item.id)).toEqual([
      "unknown",
      "approved",
    ]);
  });

  it("puts confirmed submissions awaiting verifier review in their own view", () => {
    const select = workspace.selectSponsorWorkspaceAwards!;
    const awards = [
      award("review", "SUBMITTED"),
      award("unsigned", "SUBMITTED", {
        latest_evidence_revision: 2,
        latest_evidence: { revision: 2, digest: "pending" },
      }),
      award("unconfirmed", "SUBMITTED", { last_confirmed_ledger: null }),
      award("held", "SUBMITTED", { sponsor_hold: true }),
      award("unknown", "SUBMITTED", { unresolved_operation: true }),
    ];

    expect(select(awards, sponsor, "awaiting-review").map((item) => item.id)).toEqual([
      "review",
    ]);
  });

  it("keeps every award reachable in All awards and counts records before filters", () => {
    const select = workspace.selectSponsorWorkspaceAwards!;
    const counts = workspace.sponsorWorkspaceCounts!;
    const awards = [
      award("waiting", "SUBMITTED"),
      award("paid", "PAID"),
      award("unknown", "APPROVED", { unresolved_operation: true }),
    ];

    expect(select(awards, sponsor, "all-awards").map((item) => item.id).sort()).toEqual([
      "paid",
      "unknown",
      "waiting",
    ]);
    expect(counts(awards, sponsor)).toEqual({
      "needs-action": 1,
      "awaiting-review": 1,
      "all-awards": 3,
    });
  });

  it("summarizes confirmed funding and unpaid reserves with integer XLM formatting", () => {
    expect(typeof workspace.confirmedFundingSummary).toBe("function");
    expect(workspace.confirmedFundingSummary!({
      CREATED: 4,
      FUNDED: 2,
      SUBMITTED: 1,
      APPROVED: 1,
      REJECTED: 1,
      PAID: 2,
      REFUNDED: 1,
      CANCELLED: 1,
    })).toEqual({
      fundedAwards: 8,
      confirmedBaseUnits: 1_600_000_000,
      reservedBaseUnits: 1_000_000_000,
    });
    expect(workspace.formatTestnetXlm!(200_000_000)).toBe("20");
    expect(workspace.formatTestnetXlm!(200_000_001)).toBe("20.0000001");
  });
});

type RegisterAward = AwardView & { recipient_username: string };
type RegisterFilters = {
  search: string;
  status: "ALL" | AwardView["status"];
  sort: "priority" | "participant" | "status";
};

const filterWorkspace = presentation as unknown as {
  filterSponsorWorkspaceAwards(
    awards: RegisterAward[],
    filters: RegisterFilters,
  user: AppUser,
  ): RegisterAward[];
};

describe("sponsor register filters", () => {
  it("searches participant names, filters status, and sorts by participant", () => {
    const rows = [
      Object.assign(award("a2", "APPROVED"), { recipient_username: "Mina" }),
      Object.assign(award("a1", "APPROVED"), { recipient_username: "Ari" }),
      Object.assign(award("a3", "PAID"), { recipient_username: "Arielle" }),
    ];

    expect(
      filterWorkspace
        .filterSponsorWorkspaceAwards(rows, {
          search: " ARI ",
          status: "APPROVED",
          sort: "participant",
        }, sponsor)
        .map((item) => item.id),
    ).toEqual(["a1"]);
  });
});

describe("workspace program selection", () => {
  const verifier = { id: "verifier-program", role: "VERIFIER" };
  const sponsor = { id: "sponsor-program", role: "SPONSOR" };
  const recipient = { id: "recipient-program", role: "RECIPIENT" };

  it("prefers a sponsor program when the request does not name one", () => {
    expect(presentation.selectWorkspaceProgram([verifier, recipient, sponsor], "")).toEqual(
      sponsor,
    );
  });

  it("keeps an explicit verifier or recipient program", () => {
    expect(presentation.selectWorkspaceProgram([sponsor, verifier], verifier.id)).toEqual(
      verifier,
    );
    expect(presentation.selectWorkspaceProgram([recipient], "")).toEqual(recipient);
  });

  it("falls back to a sponsor program when the requested id is not a membership", () => {
    expect(presentation.selectWorkspaceProgram([verifier, sponsor], "missing")).toEqual(sponsor);
    expect(presentation.selectWorkspaceProgram([], "")).toBeNull();
  });
});

describe("sponsor register confirmation and return navigation", () => {
  it("counts funding only when the award has a confirmed ledger", () => {
    expect(workspace.confirmedAwardStatusCounts!([
      award("confirmed", "FUNDED"),
      award("paid", "PAID"),
      award("unconfirmed", "SUBMITTED", { last_confirmed_ledger: null }),
    ])).toEqual({ FUNDED: 1, PAID: 1 });
  });

  it("accepts only same-app program return paths", () => {
    expect(presentation.safeProgramReturnHref("/programs?view=all-awards#focus=a1")).toBe(
      "/programs?view=all-awards#focus=a1",
    );
    expect(presentation.safeProgramReturnHref("//example.com")).toBe("/programs");
    expect(presentation.safeProgramReturnHref("/awards/a1")).toBe("/programs");
  });
});
