import type { Role } from "../types";

export const DOORS = ["sponsor", "verifier", "recipient", "administrator"] as const;
export type Door = (typeof DOORS)[number];

export const DOOR_LABEL: Record<Door, string> = {
  sponsor: "Sponsor",
  verifier: "Verifier",
  recipient: "Recipient",
  administrator: "Administrator",
};

const DOOR_ROLE: Record<Exclude<Door, "administrator">, Role> = {
  sponsor: "SPONSOR",
  verifier: "VERIFIER",
  recipient: "RECIPIENT",
};

/** A door is only a UX entry point: it admits an account that actually holds that provisioned role. */
export function doorAdmits(
  door: Door,
  account: { is_staff: boolean },
  activeRoles: readonly Role[],
): boolean {
  return door === "administrator"
    ? account.is_staff
    : activeRoles.includes(DOOR_ROLE[door]);
}

export function doorHome(door: Door | undefined): string {
  return door === "administrator" ? "/admin" : "/programs";
}

export function wrongDoorMessage(door: Door): string {
  return `This account is not provisioned as ${DOOR_LABEL[door] === "Administrator" ? "an" : "a"} ${DOOR_LABEL[door]}. Go back and choose the workspace that matches your role.`;
}
