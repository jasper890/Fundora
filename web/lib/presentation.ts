/**
 * Port of proofpay/presentation.py — display-only award copy.
 * Never writes to the database or prepares chain actions.
 */
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
  if (award.status === "FUNDED" && hasLocalUnsignedEvidence(award)) {
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

  if (status === "FUNDED") {
    if (hasLocalUnsignedEvidence(award)) {
      if (role === "RECIPIENT") return "Review and sign submission.";
      return "Waiting for the recipient to sign submission.";
    }
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
    return "Unpaid funds were returned to the sponsor. No stipend was paid.";
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
