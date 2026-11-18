/**
 * Port of proofpay/presentation.py — display-only award copy.
 * Never writes to the database or prepares chain actions.
 */
import { AWARD_AMOUNT } from "./types";
import type {
  AwardStatus,
  AwardView,
  AppUser,
  HomeCopy,
  Role,
  TrackerStep,
} from "./types";

const CONFIRMED_PRIMARY: Record<AwardStatus, string> = {
  CREATED: "Award created. Not funded yet.",
  FUNDED: "Award funded. Submission needed.",
  SUBMITTED: "Waiting for verifier review.",
  APPROVED: "Approved. Waiting for sponsor release.",
  REJECTED: "Submission rejected by the verifier.",
  PAID: "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
  REFUNDED: "Unpaid funds returned to the sponsor.",
  CANCELLED: "Award cancelled before funding.",
};

const HAPPY_PATH: [AwardStatus, string][] = [
  ["CREATED", "Award created. Not funded yet."],
  ["FUNDED", "Award funded. Submission needed."],
  ["SUBMITTED", "Waiting for verifier review."],
  ["APPROVED", "Approved. Waiting for sponsor release."],
  ["PAID", "Payment confirmed: 20 Testnet XLM sent to your assigned wallet."],
];

const RANK: Partial<Record<AwardStatus, number>> = {
  CREATED: 0,
  FUNDED: 1,
  SUBMITTED: 2,
  APPROVED: 3,
  PAID: 4,
};

function hasLocalUnsignedEvidence(award: AwardView): boolean {
  const latest = award.latest_evidence;
  if (latest === null) return false;
  if (award.verifier_sync_required) return true;
  if (!award.last_confirmed_ledger) return true;
  return !(
    award.evidence_revision === latest.revision &&
    award.evidence_digest === latest.digest &&
    (award.status === "SUBMITTED" ||
      award.status === "APPROVED" ||
      award.status === "REJECTED" ||
      award.status === "PAID" ||
      award.status === "REFUNDED")
  );
}

function roleFor(award: AwardView, user: AppUser): Role | null {
  if (award.sponsor_member.user_id === user.id && award.sponsor_member.active) {
    return "SPONSOR";
  }
  if (award.verifier_member.user_id === user.id && award.verifier_member.active) {
    return "VERIFIER";
  }
  if (
    award.recipient_member.user_id === user.id &&
    award.recipient_member.active
  ) {
    return "RECIPIENT";
  }
  return null;
}

export function statusLines(award: AwardView): string[] {
  if (!award.last_confirmed_ledger) {
    return [
      "Not confirmed on-chain",
      "This page does not confirm funding or payment.",
    ];
  }

  const lines: string[] = [];
  if (["FUNDED", "SUBMITTED"].includes(award.status) && hasLocalUnsignedEvidence(award)) {
    lines.push("Evidence saved. Submission not yet signed.");
  } else {
    lines.push(CONFIRMED_PRIMARY[award.status] ?? award.status);
  }

  if (award.status === "PAID") {
    lines.push("Not a bank receipt.");
  }

  if (award.sponsor_hold || award.verifier_hold) {
    lines.push("Review hold active. Payment is blocked.");
  }

  if (award.unresolved_operation) {
    lines.push("Outcome not confirmed. We are checking Stellar.");
  }

  return lines;
}

