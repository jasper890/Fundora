type MemberAssignment = {
  role: string;
  public_wallet: string;
  active: boolean;
};

export function memberAssignmentChanges(
  current: MemberAssignment,
  next: MemberAssignment,
): boolean {
  return current.role !== next.role ||
    current.public_wallet !== next.public_wallet ||
    current.active !== next.active;
}
