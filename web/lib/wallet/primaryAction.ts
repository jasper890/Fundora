/** Which prepare action is the single primary CTA for a role + award state. */
import type { AwardStatus } from "@/lib/types";

export type WalletRole = "SPONSOR" | "VERIFIER" | "RECIPIENT";

export type PrimaryAction = {
  action: string;
  label: string;
};

/**
 * Returns at most one primary prepare action. Recovery actions (holds, refund,
 * replace verifier) stay out of this smoke-oriented panel until separately wired.
 */
export function primaryPrepareAction(args: {
  role: WalletRole | null;
  status: AwardStatus;
  hasLedger: boolean;
  hasEvidence?: boolean;
}): PrimaryAction | null {
  const { role, status, hasLedger, hasEvidence } = args;
  if (!role) return null;

  if (role === "SPONSOR") {
    if (!hasLedger) {
      return { action: "DEPLOY", label: "Review award deployment" };
    }
    if (status === "CREATED") {
      return { action: "FUND", label: "Prepare funding" };
    }
    if (status === "APPROVED") {
      return { action: "PAY", label: "Prepare payment" };
    }
    return null;
  }

  if (role === "RECIPIENT") {
    if (status === "FUNDED" || status === "SUBMITTED") {
      if (!hasEvidence) return null;
      return { action: "SUBMIT", label: "Prepare submission" };
    }
    return null;
  }

  if (role === "VERIFIER") {
    if (status === "SUBMITTED") {
      return { action: "APPROVE", label: "Prepare approval" };
    }
    return null;
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