export function nextStep(award: AwardView, user: AppUser): string {
  const role = roleFor(award, user);

  if (!award.last_confirmed_ledger) {
    if (role === "SPONSOR") {
      return "Review award deployment. Signing is not confirmation.";
    }
    return "Wait for a confirmed chain snapshot before treating this as funded or paid.";
  }

  if (award.sponsor_hold || award.verifier_hold) {
    if (role === "SPONSOR" || role === "VERIFIER") {
      return "Review the hold. Payment stays blocked until it is cleared.";
    }
    return "Payment is blocked by a review hold.";
  }

  if (award.unresolved_operation) {
    return "Refresh status. Do not prepare a second payment.";
  }

  const status = award.status;
  if (status === "CREATED") {
    if (role === "SPONSOR") return "Review funding. Signing is not confirmation.";
    return "Waiting for the sponsor to fund this award.";
  }

  if (["FUNDED", "SUBMITTED"].includes(status) && hasLocalUnsignedEvidence(award)) {
    if (role === "RECIPIENT") return "Review and sign submission.";
    return "Waiting for the recipient to sign submission.";
  }

  if (status === "FUNDED") {
    if (role === "RECIPIENT") return "Add completion evidence.";
    return "Waiting for the recipient to add completion evidence.";
  }

  if (status === "SUBMITTED") {
    if (role === "VERIFIER") {
      return "Check the original source, then request approval or changes.";
    }
    return "Waiting for verifier review.";
  }

  if (status === "APPROVED") {
    if (role === "SPONSOR") {
      return "Review payment. Signing is not confirmation.";
    }
    return "Waiting for the sponsor to release payment.";
  }

  if (status === "REJECTED") {
    if (role === "RECIPIENT") {
      return "Review the rejection and any permitted dispute path.";
    }
    if (role === "VERIFIER") {
      return "Rejection is recorded. Reopening requires a separate action.";
    }
    return "Review the rejected submission.";
  }

  if (status === "PAID") {
    return "Payment is confirmed on Testnet. View the audit record if you need the transaction.";
  }

  if (status === "REFUNDED") {
    return "Unpaid funds were returned to the sponsor. No award payment was made.";
  }

  if (status === "CANCELLED") {
    return "This award was cancelled before funding.";
  }

  return "Open the award for the current terms and history.";
}

export function userActsNow(award: AwardView, user: AppUser): boolean {
  const role = roleFor(award, user);
  if (role === null) return false;
  const step = nextStep(award, user);
  if (step.startsWith("Waiting for") || step.startsWith("Wait for")) return false;
  if (
    step.startsWith("Payment is blocked by") ||
    step.startsWith("Payment is confirmed") ||
    step.startsWith("Unpaid funds were") ||
    step.startsWith("This award was cancelled") ||
    step.startsWith("Rejection is recorded") ||
    step.startsWith("Open the award")
  ) {
    return false;
  }
  return true;
}

export function sortAwardsForHome(
  awards: AwardView[],
  user: AppUser,
): AwardView[] {
  const actionable: AwardView[] = [];
  const waiting: AwardView[] = [];
  for (const award of awards) {
    if (userActsNow(award, user)) actionable.push(award);
    else waiting.push(award);
  }
  return actionable.concat(waiting);
}

export function pickUpcomingAward(
  awards: AwardView[],
  user: AppUser,
): AwardView | null {
  for (const award of awards) {
    if (userActsNow(award, user)) return award;
  }
  return null;
}

export function homeCopy(role: Role | null): HomeCopy {
  if (role === "SPONSOR") {
    return {
      page_title: "Sponsor workspace",
      upcoming_title: "Upcoming action",
      register_title: "Award register",
      empty_upcoming: "Nothing needs funding or release right now.",
      empty_register: "No awards are assigned to this account yet.",
      primary_label: "Open award",
    };
  }
  if (role === "VERIFIER") {
    return {
      page_title: "Verifier workspace",
      upcoming_title: "Upcoming action",
      register_title: "Award register",
      empty_upcoming: "No submissions need a source check right now.",
      empty_register: "No awards are assigned to this account yet.",
      primary_label: "Open award",
    };
  }
  if (role === "RECIPIENT") {
    return {
      page_title: "Your awards",
      upcoming_title: "Upcoming action",
      register_title: "Award register",
      empty_upcoming: "Nothing needs your evidence or signature right now.",
      empty_register: "No awards are assigned to this account yet.",
      primary_label: "Open award",
    };
  }
  return {
    page_title: "Your programs",
    upcoming_title: "Upcoming action",
    register_title: "Award register",
    empty_upcoming: "Nothing needs your action right now.",
    empty_register: "No awards are assigned to this account yet.",
    primary_label: "Open award",
  };
}

