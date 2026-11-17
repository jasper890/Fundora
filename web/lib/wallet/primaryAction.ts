/** Role- and deadline-aware primary wallet action for an award. */
import type { AwardStatus } from "@/lib/types";

export type WalletRole = "SPONSOR" | "VERIFIER" | "RECIPIENT";

export type PrimaryAction = {
  action: string;
  label: string;
};

export type ActionContext = {
  role: WalletRole | null;
  status: AwardStatus;
  hasLedger: boolean;
  hasEvidence?: boolean;
  hasHold: boolean;
  verifierSyncRequired: boolean;
  claimDeadline: string;
  reviewDeadline: string;
  payoutDeadline: string;
  now?: number;
};

const TERMINAL_STATUSES = new Set<AwardStatus>([
  "PAID",
  "REFUNDED",
  "CANCELLED",
]);

function beforeDeadline(deadline: string, now: number): boolean {
  const cutoff = Date.parse(deadline);
  return Number.isFinite(cutoff) && now < cutoff;
}

function throughDeadline(deadline: string, now: number): boolean {
  const cutoff = Date.parse(deadline);
  return Number.isFinite(cutoff) && now <= cutoff;
}

/** UI gate only; the server and contract remain authoritative for deadlines. */
export function primaryPrepareAction(
  context: ActionContext,
): PrimaryAction | null {
  const now = context.now ?? Date.now();
  if (
    !context.role ||
    TERMINAL_STATUSES.has(context.status) ||
    (context.role === "VERIFIER" && context.verifierSyncRequired)
  ) {
    return null;
  }

  if (!context.hasLedger) {
    return context.role === "SPONSOR" &&
      context.status === "CREATED" &&
      beforeDeadline(context.claimDeadline, now)
      ? { action: "DEPLOY", label: "Review award deployment" }
      : null;
  }

  if (
    context.role === "SPONSOR" &&
    context.status === "CREATED" &&
    throughDeadline(context.claimDeadline, now)
  ) {
    return { action: "FUND", label: "Prepare funding" };
  }

  if (
    context.role === "SPONSOR" &&
    context.status === "APPROVED" &&
    !context.hasHold &&
    throughDeadline(context.payoutDeadline, now)
  ) {
    return { action: "PAY", label: "Prepare payment" };
  }

  if (
    context.role === "RECIPIENT" &&
    (context.status === "FUNDED" || context.status === "SUBMITTED") &&
    context.hasEvidence &&
    throughDeadline(context.claimDeadline, now)
  ) {
    return { action: "SUBMIT", label: "Prepare submission" };
  }

  if (
    context.role === "VERIFIER" &&
    context.status === "SUBMITTED" &&
    !context.hasHold &&
    throughDeadline(context.reviewDeadline, now)
  ) {
    return { action: "APPROVE", label: "Prepare approval" };
  }

  return null;
}

export function walletRoleFromFlags(flags: {
  isSponsor: boolean;
  isVerifier: boolean;
  isRecipient: boolean;
}): WalletRole | null {
  if (flags.isSponsor) return "SPONSOR";
  if (flags.isVerifier) return "VERIFIER";
  if (flags.isRecipient) return "RECIPIENT";
  return null;
}
