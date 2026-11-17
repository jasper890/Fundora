/**
 * Live Soroban RPC gateway — port of proofpay.chain.RPCGateway (subset).
 * Requires STELLAR_WASM_HASH to be installed on Testnet.
 */
import "server-only";
import {
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { ChainError, FEE_CEILING, NETWORK_PASSPHRASE } from "./constants";
import type {
  AwardSnapshot,
  PreparedEnvelope,
  RpcGateway,
  TxOutcome,
} from "./rpc";

const NETWORK = NETWORK_PASSPHRASE || Networks.TESTNET;

export type LivePrepareInput = {
  action: string;
  signer: string;
  contractId?: string | null;
  snapshot: AwardSnapshot;
  /** DEPLOY constructor manifest fields */
  manifest?: Record<string, unknown> | null;
  /** SUBMIT evidence */
  evidence?: { revision: number; digest: string } | null;
  expectedVersion?: string | null;
  hold?: boolean | null;
  newVerifierWallet?: string | null;
};

function rpcUrl() {
  return process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
}

function wasmHash(): string {
  const hash = process.env.STELLAR_WASM_HASH || "";
  if (hash.length !== 64 || !/^[0-9a-f]+$/i.test(hash)) {
    throw new ChainError("CODE_HASH_NOT_CONFIGURED", 503);
  }
  return hash.toLowerCase();
}

function nativeTokenContractId(): string {
  return Asset.native().contractId(NETWORK);
}

function bytesHex(value: unknown): string {
  if (value instanceof Uint8Array) return Buffer.from(value).toString("hex");
  throw new ChainError("STATE_UNAVAILABLE", 503);
}

export class LiveRpc implements RpcGateway {
  server: rpc.Server;

  constructor() {
    this.server = new rpc.Server(rpcUrl(), { allowHttp: true });
  }

  async verifyNetwork(): Promise<string> {
    const configured = process.env.STELLAR_NETWORK_PASSPHRASE || NETWORK;
    if (configured !== NETWORK) throw new ChainError("WRONG_NETWORK");
    const actual = await this.server.getNetwork();
    if (actual.passphrase !== NETWORK) throw new ChainError("WRONG_NETWORK");
    const token = nativeTokenContractId();
    const response = await this.server.getLedgerEntries(new Contract(token).getFootprint());
    const data = response.entries[0]?.val;
    if (data?.type !== "contractData" || data.contractData.val.type !== "scvContractInstance" ||
      data.contractData.val.instance.executable.type !== "contractExecutableStellarAsset") throw new ChainError("WRONG_TOKEN");
    return token;
  }

  async readAward(contractId: string | null, manifest?: Record<string, unknown> | null): Promise<AwardSnapshot> {
    if (!contractId || !isContractId(contractId)) throw new ChainError("DEPLOYMENT_UNAVAILABLE", 409);
    if (!manifest || !Object.keys(manifest).length) throw new ChainError("AWARD_IDENTITY_MISMATCH", 503);
    const token = await this.verifyNetwork();
    const response = await this.server.getLedgerEntries(new Contract(contractId).getFootprint());
    const data = response.entries[0]?.val;
    if (data?.type !== "contractData" || data.contractData.val.type !== "scvContractInstance") throw new ChainError("STATE_UNAVAILABLE", 503);
    const instance = data.contractData.val.instance;
    if (instance.executable.type !== "contractExecutableWasm" || Buffer.from(instance.executable.wasmHash.value).toString("hex") !== wasmHash()) throw new ChainError("WRONG_CODE_HASH");
    const entry = instance.storage?.find((item) => {
      const key = scValToNative(item.key);
      return Array.isArray(key) && key.length === 1 && key[0] === "State";
    });
    if (!entry) throw new ChainError("STATE_UNAVAILABLE", 503);
    const state = scValToNative(entry.val) as Record<string, unknown>;
    if (!state || typeof state !== "object") throw new ChainError("STATE_UNAVAILABLE", 503);
    if (String(state.amount) !== "200000000" || state.token !== token) throw new ChainError("WRONG_TOKEN");
    for (const field of ["sponsor", "recipient", "token", "amount", "claim_deadline", "review_deadline", "payout_deadline"]) {
      if (manifest[field] == null || String(state[field]) !== String(manifest[field])) throw new ChainError("AWARD_IDENTITY_MISMATCH", 503);
    }
    for (const field of ["award_id", "policy_hash"]) {
      if (typeof manifest[field] !== "string" || bytesHex(state[field]) !== manifest[field]) throw new ChainError("AWARD_IDENTITY_MISMATCH", 503);
    }
    if (typeof state.sponsor_hold !== "boolean" || typeof state.verifier_hold !== "boolean" ||
      typeof state.verifier !== "string" || !StrKey.isValidEd25519PublicKey(state.verifier)) throw new ChainError("STATE_UNAVAILABLE", 503);
    const latest = await this.server.getLatestLedger();
    const statusValue = Array.isArray(state.status) ? state.status[0] : state.status;
    const status = String(statusValue).toUpperCase() as AwardSnapshot["status"];
    const version = Number(state.version);
    const evidenceRevision = Number(state.evidence_revision);
    const timestamp = Number(latest.closeTime);
    if (!["CREATED", "FUNDED", "SUBMITTED", "APPROVED", "REJECTED", "PAID", "REFUNDED", "CANCELLED"].includes(status) ||
      !Number.isSafeInteger(version) || version < 0 || !Number.isSafeInteger(evidenceRevision) || evidenceRevision < 0 ||
      !Number.isSafeInteger(timestamp) || timestamp < 0) throw new ChainError("STATE_UNAVAILABLE", 503);
    return { status, version, evidence_revision: evidenceRevision,
      evidence_digest: state.evidence_digest ? bytesHex(state.evidence_digest).toLowerCase() : null,
      verifier: String(state.verifier), sponsor_hold: Boolean(state.sponsor_hold), verifier_hold: Boolean(state.verifier_hold), timestamp };
  }

  async prepare(args: {
    action: string;
    signer: string;
    contractId?: string | null;
    snapshot: AwardSnapshot;
  }): Promise<PreparedEnvelope> {
    // Narrow prepare used by FakeRpc-compatible callers; prefer prepareLive.
    return this.prepareLive({
      action: args.action,
      signer: args.signer,
      contractId: args.contractId,
      snapshot: args.snapshot,
    });
  }

  async prepareLive(input: LivePrepareInput): Promise<PreparedEnvelope> {
    const token = await this.verifyNetwork();
    const code = wasmHash();
    const account = await this.server.getAccount(input.signer);
    const maxFee = Math.min(
      Number(process.env.STELLAR_MAX_FEE || FEE_CEILING),
      FEE_CEILING,
    );
    let builder = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK,
    }).setTimeout(120);

    if (input.action === "DEPLOY") {
      const m = input.manifest;
      if (!m) throw new ChainError("INVALID_PARAMETERS", 400);
      if (String(m.token) !== token) throw new ChainError("WRONG_TOKEN");
      const salt = Buffer.from(String(m.salt), "hex");
      const constructorArgs = [
        nativeToScVal(String(m.sponsor), { type: "address" }),
        nativeToScVal(String(m.verifier), { type: "address" }),
        nativeToScVal(String(m.recipient), { type: "address" }),
        nativeToScVal(String(m.token), { type: "address" }),
        nativeToScVal(BigInt(Number(m.amount)), { type: "i128" }),
        nativeToScVal(Buffer.from(String(m.award_id), "hex"), { type: "bytes" }),
        nativeToScVal(Buffer.from(String(m.policy_hash), "hex"), { type: "bytes" }),
        nativeToScVal(BigInt(Number(m.claim_deadline)), { type: "u64" }),
        nativeToScVal(BigInt(Number(m.review_deadline)), { type: "u64" }),
        nativeToScVal(BigInt(Number(m.payout_deadline)), { type: "u64" }),
      ];
      builder = builder.addOperation(
        Operation.createCustomContract({
          address: new Address(input.signer),
          wasmHash: Buffer.from(code, "hex"),
          salt,
          constructorArgs,
        }),
      );
    } else {
      if (!input.contractId) throw new ChainError("DEPLOYMENT_UNAVAILABLE", 409);
      const contract = new Contract(input.contractId);
      const method =
        input.action === "EXTEND_TTL" ? "extend_lifetime" : input.action.toLowerCase();
      const args: xdr.ScVal[] = [];
      if (input.action === "SUBMIT") {
        if (!input.evidence) throw new ChainError("INVALID_PARAMETERS", 400);
        args.push(nativeToScVal(input.evidence.revision, { type: "u32" }));
        args.push(
          nativeToScVal(Buffer.from(input.evidence.digest, "hex"), { type: "bytes" }),
        );
      }
      if (input.action === "SET_HOLD") {
        args.push(nativeToScVal(input.signer, { type: "address" }));
        args.push(nativeToScVal(Boolean(input.hold), { type: "bool" }));
      }
      if (input.action === "REPLACE_VERIFIER") {
        if (!input.newVerifierWallet) throw new ChainError("INVALID_PARAMETERS", 400);
        args.push(nativeToScVal(input.newVerifierWallet, { type: "address" }));
      }
      if (input.action !== "EXTEND_TTL") {
        const version = input.expectedVersion ?? "0";
        args.push(nativeToScVal(BigInt(version), { type: "u64" }));
      }
      builder = builder.addOperation(contract.call(method, ...args));
    }

    const built = builder.build();
    const prepared = await this.server.prepareTransaction(built);
    if (prepared.signatures.length) throw new ChainError("INVALID_PREPARATION");
    if (prepared.operations.length !== 1) throw new ChainError("INVALID_PREPARATION");
    const fee = Number(prepared.fee);
    if (!Number.isSafeInteger(fee) || !Number.isFinite(maxFee) || fee <= 0 || fee > maxFee) throw new ChainError("FEE_CEILING");

    // Auth must be source-account only (Django check).
    const op = prepared.operations[0] as { auth?: unknown[] };
    for (const auth of op.auth ?? []) {
      const entry = auth as { credentials?: { type?: string } };
      if (entry.credentials?.type !== "sorobanCredentialsSourceAccount") {
        throw new ChainError("UNSUPPORTED_AUTH");
      }
    }

    const source = Keypair.fromPublicKey(input.signer).publicKey();
    const maxTime =
      prepared.timeBounds?.maxTime != null
        ? Number(prepared.timeBounds.maxTime)
        : Math.floor(Date.now() / 1000) + 120;

    return {
      toXdr: () => prepared.toXDR(),
      hashHex: () => Buffer.from(prepared.hash()).toString("hex"),
      fee,
      source,
      signatureCount: 0,
      operationCount: 1,
      maxTime,
    };
  }

  async submit(_signedXdr: string): Promise<{ hash: string }> {
    // shortcut: live submission stays disabled until prepare/reconcile review gates pass; remove only after independent approval.
    throw new ChainError("LIVE_SUBMISSION_REVIEW_REQUIRED", 403);
  }

  async getTransaction(hash: string): Promise<TxOutcome> {
    const result = await this.server.getTransaction(hash);
    if (result.txHash.toLowerCase() !== hash.toLowerCase()) {
      throw new ChainError("TRANSACTION_MISMATCH", 503);
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { status: "FAILED" };
    }
    if (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return { status: "NOT_FOUND" };
    }
    if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      return { status: "PENDING" };
    }

    let contractId: string | undefined;
    try {
      if ("returnValue" in result && result.returnValue) {
        contractId = Address.fromScVal(result.returnValue).toString();
        if (!isContractId(contractId)) contractId = undefined;
      }
    } catch {
      contractId = undefined;
    }

    const ledger =
      "ledger" in result && typeof result.ledger === "number"
        ? result.ledger
        : undefined;

    return { status: "SUCCESS", ledger, contractId };
  }
}

export function isContractId(value: string): boolean {
  try {
    return StrKey.isValidContract(value);
  } catch {
    return false;
  }
}
