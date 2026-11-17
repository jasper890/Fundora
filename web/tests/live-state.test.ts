import { Asset, Keypair, Networks, nativeToScVal } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LiveRpc } from "../lib/chain/live";

const token = Asset.native().contractId(Networks.TESTNET);
const manifest = { sponsor: Keypair.random().publicKey(), recipient: Keypair.random().publicKey(),
  token, amount: 200000000, award_id: "b".repeat(64), policy_hash: "c".repeat(64),
  claim_deadline: 100, review_deadline: 200, payout_deadline: 300 };
let live: LiveRpc;
let state: Record<string, unknown>;
beforeEach(() => {
  vi.stubEnv("STELLAR_WASM_HASH", "a".repeat(64));
  live = new LiveRpc();
  state = { ...manifest, amount: BigInt(200000000), award_id: Buffer.from(manifest.award_id, "hex"),
    policy_hash: Buffer.from(manifest.policy_hash, "hex"), verifier: Keypair.random().publicKey(),
    status: ["Funded"], version: BigInt(1), evidence_revision: 0, evidence_digest: null,
    sponsor_hold: false, verifier_hold: false };
  vi.spyOn(live, "verifyNetwork").mockResolvedValue(token);
  vi.spyOn(live.server, "getLatestLedger").mockResolvedValue({ closeTime: 50 } as never);
  vi.spyOn(live.server, "getLedgerEntries").mockImplementation(async () => ({ entries: [{ val: {
    type: "contractData", contractData: { val: { type: "scvContractInstance", instance: {
      executable: { type: "contractExecutableWasm", wasmHash: { value: Buffer.from("a".repeat(64), "hex") } },
      storage: [{ key: nativeToScVal(["State"]), val: nativeToScVal(state) }],
    } } },
  } }] }) as never);
});
afterEach(() => vi.unstubAllEnvs());

it("decodes SDK values while binding the instance to its immutable constructor terms", async () => {
  expect(await live.readAward(token, manifest)).toMatchObject({ status: "FUNDED", version: 1, timestamp: 50 });
});
it("requires the recorded manifest before trusting a same-code contract", async () => {
  await expect(live.readAward(token)).rejects.toMatchObject({ code: "AWARD_IDENTITY_MISMATCH" });
});
it.each(["sponsor", "recipient", "award_id", "policy_hash", "claim_deadline", "review_deadline", "payout_deadline"])(
  "rejects a contract with changed %s", async (field) => {
    state[field] = field.endsWith("deadline") ? 999 : field.endsWith("id") || field.endsWith("hash")
      ? Buffer.from("d".repeat(64), "hex") : Keypair.random().publicKey();
    await expect(live.readAward(token, manifest)).rejects.toMatchObject({ code: "AWARD_IDENTITY_MISMATCH" });
  });
it("rejects malformed hold flags instead of coercing them to true", async () => {
  state.sponsor_hold = "false";
  await expect(live.readAward(token, manifest)).rejects.toMatchObject({ code: "STATE_UNAVAILABLE" });
});

it("decodes a live Some(BytesN<32>) evidence digest to lowercase hex", async () => {
  const digestBytes = Buffer.from("ab".repeat(32), "hex");
  state.status = ["Submitted"];
  state.version = BigInt(2);
  state.evidence_revision = 1;
  state.evidence_digest = digestBytes;
  await expect(live.readAward(token, manifest)).resolves.toMatchObject({
    status: "SUBMITTED",
    version: 2,
    evidence_revision: 1,
    evidence_digest: "ab".repeat(32),
  });
});