export function trackerSteps(award: AwardView): TrackerStep[] {
  const primary = statusLines(award)[0];

  if (!award.last_confirmed_ledger) {
    return [
      { label: primary, mark: "current" },
      { label: "Award funded. Submission needed.", mark: "waiting" },
      { label: "Waiting for verifier review.", mark: "waiting" },
      { label: "Approved. Waiting for sponsor release.", mark: "waiting" },
      {
        label:
          "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
        mark: "waiting",
      },
    ];
  }

  if (award.status === "REJECTED") {
    return [
      { label: "Award funded. Submission needed.", mark: "done" },
      { label: primary, mark: "current" },
      { label: "Approved. Waiting for sponsor release.", mark: "waiting" },
      {
        label:
          "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
        mark: "waiting",
      },
    ];
  }

  if (award.status === "REFUNDED") {
    return [
      { label: "Award funded. Submission needed.", mark: "done" },
      { label: primary, mark: "current" },
      {
        label:
          "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
        mark: "waiting",
      },
    ];
  }

  if (award.status === "CANCELLED") {
    return [
      { label: primary, mark: "current" },
      { label: "Award funded. Submission needed.", mark: "waiting" },
      { label: "Waiting for verifier review.", mark: "waiting" },
      { label: "Approved. Waiting for sponsor release.", mark: "waiting" },
      {
        label:
          "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
        mark: "waiting",
      },
    ];
  }

  if (award.status === "FUNDED" && hasLocalUnsignedEvidence(award)) {
    return [
      { label: "Award funded. Submission needed.", mark: "done" },
      { label: primary, mark: "current" },
      { label: "Waiting for verifier review.", mark: "waiting" },
      { label: "Approved. Waiting for sponsor release.", mark: "waiting" },
      {
        label:
          "Payment confirmed: 20 Testnet XLM sent to your assigned wallet.",
        mark: "waiting",
      },
    ];
  }

  const rank = RANK[award.status];
  if (rank === undefined) {
    return [{ label: primary, mark: "current" }];
  }

  const steps: TrackerStep[] = [];
  for (const [status, label] of HAPPY_PATH) {
    const stepRank = RANK[status]!;
    if (stepRank < rank) {
      steps.push({ label, mark: "done" });
    } else if (stepRank === rank) {
      steps.push({
        label: primary,
        mark: status === "PAID" ? "done" : "current",
      });
    } else {
      steps.push({ label, mark: "waiting" });
    }
  }
  return steps;
}

export type SponsorWorkspaceView =
  | "needs-action"
  | "awaiting-review"
  | "all-awards";

export type ConfirmedFundingSummary = {
  fundedAwards: number;
  confirmedBaseUnits: number;
  reservedBaseUnits: number;
};

export function selectSponsorWorkspaceAwards<T extends AwardView>(
  awards: T[],
  user: AppUser,
  view: SponsorWorkspaceView,
): T[] {
  const ordered = sortAwardsForHome(awards, user) as T[];

  if (view === "needs-action") {
    return ordered.filter((award) => userActsNow(award, user));
  }

  if (view === "awaiting-review") {
    return ordered.filter(
      (award) =>
        award.status === "SUBMITTED" &&
        award.last_confirmed_ledger !== null &&
        !award.sponsor_hold &&
        !award.verifier_hold &&
        !award.unresolved_operation &&
        !award.verifier_sync_required &&
        award.latest_evidence !== null &&
        award.evidence_revision === award.latest_evidence.revision &&
        award.evidence_digest === award.latest_evidence.digest &&
        !userActsNow(award, user),
    );
  }

  return ordered;
}

export function sponsorWorkspaceCounts(
  awards: AwardView[],
  user: AppUser,
): Record<SponsorWorkspaceView, number> {
  return {
    "needs-action": selectSponsorWorkspaceAwards(awards, user, "needs-action").length,
    "awaiting-review": selectSponsorWorkspaceAwards(awards, user, "awaiting-review").length,
    "all-awards": awards.length,
  };
}

