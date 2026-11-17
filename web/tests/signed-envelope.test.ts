import { Account, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import { validateSignedEnvelope } from "../lib/chain/validate";

const signer = Keypair.random();
const wrongSigner = Keypair.random();
const contract = new Contract("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4");
function transaction(fee = "100", network = Networks.TESTNET) {
  return new TransactionBuilder(new Account(signer.publicKey(), "1"), { fee, networkPassphrase: network })
    .addOperation(contract.call("pay", nativeToScVal(BigInt(1), { type: "u64" }))).setTimeout(120).build();
}
function prepared() {
  const tx = transaction();
  return { unsigned_xdr: tx.toXDR(), unsigned_hash: Buffer.from(tx.hash()).toString("hex"), signer: signer.publicKey() };
}
describe("server-side signed transaction boundary", () => {
  it("accepts only the assigned signature over the exact prepared body and returns its real hash", () => {
    const op = prepared();
    const tx = TransactionBuilder.fromXDR(op.unsigned_xdr, Networks.TESTNET);
    tx.sign(signer);
    expect(validateSignedEnvelope(op, tx.toXDR())).toBe(op.unsigned_hash);
  });
  it("rejects changed fees/body even with a valid assigned signature", () => {
    const tx = transaction("200"); tx.sign(signer);
    expect(() => validateSignedEnvelope(prepared(), tx.toXDR())).toThrow("TRANSACTION_MISMATCH");
  });
  it("rejects missing signatures", () => {
    const op = prepared();
    expect(() => validateSignedEnvelope(op, op.unsigned_xdr)).toThrow("INVALID_SIGNATURE");
  });
  it("rejects the wrong account", () => {
    const tx = transaction(); tx.sign(wrongSigner);
    expect(() => validateSignedEnvelope(prepared(), tx.toXDR())).toThrow("INVALID_SIGNATURE");
  });
  it("rejects signatures made for Mainnet", () => {
    const tx = transaction("100", Networks.PUBLIC); tx.sign(signer);
    expect(() => validateSignedEnvelope(prepared(), tx.toXDR())).toThrow("INVALID_SIGNATURE");
  });
  it("rejects fee bump envelopes", () => {
    const tx = transaction(); tx.sign(signer);
    const bump = TransactionBuilder.buildFeeBumpTransaction(signer, "200", tx, Networks.TESTNET);
    bump.sign(signer);
    expect(() => validateSignedEnvelope(prepared(), bump.toXDR())).toThrow("TRANSACTION_MISMATCH");
  });
  it("rejects malformed XDR and corrupt stored preparation hashes", () => {
    expect(() => validateSignedEnvelope(prepared(), "bad")).toThrow("INVALID_TRANSACTION");
    const tx = transaction(); tx.sign(signer);
    expect(() => validateSignedEnvelope({ ...prepared(), unsigned_hash: "bad" }, tx.toXDR())).toThrow("TRANSACTION_MISMATCH");
  });
});
