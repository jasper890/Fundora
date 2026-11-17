/** Shared domain types ported from proofpay.models */

export type Role = "SPONSOR" | "VERIFIER" | "RECIPIENT";

export type AwardStatus =
  | "CREATED"
  | "FUNDED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "PAID"
  | "REFUNDED"
  | "CANCELLED";

export type OperationStatus =
  | "BUILDING"
  | "PREPARED"
  | "SIGNED"
  | "SUBMITTED"
  | "UNKNOWN"
  | "CONFIRMED_SUCCESS"
  | "CONFIRMED_FAILED"
  | "ABANDONED"
  | "STALE";

export type TrackerMark = "done" | "current" | "waiting";

export type TrackerStep = { label: string; mark: TrackerMark };

export type HomeCopy = {
  page_title: string;
  upcoming_title: string;
  register_title: string;
  empty_upcoming: string;
  empty_register: string;
  primary_label: string;
};

/** Presentation view of an award — pure data, no ORM. */
export type AwardView = {
  id: string;
  status: AwardStatus;
  last_confirmed_ledger: number | null;
  sponsor_hold: boolean;
  verifier_hold: boolean;
  evidence_revision: number;
  evidence_digest: string;
  sponsor_member: MemberView;
  verifier_member: MemberView;
  recipient_member: MemberView;
  /** Latest local evidence revision digest/revision if any */
  latest_evidence: { revision: number; digest: string } | null;
  unresolved_operation: boolean;
};

export type MemberView = {
  user_id: string;
  role: Role;
  active: boolean;
  public_wallet: string;
};

export type AppUser = {
  id: string;
  username: string;
  is_staff: boolean;
  is_active: boolean;
};

export const AWARD_AMOUNT = 200_000_000;
export const ACTIVE_OPS: OperationStatus[] = [
  "BUILDING",
  "PREPARED",
  "SIGNED",
  "SUBMITTED",
  "UNKNOWN",
];