export function confirmedFundingSummary(
  counts: Partial<Record<AwardStatus, number>>,
): ConfirmedFundingSummary {
  const count = (status: AwardStatus) => counts[status] ?? 0;
  const fundedAwards =
    count("FUNDED") +
    count("SUBMITTED") +
    count("APPROVED") +
    count("REJECTED") +
    count("PAID") +
    count("REFUNDED");
  const reservedAwards =
    count("FUNDED") +
    count("SUBMITTED") +
    count("APPROVED") +
    count("REJECTED");

  return {
    fundedAwards,
    confirmedBaseUnits: fundedAwards * AWARD_AMOUNT,
    reservedBaseUnits: reservedAwards * AWARD_AMOUNT,
  };
}

export function formatTestnetXlm(baseUnits: number): string {
  if (!Number.isSafeInteger(baseUnits) || baseUnits < 0) {
    throw new RangeError("Testnet XLM base units must be a nonnegative safe integer.");
  }

  const amount = BigInt(baseUnits);
  const whole = amount / BigInt(10_000_000);
  const fraction = (amount % BigInt(10_000_000))
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");

  return fraction ? whole.toString() + "." + fraction : whole.toString();
}
export type SponsorRegisterStatus = "ALL" | "ON_HOLD" | "UNRESOLVED" | AwardStatus;
export type SponsorRegisterSort = "priority" | "participant" | "status";
export type SponsorRegisterFilters = {
  search: string;
  status: SponsorRegisterStatus;
  sort: SponsorRegisterSort;
};

export function filterSponsorWorkspaceAwards<T extends AwardView & { recipient_username: string }>(
  awards: T[],
  filters: SponsorRegisterFilters,
  user: AppUser,
): T[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const matching = awards.filter((award) => {
    const statusMatches =
      filters.status === "ALL" ||
      (filters.status === "ON_HOLD"
        ? award.sponsor_hold || award.verifier_hold
        : filters.status === "UNRESOLVED"
          ? award.unresolved_operation
          : award.status === filters.status);
    if (!statusMatches) return false;
    if (!search) return true;
    const searchable = [
      award.recipient_username,
      award.status,
      ...statusLines(award),
      nextStep(award, user),
      award.sponsor_hold || award.verifier_hold ? "on hold" : "",
      award.unresolved_operation ? "outcome not confirmed unresolved" : "",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(search);
  });

  if (filters.sort === "participant") {
    return matching.slice().sort((first, second) =>
      first.recipient_username.localeCompare(second.recipient_username),
    );
  }
  if (filters.sort === "status") {
    return matching.slice().sort((first, second) =>
      first.status.localeCompare(second.status) ||
      first.recipient_username.localeCompare(second.recipient_username),
    );
  }
  return matching;
}

export function confirmedAwardStatusCounts(
  awards: AwardView[],
): Partial<Record<AwardStatus, number>> {
  const counts: Partial<Record<AwardStatus, number>> = {};
  for (const award of awards) {
    if (award.last_confirmed_ledger === null) continue;
    counts[award.status] = (counts[award.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Choose the program shown at /programs.
 * An explicit id wins, including verifier or recipient memberships.
 * Otherwise prefer a sponsor membership so the register is reachable,
 * and keep the existing list order for every other role.
 */
export function selectWorkspaceProgram<T extends { id: string; role: string }>(
  programs: readonly T[],
  requestedProgramId: string,
): T | null {
  if (requestedProgramId) {
    const requested = programs.find((program) => program.id === requestedProgramId);
    if (requested) return requested;
  }
  return programs.find((program) => program.role === "SPONSOR") ?? programs[0] ?? null;
}

export function safeProgramReturnHref(value: string | string[] | undefined): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/programs";
  }
  try {
    const destination = new URL(value, "https://proofpay.invalid");
    if (destination.origin !== "https://proofpay.invalid" || destination.pathname !== "/programs") {
      return "/programs";
    }
    return destination.pathname + destination.search + destination.hash;
  } catch {
    return "/programs";
  }
}
