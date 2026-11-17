/** RPC gateway interface — real and fake implementations (port of chain.RPCGateway). */
import type { AwardStatus } from "../types";

export type AwardSnapshot = {
  status: AwardStatus;
  version: number;
  evidence_revision: number;
  evidence_digest: string | null;
  verifier: string;
  sponsor_hold: boolean;
  verifier_hold: boolean;
  timestamp?: number;
};

export type PreparedEnvelope = {
  toXdr: () => string;
  hashHex: () => string;
  fee: number;
  source: string;
  signatureCount: number;
  operationCount: number;
  maxTime: number;
};

export interface RpcGateway {
  readAward(contractId: string | null): Promise<AwardSnapshot>;
  prepare(args: {
    action: string;
    signer: string;
    contractId?: string | null;
    snapshot: AwardSnapshot;
  }): Promise<PreparedEnvelope>;
  submit(signedXdr: string): Promise<{ hash: string }>;
  getTransaction(
    hash: string,
  ): Promise<"SUCCESS" | "FAILED" | "NOT_FOUND" | "PENDING">;
}

export class FakeRpc implements RpcGateway {
  snapshot: AwardSnapshot;
  failPrepare = false;
  constructor(snapshot: AwardSnapshot) {
    this.snapshot = snapshot;
  }
  async readAward(): Promise<AwardSnapshot> {
    return this.snapshot;
  }
  async prepare(args: {
    action: string;
    signer: string;
    contractId?: string | null;
    snapshot?: AwardSnapshot;
  }): Promise<PreparedEnvelope> {
    if (this.failPrepare) throw new Error("RPC down");
    const xdr = `FAKE-${args.action}-${args.signer}`;
    return {
      toXdr: () => xdr,
      hashHex: () => `hash-${args.action}`,
      fee: 100,
      source: args.signer,
      signatureCount: 0,
      operationCount: 1,
      maxTime: Math.floor(Date.now() / 1000) + 120,
    };
  }
  async submit(signedXdr: string): Promise<{ hash: string }> {
    return { hash: `sub-${signedXdr.slice(0, 12)}` };
  }
  async getTransaction(): Promise<"SUCCESS" | "FAILED" | "NOT_FOUND" | "PENDING"> {
    return "PENDING";
  }
}
