/** Browser-only continuity for an in-flight chain operation (non-secret ids). */

const PREFIX = "proofpay:op:";

export type StoredOp = {
  operationId: string;
  unsignedXdr?: string | null;
  networkPassphrase?: string | null;
};

export function opStorageKey(awardId: string): string {
  return `${PREFIX}${awardId}`;
}

export function readStoredOp(awardId: string): StoredOp | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(opStorageKey(awardId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOp;
    if (!parsed?.operationId || typeof parsed.operationId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredOp(awardId: string, op: StoredOp): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(opStorageKey(awardId), JSON.stringify(op));
}

export function clearStoredOp(awardId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(opStorageKey(awardId));
}

export const TERMINAL_OP = new Set([
  "CONFIRMED_SUCCESS",
  "CONFIRMED_FAILED",
  "ABANDONED",
  "STALE",
]);
