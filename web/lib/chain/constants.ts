/** Port of ROLES / PARAMS / ACTIVE / TERMINAL from proofpay/chain.py */
import type { OperationStatus, Role } from "../types";

export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
export const FEE_CEILING = 10_000_000;

export const ACTIVE: OperationStatus[] = [
  "BUILDING",
  "PREPARED",
  "SIGNED",
  "SUBMITTED",
  "UNKNOWN",
];

export const TERMINAL: OperationStatus[] = [
  "CONFIRMED_SUCCESS",
  "CONFIRMED_FAILED",
  "ABANDONED",
  "STALE",
];

export const ROLES: Record<string, Role[]> = {
  DEPLOY: ["SPONSOR"],
  FUND: ["SPONSOR"],
  CANCEL: ["SPONSOR"],
  SUBMIT: ["RECIPIENT"],
  APPROVE: ["VERIFIER"],
  REJECT: ["VERIFIER"],
  REOPEN: ["VERIFIER"],
  SET_HOLD: ["SPONSOR", "VERIFIER"],
  REPLACE_VERIFIER: ["SPONSOR"],
  PAY: ["SPONSOR"],
  REFUND: ["SPONSOR"],
  EXTEND_TTL: ["SPONSOR", "VERIFIER", "RECIPIENT"],
};

export const PARAMS: Record<string, string[]> = {
  SUBMIT: ["evidence_id"],
  SET_HOLD: ["held"],
  REPLACE_VERIFIER: ["new_verifier_member_id"],
};

export class ChainError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 409) {
    super(code);
    this.name = "ChainError";
    this.code = code;
    this.status = status;
  }
}
