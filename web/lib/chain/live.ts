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
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { ChainError, FEE_CEILING, NETWORK_PASSPHRASE } from "./constants";
import type { AwardSnapshot, PreparedEnvelope, RpcGateway } from "./rpc";

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

export class LiveRpc implements RpcGateway {
  server: rpc.Server;

  constructor() {
    this.server = new rpc.Server(rpcUrl(), { allowHttp: true });
  }

  async verifyNetwork(): Promise<string> {
    const configured = process.env.STELLAR_NETWORK_PASSPHRASE || NETWORK;
    if (configured !== NETWORK) throw new ChainError("WRONG_NETWORK");
    const token = nativeTokenContractId();
    // Presence of native SAC is assumed on public Testnet; deeper checks match Django later.
    return token;
  }

  async readAward(): Promise<AwardSnapshot> {
    throw new ChainError("STATE_UNAVAILABLE", 503);
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
    if (fee <= 0 || fee > maxFee) throw new ChainError("FEE_CEILING");

    // Auth must be source-account only (Django check).
    const op = prepared.operations[0] as { auth?: unknown[] };
    for (const auth of op.auth ?? []) {
      const entry = auth as { credentials?: { switch?: () => { name: string } } };
      const name = entry.credentials?.switch?.().name;
      if (name && name !== "sorobanCredentialsSourceAccount") {
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

  async submit(signedXdr: string): Promise<{ hash: string }> {
    await this.verifyNetwork();
    if (process.env.STELLAR_ALLOW_SUBMISSION !== "1") {
      throw new ChainError("NETWORK_SUBMISSION_DISABLED", 403);
    }
    const send = await this.server.sendTransaction(
      // TransactionBuilder.fromXDR is the typed path; cast via rpc helpers.
      TransactionBuilder.fromXDR(signedXdr, NETWORK) as never,
    );
    return { hash: send.hash };
  }

  async getTransaction(
    hash: string,
  ): Promise<"SUCCESS" | "FAILED" | "NOT_FOUND" | "PENDING"> {
    const result = await this.server.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return "SUCCESS";
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) return "FAILED";
    if (result.status === rpc.Api.GetTransactionStatus.NOT_FOUND) return "NOT_FOUND";
    return "PENDING";
  }
}

export function isContractId(value: string): boolean {
  try {
    return StrKey.isValidContract(value);
  } catch {
    return false;
  }
}
