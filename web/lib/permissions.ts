/** Port of proofpay/permissions.py */
import type { AppUser, MemberView, Role } from "./types";

export class PermissionDeniedError extends Error {
  constructor(message = "Permission denied") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export type AwardAccess = {
  sponsor_member: MemberView;
  verifier_member: MemberView;
  recipient_member: MemberView;
  verifier_sync_required: boolean;
};

export function isAwardVisible(award: AwardAccess, user: AppUser): boolean {
  if (
    award.sponsor_member.user_id === user.id &&
    award.sponsor_member.role === "SPONSOR" &&
    award.sponsor_member.active
  ) {
    return true;
  }
  if (
    award.verifier_member.user_id === user.id &&
    award.verifier_member.role === "VERIFIER" &&
    award.verifier_member.active &&
    !award.verifier_sync_required
  ) {
    return true;
  }
  if (
    award.recipient_member.user_id === user.id &&
    award.recipient_member.role === "RECIPIENT" &&
    award.recipient_member.active
  ) {
    return true;
  }
  return false;
}

export function requireAwardRole(
  user: AppUser,
  award: AwardAccess,
  allowedRoles: Iterable<Role>,
): MemberView {
  const roleMembers: Record<Role, MemberView> = {
    SPONSOR: award.sponsor_member,
    VERIFIER: award.verifier_member,
    RECIPIENT: award.recipient_member,
  };
  for (const role of allowedRoles) {
    const member = roleMembers[role];
    if (
      member.user_id === user.id &&
      member.role === role &&
      member.active &&
      (role !== "VERIFIER" || !award.verifier_sync_required)
    ) {
      return member;
    }
  }
  throw new PermissionDeniedError();
}

export function hasAwardRole(
  user: AppUser,
  award: AwardAccess,
  allowedRoles: Iterable<Role>,
): boolean {
  try {
    requireAwardRole(user, award, allowedRoles);
    return true;
  } catch (error) {
    if (error instanceof PermissionDeniedError) return false;
    throw error;
  }
}

export function canExportAward(user: AppUser, award: AwardAccess): boolean {
  return hasAwardRole(user, award, ["SPONSOR", "VERIFIER"]);
}

export function canReadOperationStatus(
  user: AppUser,
  actorId: string,
  award: AwardAccess,
): boolean {
  return actorId === user.id || hasAwardRole(user, award, ["SPONSOR", "VERIFIER"]);
}
